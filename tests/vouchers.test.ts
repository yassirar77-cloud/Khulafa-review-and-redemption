// Runs against a real Postgres. Point TEST_DATABASE_URL at an empty, throwaway database:
//   TEST_DATABASE_URL=postgres://postgres@localhost:5432/khulafa_test npm test
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join } from "path";

import { checkPin, hashPin, signSession, verifySession } from "../src/lib/auth";
import { slugify, toGoogleReviewUrl } from "../src/lib/branches";
import { db } from "../src/lib/db";
import { normalizePhone } from "../src/lib/phone";
import { claimVoucher, cleanCode, getVoucher, redeemVoucher } from "../src/lib/vouchers";

// db() reads DATABASE_URL lazily, so setting it here is early enough.
const url = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL = url;

describe("pure helpers", () => {
  test("normalizePhone treats local and international formats the same", () => {
    assert.equal(normalizePhone("012-345 6789"), "60123456789");
    assert.equal(normalizePhone("+60 12-345 6789"), "60123456789");
    assert.equal(normalizePhone("0060123456789"), "60123456789");
    assert.equal(normalizePhone("12345"), null);
  });

  test("toGoogleReviewUrl accepts Place IDs and https links only", () => {
    assert.equal(
      toGoogleReviewUrl("ChIJN1t_tDeuEmsRUsoyG83frY4"),
      "https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4",
    );
    assert.equal(toGoogleReviewUrl("https://g.page/r/abc/review"), "https://g.page/r/abc/review");
    assert.equal(toGoogleReviewUrl("javascript:alert(1)"), null);
    assert.equal(toGoogleReviewUrl(""), "");
  });

  test("slugify and cleanCode", () => {
    assert.equal(slugify("Khulafa Bistro — Shah Alam!"), "khulafa-bistro-shah-alam");
    assert.equal(cleanCode(" ab-3 k9 "), "AB3K9");
  });

  test("PINs and sessions", () => {
    process.env.SESSION_SECRET = "test-secret-at-least-16-chars";
    const stored = hashPin("4821");
    assert.ok(checkPin("4821", stored));
    assert.ok(!checkPin("4822", stored));
    const token = signSession({ role: "staff", branchId: 3 }, 60);
    assert.deepEqual(verifySession(token), { role: "staff", branchId: 3 });
    assert.equal(verifySession(token.slice(0, -2) + "xx"), null);
    assert.equal(verifySession(signSession({ role: "admin" }, -1)), null);
  });
});

describe("vouchers", { skip: !url && "TEST_DATABASE_URL not set" }, () => {
  let branchA: number;
  let branchB: number;

  before(async () => {
    const sql = db();
    await sql`DROP SCHEMA IF EXISTS review CASCADE`;
    await sql.unsafe(readFileSync(join(__dirname, "..", "db", "schema.sql"), "utf8"));
  });

  beforeEach(async () => {
    const sql = db();
    await sql`TRUNCATE review.events, review.vouchers, review.branches RESTART IDENTITY CASCADE`;
    [{ id: branchA }] = await sql`
      INSERT INTO review.branches (slug, name, reward_text, cooldown_days)
      VALUES ('a', 'Branch A', 'Free drink', 30) RETURNING id`;
    [{ id: branchB }] = await sql`
      INSERT INTO review.branches (slug, name, reward_text, cooldown_days)
      VALUES ('b', 'Branch B', 'Free teh tarik', 30) RETURNING id`;
  });

  after(async () => {
    await db().end();
  });

  test("claim creates a voucher with the branch reward", async () => {
    const res = await claimVoucher("b", " Aisyah ", "012-345 6789");
    assert.ok(res.ok);
    const v = await getVoucher(res.code);
    assert.equal(v?.customer_name, "Aisyah");
    assert.equal(v?.reward_text, "Free teh tarik");
    assert.equal(v?.phone, "60123456789");
  });

  test("same phone gets its existing unused voucher back instead of a second one", async () => {
    const first = await claimVoucher("a", "Ali", "0123456789");
    const second = await claimVoucher("a", "Ali", "+60 12-345 6789");
    assert.ok(first.ok && second.ok);
    assert.equal(second.code, first.code);
    assert.equal(second.existing, true);
  });

  test("simultaneous claims from one phone produce one voucher", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => claimVoucher("a", "Ali", "0123456789")),
    );
    const codes = new Set(results.map((r) => (r.ok ? r.code : "error")));
    assert.equal(codes.size, 1);
    const [{ count }] = await db()`SELECT count(*)::int AS count FROM review.vouchers`;
    assert.equal(count, 1);
  });

  test("after redeeming, the same phone must wait for the cooldown", async () => {
    const first = await claimVoucher("a", "Ali", "0123456789");
    assert.ok(first.ok);
    assert.ok((await redeemVoucher(branchA, first.code)).ok);
    const again = await claimVoucher("a", "Ali", "0123456789");
    assert.equal(again.ok, false);
  });

  test("cooldown is per branch", async () => {
    const a = await claimVoucher("a", "Ali", "0123456789");
    assert.ok(a.ok);
    await redeemVoucher(branchA, a.code);
    assert.ok((await claimVoucher("b", "Ali", "0123456789")).ok);
  });

  test("cooldown of 0 days allows claiming again once redeemed", async () => {
    await db()`UPDATE review.branches SET cooldown_days = 0 WHERE id = ${branchA}`;
    const first = await claimVoucher("a", "Ali", "0123456789");
    assert.ok(first.ok);
    await redeemVoucher(branchA, first.code);
    const second = await claimVoucher("a", "Ali", "0123456789");
    assert.ok(second.ok && second.code !== first.code);
  });

  test("a voucher can only be redeemed once, even by two tills at once", async () => {
    const res = await claimVoucher("a", "Ali", "0123456789");
    assert.ok(res.ok);
    const [r1, r2] = await Promise.all([redeemVoucher(branchA, res.code), redeemVoucher(branchA, res.code)]);
    assert.equal([r1, r2].filter((r) => r.ok).length, 1);
    const third = await redeemVoucher(branchA, res.code.toLowerCase());
    assert.equal(third.ok, false);
    assert.match(!third.ok ? third.error : "", /Already redeemed/);
  });

  test("vouchers can't be redeemed at another branch or after expiry", async () => {
    const res = await claimVoucher("a", "Ali", "0123456789");
    assert.ok(res.ok);
    const wrong = await redeemVoucher(branchB, res.code);
    assert.equal(wrong.ok, false);
    assert.match(!wrong.ok ? wrong.error : "", /different branch/);

    await db()`UPDATE review.vouchers SET expires_at = now() - interval '1 minute'`;
    const expired = await redeemVoucher(branchA, res.code);
    assert.equal(expired.ok, false);
    assert.match(!expired.ok ? expired.error : "", /Expired/);
  });

  test("inactive branches and bad input are rejected", async () => {
    await db()`UPDATE review.branches SET active = false WHERE id = ${branchA}`;
    assert.equal((await claimVoucher("a", "Ali", "0123456789")).ok, false);
    assert.equal((await claimVoucher("b", "", "0123456789")).ok, false);
    assert.equal((await claimVoucher("b", "Ali", "123")).ok, false);
    assert.equal((await redeemVoucher(branchB, "NOPE12")).ok, false);
  });
});
