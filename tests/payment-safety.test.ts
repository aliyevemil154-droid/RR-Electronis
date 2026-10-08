import test from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";
import {
  isStoreCheckoutSession,
  storePaymentStatus,
  webhookMatchesPaymentMode,
} from "../lib/checkout";
import { readLimitedBody, RequestBodyError } from "../lib/request";

function session(overrides: Partial<Stripe.Checkout.Session> = {}) {
  return {
    id: "cs_test_safety",
    mode: "payment",
    status: "complete",
    payment_status: "paid",
    currency: "azn",
    livemode: false,
    metadata: { store: "dubai-electronics" },
    ...overrides,
  } as Stripe.Checkout.Session;
}

test("payment lookups reject another store, currency, payment mode, or environment", () => {
  assert.equal(isStoreCheckoutSession(session(), "sk_test_example"), true);
  for (const invalid of [
    session({ metadata: {} }),
    session({ currency: "usd" }),
    session({ mode: "subscription" }),
    session({ livemode: true }),
  ]) {
    assert.equal(isStoreCheckoutSession(invalid, "sk_test_example"), false);
    assert.throws(
      () => storePaymentStatus(invalid, "sk_test_example"),
      /find this payment/,
    );
  }
});

test("paid status requires both a completed session and confirmed payment", () => {
  assert.equal(storePaymentStatus(session(), "sk_test_example"), "paid");
  assert.equal(
    storePaymentStatus(session({ status: "open" }), "sk_test_example"),
    "pending",
  );
  assert.equal(
    storePaymentStatus(
      session({ payment_status: "unpaid" }),
      "sk_test_example",
    ),
    "pending",
  );
  assert.equal(
    storePaymentStatus(
      session({ status: "expired", payment_status: "unpaid" }),
      "sk_test_example",
    ),
    "expired",
  );
});

test("a signed event must match the selected live or test payment environment", () => {
  const event = {
    type: "checkout.session.completed",
    livemode: false,
    data: { object: session() },
  } as Stripe.Event;
  assert.equal(webhookMatchesPaymentMode(event, "sk_test_example"), true);
  assert.equal(webhookMatchesPaymentMode(event, "sk_live_example"), false);
  assert.equal(
    webhookMatchesPaymentMode(
      { ...event, livemode: true } as Stripe.Event,
      "sk_live_example",
    ),
    false,
  );
  assert.equal(
    webhookMatchesPaymentMode(
      {
        ...event,
        livemode: true,
        data: { object: session({ livemode: true }) },
      } as Stripe.Event,
      "sk_live_example",
    ),
    true,
  );
});

test("request limits count actual UTF-8 bytes and preserve signature input", async () => {
  const text = "hello 😀";
  const request = () =>
    new Request("https://shop.example/api", { method: "POST", body: text });
  assert.deepEqual(
    await readLimitedBody(request(), Buffer.byteLength(text)),
    Buffer.from(text),
  );
  await assert.rejects(
    () => readLimitedBody(request(), text.length),
    (error) => error instanceof RequestBodyError && error.status === 413,
  );
});

test("chunked oversized requests stop reading and cancel the source", async () => {
  let cancelled = false,
    reads = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      reads++;
      controller.enqueue(new Uint8Array(8));
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request("https://shop.example/api", {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit);
  await assert.rejects(
    () => readLimitedBody(request, 10),
    (error) => error instanceof RequestBodyError && error.status === 413,
  );
  assert.equal(cancelled, true);
  assert.ok(reads <= 3);
});

test("declared oversized bodies are rejected before consumption", async () => {
  const request = new Request("https://shop.example/api", {
    method: "POST",
    headers: { "Content-Length": "9999" },
    body: "small body",
  });
  await assert.rejects(
    () => readLimitedBody(request, 32),
    (error) => error instanceof RequestBodyError && error.status === 413,
  );
});
