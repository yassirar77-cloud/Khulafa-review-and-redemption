// Browser test of the customer flow: free drink form first, and the Google
// review button offered only on the voucher screen, never as a condition.
//
//   E2E_BASE_URL=http://localhost:3000 npm run test:e2e
//
// Optional: E2E_BRANCH_SLUG (default khulafa-bistro; must have a Google review
// link set), CHROMIUM_PATH (browser binary). It claims a real voucher.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { chromium, type Browser, type Page } from "playwright-core";

const base = process.env.E2E_BASE_URL?.replace(/\/+$/, "");
const slug = process.env.E2E_BRANCH_SLUG || "khulafa-bistro";
const skip = !base ? "set E2E_BASE_URL" : false;

let browser: Browser;
let page: Page;

before(async () => {
  if (skip) return;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  // Don't actually open Google from the test.
  await context.route(/^https:\/\/(g\.page|search\.google\.com)\//, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<title>Google review</title>" }),
  );
  page = await context.newPage();
});

after(async () => {
  await browser?.close();
});

test("the customer page opens with the free drink form and no review button", { skip }, async () => {
  await page.goto(`${base}/r/${slug}`);
  const firstCard = page.locator("main section.card").first();
  assert.match((await firstCard.textContent()) ?? "", /on us/);
  assert.ok(await firstCard.locator("#name").isVisible());
  assert.match((await firstCard.textContent()) ?? "", /No review needed/);
  assert.equal(await page.locator("a.btn-google").count(), 0);
  assert.doesNotMatch((await page.textContent("main")) ?? "", /review (us )?(to|for|and get)/i);
});

test("after claiming, the review button sits under the QR and taps are tracked", { skip }, async () => {
  await page.fill("#name", "Review Tester");
  await page.fill("#phone", "01" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0"));
  await page.click("button[type=submit]");
  await page.waitForURL(/\/v\//);

  const review = page.locator(".voucher .voucher-review");
  assert.match((await review.textContent()) ?? "", /While you wait, tell us how we did on Google/);
  assert.match((await review.textContent()) ?? "", /yours either way/);
  const button = review.locator("a.btn-google");
  assert.match((await button.textContent()) ?? "", /Review us on Google/);
  assert.match((await button.getAttribute("href")) ?? "", /^https:\/\//);

  // The button comes after the QR code inside the voucher.
  const order = await page.evaluate(() => {
    const qr = document.querySelector(".voucher .voucher-qr");
    const btn = document.querySelector(".voucher .voucher-review a.btn-google");
    return qr && btn ? qr.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING : 0;
  });
  assert.ok(order, "review button should be under the QR code");

  const beacon = page.waitForRequest(
    (r) => r.url().endsWith("/api/track") && r.method() === "POST",
  );
  const popup = page.waitForEvent("popup");
  await button.tap();
  const sent = JSON.parse((await beacon).postData() ?? "{}");
  assert.deepEqual(sent, { slug, type: "review_click" });
  await (await popup).close();

  // Reviewing (or not) doesn't change the voucher.
  assert.match((await page.textContent(".voucher")) ?? "", /Show this screen/);
});
