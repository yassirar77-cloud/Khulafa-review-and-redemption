// The /staff?code= flow: a scanned voucher QR only *checks* the code.
// Needs an empty throwaway database, like vouchers.test.ts:
//   TEST_DATABASE_URL=postgres://postgres@localhost:5432/khulafa_test npm test
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join } from "path";
import { db } from "../src/lib/db";
import { previewVoucher, staffPath } from "../src/lib/staff";
import { claimVoucher, generateCode, getVoucher, redeemVoucher } from "../src/lib/vouchers";

const url = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL = url;

describe("staffPath", () => {
  test("carries a cleaned code, or none", () => {
    assert.equal(staffPath("482913"), "/staff?code=482913");
    assert.equal(staffPath(" 482 913 "), "/staff?code=482913");
    assert.equal(staffPath("k48mq8"), "/staff?code=K48MQ8");
    assert.equal(staffPath(""), "/staff");
    assert.equal(staffPath(null), "/staff");
  });

  test("can't be turned into a redirect elsewhere", () => {
    assert.equal(staffPath("//evil.com"), "/staff?code=EVILCOM");
    assert.equal(staffPath("https://evil.com/x?y=1&z"), "/staff?code=HTTPSEVILCOM");
    assert.equal(staffPath("<script>"), "/staff?code=SCRIPT");
  });
});

describe("generateCode", () => {
  test("new codes are always 6 digits", () => {
    for (let i = 0; i < 2000; i++) assert.match(generateCode(), /^\d{6}$/);
  });
});

describe("staff ?code= lookup", { skip: !url && "TEST_DATABASE_URL not set" }, () => {
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
      INSERT INTO review.branches (slug, name) VALUES ('a', 'Branch A') RETURNING id`;
    [{ id: branchB }] = await sql`
      INSERT INTO review.branches (slug, name) VALUES ('b', 'Branch B') RETURNING id`;
  });

  after(async () => {
    await db().end();
  });

  test("new vouchers get 6-digit codes", async () => {
    const res = await claimVoucher("a", "Ali", "0123456789");
    assert.ok(res.ok);
    assert.match(res.code, /^\d{6}$/);
  });

  test("checking a scanned code shows the voucher but never redeems it", async () => {
    const res = await claimVoucher("a", "Aisyah", "0123456789");
    assert.ok(res.ok);
    for (let i = 0; i < 3; i++) {
      const state = await previewVoucher(branchA, res.code);
      assert.equal(state.code, res.code);
      assert.equal(state.preview?.customerName, "Aisyah");
      assert.equal(state.preview?.problem, null);
    }
    assert.equal((await getVoucher(res.code))?.redeemed_at, null);
    assert.ok((await redeemVoucher(branchA, res.code)).ok);
  });

  test("after redeeming, scanning again shows it was already used", async () => {
    const res = await claimVoucher("a", "Ali", "0123456789");
    assert.ok(res.ok);
    await redeemVoucher(branchA, res.code);
    const state = await previewVoucher(branchA, res.code);
    assert.match(state.preview?.problem ?? "", /Already redeemed/);
    assert.equal((await redeemVoucher(branchA, res.code)).ok, false);
  });

  test("scanning at the wrong branch or after expiry is refused", async () => {
    const res = await claimVoucher("a", "Ali", "0123456789");
    assert.ok(res.ok);
    assert.match((await previewVoucher(branchB, res.code)).preview?.problem ?? "", /different branch/);
    assert.equal((await redeemVoucher(branchB, res.code)).ok, false);

    await db()`UPDATE review.vouchers SET expires_at = now() - interval '1 minute'`;
    assert.match((await previewVoucher(branchA, res.code)).preview?.problem ?? "", /Expired/);
    assert.equal((await redeemVoucher(branchA, res.code)).ok, false);
  });

  test("unknown or empty codes give an error, not a preview", async () => {
    const missing = await previewVoucher(branchA, "000000");
    assert.equal(missing.preview, undefined);
    assert.match(missing.error ?? "", /No voucher/);
    assert.match((await previewVoucher(branchA, "")).error ?? "", /No voucher/);
  });

  test("old letter codes still check and redeem, in any case", async () => {
    await db()`
      INSERT INTO review.vouchers (code, branch_id, customer_name, phone, reward_text, expires_at)
      VALUES ('K48MQ8', ${branchA}, 'Old', '60123456789', 'Free drink', now() + interval '1 hour')`;
    const state = await previewVoucher(branchA, "k48mq8");
    assert.equal(state.preview?.code, "K48MQ8");
    assert.equal(state.preview?.problem, null);
    assert.ok((await redeemVoucher(branchA, "k48mq8")).ok);
  });
});
