import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseScannedCode } from "../src/lib/code";

describe("parseScannedCode", () => {
  test("reads the staff link printed on vouchers", () => {
    assert.equal(parseScannedCode("https://khulafa.example/staff?code=482913"), "482913");
    assert.equal(parseScannedCode("https://khulafa.example/staff/?code=482913&x=1"), "482913");
    assert.equal(parseScannedCode("http://localhost:3000/staff?code=k48mq8"), "K48MQ8");
  });

  test("reads a voucher page link or a plain code", () => {
    assert.equal(parseScannedCode("https://khulafa.example/v/482913"), "482913");
    assert.equal(parseScannedCode("482913"), "482913");
    assert.equal(parseScannedCode("  482 913\n"), "482913");
    assert.equal(parseScannedCode("K48MQ8"), "K48MQ8");
  });

  test("rejects QR codes that aren't vouchers", () => {
    assert.equal(parseScannedCode("https://g.page/r/CedfAewEtJYHEBE/review"), null);
    assert.equal(parseScannedCode("https://khulafa.example/staff"), null);
    assert.equal(parseScannedCode("https://khulafa.example/staff?code="), null);
    assert.equal(parseScannedCode("https://khulafa.example/r/khulafa-bistro"), null);
    assert.equal(parseScannedCode("WIFI:S:Khulafa;T:WPA;P:secret;;"), null);
    assert.equal(parseScannedCode("javascript:alert(1)"), null);
    assert.equal(parseScannedCode("123"), null);
    assert.equal(parseScannedCode("Thank you for dining with us"), null);
    assert.equal(parseScannedCode(""), null);
  });
});
