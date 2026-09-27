// Review-tap tracking (/api/track) and the review link on vouchers.
// Needs an empty throwaway database, like the other DB tests.
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join } from "path";
import { POST } from "../src/app/api/track/route";
import { db } from "../src/lib/db";
import { claimVoucher, getVoucher } from "../src/lib/vouchers";

const url = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL = url;

const REVIEW_URL = "https://g.page/r/CedfAewEtJYHEBE/review";

function track(body: unknown) {
  return POST(
    new Request("http://localhost/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

async function reviewClicks(): Promise<number> {
  const [{ count }] = await db()`
    SELECT count(*)::int AS count FROM review.events WHERE type = 'review_click'`;
  return count;
}

describe("review tracking", { skip: !url && "TEST_DATABASE_URL not set" }, () => {
  before(async () => {
    const sql = db();
    await sql`DROP SCHEMA IF EXISTS review CASCADE`;
    await sql.unsafe(readFileSync(join(__dirname, "..", "db", "schema.sql"), "utf8"));
  });

  beforeEach(async () => {
    const sql = db();
    await sql`TRUNCATE review.events, review.vouchers, review.branches RESTART IDENTITY CASCADE`;
    await sql`
      INSERT INTO review.branches (slug, name, google_review_url)
      VALUES ('a', 'Branch A', ${REVIEW_URL}), ('b', 'Branch B', '')`;
  });

  after(async () => {
    await db().end();
  });

  test("vouchers carry their branch's Google review link", async () => {
    const a = await claimVoucher("a", "Ali", "0123456789");
    const b = await claimVoucher("b", "Ali", "0123456789");
    assert.ok(a.ok && b.ok);
    assert.equal((await getVoucher(a.code))?.branch_review_url, REVIEW_URL);
    assert.equal((await getVoucher(b.code))?.branch_review_url, "");
  });

  test("a review tap from the voucher screen is recorded for its branch", async () => {
    const res = await track({ slug: "a", type: "review_click" });
    assert.equal(res.status, 204);
    const rows = await db()`
      SELECT b.slug FROM review.events e JOIN review.branches b ON b.id = e.branch_id
      WHERE e.type = 'review_click'`;
    assert.deepEqual(rows.map((r) => r.slug), ["a"]);
  });

  test("bad tracking requests are ignored without failing", async () => {
    await db()`UPDATE review.branches SET active = false WHERE slug = 'b'`;
    for (const body of [
      { slug: "nope", type: "review_click" },
      { slug: "b", type: "review_click" },
      { slug: "a", type: "scan" },
      { slug: 5, type: "review_click" },
      "not json",
    ]) {
      assert.equal((await track(body)).status, 204);
    }
    assert.equal(await reviewClicks(), 0);
  });
});
