// Browser test of the voucher QR → /staff?code= flow against a running app.
//
//   E2E_BASE_URL=http://localhost:3000 E2E_STAFF_PIN=4821 npm run test:e2e
//
// Optional: E2E_BRANCH_SLUG (default khulafa-bistro), CHROMIUM_PATH (browser binary).
// It claims a real voucher on that branch with a random phone number and redeems it.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { chromium, type Browser, type Page } from "playwright-core";

const base = process.env.E2E_BASE_URL?.replace(/\/+$/, "");
const pin = process.env.E2E_STAFF_PIN;
const slug = process.env.E2E_BRANCH_SLUG || "khulafa-bistro";
const skip = !base || !pin ? "set E2E_BASE_URL and E2E_STAFF_PIN" : false;

let browser: Browser;
let customer: Page;
let code = "";
let branchName = "";
let staffUrl = "";

before(async () => {
  if (skip) return;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  customer = await browser.newPage({ viewport: { width: 390, height: 844 } });
});

after(async () => {
  await browser?.close();
});

async function customerVoucherText(): Promise<string> {
  await customer.reload();
  return (await customer.textContent(".voucher")) ?? "";
}

test("customer voucher shows a 6-digit code and a staff QR", { skip }, async () => {
  await customer.goto(`${base}/r/${slug}`);
  branchName = ((await customer.textContent("h1")) ?? "").trim();
  await customer.fill("#name", "E2E Tester");
  await customer.fill("#phone", "01" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0"));
  await customer.click("button[type=submit]");
  await customer.waitForURL(/\/v\//);

  code = ((await customer.textContent(".voucher .code")) ?? "").trim();
  assert.match(code, /^\d{6}$/);
  assert.equal(await customer.locator(".voucher-qr svg").count(), 1);
  staffUrl = (await customer.getAttribute(".voucher-qr", "data-staff-url")) ?? "";
  assert.ok(staffUrl.endsWith(`/staff?code=${code}`), staffUrl);
});

test("scanning without a staff login asks for the PIN and does not redeem", { skip }, async () => {
  const cashier = await browser.newPage();
  await cashier.goto(`${base}/staff?code=${code}`);
  assert.ok(await cashier.isVisible("#pin"));
  assert.ok(!(await cashier.isVisible("text=Redeem free drink")));
  assert.match(await customerVoucherText(), /Show this screen/);
  await cashier.close();
});

test("after PIN login the scanned code is checked, and only the Redeem tap redeems", { skip }, async () => {
  const context = await browser.newContext();
  const cashier = await context.newPage();
  await cashier.goto(`${base}/staff?code=${code}`);
  await cashier.selectOption("#branchId", { label: branchName });
  await cashier.fill("#pin", pin!);
  await cashier.click("button:has-text('Log in')");

  await cashier.waitForURL(`${base}/staff?code=${code}`);
  assert.equal(await cashier.inputValue("#code"), code);
  const redeemButton = cashier.locator("button:has-text('Redeem')");
  await redeemButton.waitFor();
  assert.match(await customerVoucherText(), /Show this screen/, "must not redeem before the tap");

  await redeemButton.click();
  await cashier.waitForSelector(".alert-ok");
  assert.match((await cashier.textContent(".alert-ok")) ?? "", new RegExp(`Redeemed ${code}`));
  assert.match(await customerVoucherText(), /Redeemed on/);

  // Logged in already: scanning the same QR again goes straight to the check.
  await cashier.goto(`${base}/staff?code=${code}`);
  await cashier.waitForSelector("text=Already redeemed");
  assert.equal(await cashier.locator("button:has-text('Redeem')").count(), 0);
  await context.close();
});

test("the QR disappears once the voucher is used", { skip }, async () => {
  await customer.reload();
  assert.equal(await customer.locator(".voucher-qr").count(), 0);
});
