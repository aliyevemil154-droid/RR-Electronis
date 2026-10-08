import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  readEngagementBody,
  saveInquiry,
  saveSubscriber,
  validateEmail,
  validateInquiry,
} from "../lib/engagement";

test("newsletter validates email and normalizes it", () => {
  assert.equal(validateEmail("  Shopper@Example.com "), "shopper@example.com");
  for (const value of [
    null,
    42,
    "a@b",
    "a\n@b.com",
    "x".repeat(255) + "@a.com",
  ])
    assert.throws(() => validateEmail(value));
});
test("inquiries reject malformed inputs without accepting controls", () => {
  assert.throws(() =>
    validateInquiry({
      name: "a",
      email: "a@b.com",
      message: "Long enough message",
    }),
  );
  assert.throws(() =>
    validateInquiry({ name: "Valid name", email: "a@b.com", message: "Short" }),
  );
  assert.throws(() =>
    validateInquiry({
      name: "Valid name",
      email: "a@b.com",
      message: "A null\u0000 message",
    }),
  );
});
test("engagement stores subscribers once and rate limits inquiry writes", () => {
  const dir = mkdtempSync(join(tmpdir(), "dubai-engagement-")),
    path = join(dir, "test.sqlite");
  try {
    assert.equal(saveSubscriber("a@b.com", path), true);
    assert.equal(saveSubscriber("a@b.com", path), false);
    const inquiry = validateInquiry({
      name: "Example Shopper",
      email: "a@b.com",
      message: "Please tell me more about this product.",
    });
    for (let i = 0; i < 3; i++) saveInquiry(inquiry, path);
    assert.throws(() => saveInquiry(inquiry, path), /wait a few minutes/);
    const db = new DatabaseSync(path);
    try {
      assert.equal(
        (
          db.prepare("SELECT COUNT(*) AS count FROM inquiries").get() as {
            count: number;
          }
        ).count,
        3,
      );
    } finally {
      db.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("public forms reject other origins, invalid JSON, and oversized bodies", async () => {
  const request = (body: string, origin = "https://bad.example") =>
    new Request("https://shop.example/api/newsletter", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        host: "shop.example",
        origin,
      },
      body,
    });
  await assert.rejects(
    () => readEngagementBody(request('{"email":"a@b.com"}')),
    /our website/,
  );
  await assert.rejects(
    () => readEngagementBody(request("broken", "https://shop.example")),
    /check your details/,
  );
  await assert.rejects(
    () => readEngagementBody(request("x".repeat(9000), "https://shop.example")),
    /too long/,
  );
});
