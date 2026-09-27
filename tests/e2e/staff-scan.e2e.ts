// Browser test of the in-page "Scan QR" button on /staff, using Chromium's fake
// camera to show a real voucher QR. Runs with Android Chrome and Samsung Internet
// phone profiles (same Chromium engine, their user agents and screen sizes).
//
//   E2E_BASE_URL=http://localhost:3000 E2E_STAFF_PIN=4821 npm run test:e2e
//
// Optional: E2E_BRANCH_SLUG (default khulafa-bistro), CHROMIUM_PATH (browser binary).
// It claims and redeems real vouchers, so point it at a local or test copy.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { chromium, type Browser, type BrowserContextOptions } from "playwright-core";
import { writeQrVideo } from "./fake-camera";

const base = process.env.E2E_BASE_URL?.replace(/\/+$/, "");
const pin = process.env.E2E_STAFF_PIN;
const slug = process.env.E2E_BRANCH_SLUG || "khulafa-bistro";
const skip = !base || !pin ? "set E2E_BASE_URL and E2E_STAFF_PIN" : false;
const executablePath = process.env.CHROMIUM_PATH || undefined;

const PHONES: Record<string, BrowserContextOptions> = {
  "Android Chrome": {
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
  },
  "Samsung Internet": {
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
};

let dir: string;
let helper: Browser;
let branchName = "";

before(async () => {
  if (skip) return;
  dir = mkdtempSync(join(tmpdir(), "khulafa-scan-"));
  helper = await chromium.launch({ executablePath });
});

after(async () => {
  await helper?.close();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

/** Claims a voucher as a customer; returns its code and staff QR link. */
async function claimVoucher(): Promise<{ code: string; staffUrl: string; voucherUrl: string }> {
  const page = await helper.newPage();
  await page.goto(`${base}/r/${slug}`);
  branchName = ((await page.textContent("h1")) ?? "").trim();
  await page.fill("#name", "Scan Tester");
  await page.fill("#phone", "01" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0"));
  await page.click("button[type=submit]");
  await page.waitForURL(/\/v\//);
  const code = ((await page.textContent(".voucher .code")) ?? "").trim();
  const staffUrl = (await page.getAttribute(".voucher-qr", "data-staff-url")) ?? "";
  const voucherUrl = page.url();
  await page.close();
  return { code, staffUrl, voucherUrl };
}

async function voucherStatus(voucherUrl: string): Promise<string> {
  const page = await helper.newPage();
  await page.goto(voucherUrl);
  const text = (await page.textContent(".voucher")) ?? "";
  await page.close();
  return text;
}

/** Launches a phone browser whose camera shows a QR with `qrText`, logged in as staff. */
async function staffPhone(phone: string, qrText: string, grantCamera = true) {
  const video = join(dir, `${phone.replace(/\W/g, "")}-${Date.now()}.y4m`);
  writeQrVideo(video, qrText);
  const browser = await chromium.launch({
    executablePath,
    args: [
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${video}`,
      // Without a grant, answer the camera prompt with "Block", like a cashier would.
      ...(grantCamera ? [] : ["--deny-permission-prompts"]),
    ],
  });
  const context = await browser.newContext(PHONES[phone]);
  if (grantCamera) await context.grantPermissions(["camera"], { origin: base });
  const page = await context.newPage();
  await page.goto(`${base}/staff`);
  await page.selectOption("#branchId", { label: branchName });
  await page.fill("#pin", pin!);
  await page.click("button:has-text('Log in')");
  await page.waitForSelector("button:has-text('Scan QR')");
  return { browser, page };
}

for (const phone of Object.keys(PHONES)) {
  describe(phone, { skip }, () => {
    test("Scan QR reads the voucher link, checks it, and waits for the Redeem tap", async () => {
      const voucher = await claimVoucher();
      const { browser, page } = await staffPhone(phone, voucher.staffUrl);
      try {
        await page.tap("button:has-text('Scan QR')");
        const redeem = page.locator("button:has-text('Redeem')");
        await redeem.waitFor({ timeout: 15_000 });

        assert.equal(await page.inputValue("#code"), voucher.code);
        assert.match((await page.textContent(".card .card")) ?? "", /Scan Tester/);
        assert.equal(await page.locator(".scanner-view video").isVisible(), false, "camera closes after a read");
        assert.match(await voucherStatus(voucher.voucherUrl), /Show this screen/, "scan alone must not redeem");

        await redeem.tap();
        await page.waitForSelector(".alert-ok");
        assert.match(await voucherStatus(voucher.voucherUrl), /Redeemed on/);
      } finally {
        await browser.close();
      }
    });

    test("a QR holding just the code works too", async () => {
      const voucher = await claimVoucher();
      const { browser, page } = await staffPhone(phone, voucher.code);
      try {
        await page.tap("button:has-text('Scan QR')");
        await page.locator("button:has-text('Redeem')").waitFor({ timeout: 15_000 });
        assert.equal(await page.inputValue("#code"), voucher.code);
      } finally {
        await browser.close();
      }
    });

    test("a QR that isn't a voucher keeps scanning and says so", async () => {
      const { browser, page } = await staffPhone(phone, "https://g.page/r/CedfAewEtJYHEBE/review");
      try {
        await page.tap("button:has-text('Scan QR')");
        await page.waitForSelector("text=isn't a voucher", { timeout: 15_000 });
        assert.ok(await page.locator(".scanner-view video").isVisible());
        await page.tap("button:has-text('Cancel')");
        assert.ok(await page.isVisible("button:has-text('Scan QR')"));
        assert.equal(await page.inputValue("#code"), "");
      } finally {
        await browser.close();
      }
    });

    test("denied camera permission shows a clear message and typing still works", async () => {
      const voucher = await claimVoucher();
      const { browser, page } = await staffPhone(phone, voucher.staffUrl, false);
      try {
        await page.tap("button:has-text('Scan QR')");
        const alert = page.locator(".scanner .alert-error");
        await alert.waitFor({ timeout: 15_000 });
        assert.match((await alert.textContent()) ?? "", /Camera permission is blocked/);

        await page.fill("#code", voucher.code);
        await page.tap("button:has-text('Check code')");
        await page.locator("button:has-text('Redeem')").waitFor();
        assert.match(await voucherStatus(voucher.voucherUrl), /Show this screen/);
      } finally {
        await browser.close();
      }
    });
  });
}
