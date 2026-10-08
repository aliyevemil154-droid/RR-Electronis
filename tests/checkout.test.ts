import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type Stripe from "stripe";
import {
  checkoutIdempotencyKey,
  checkoutMetadata,
  paymentConfiguration,
  persistPaymentEvent,
  priceCheckout,
  stripeClient,
  stripeLineItems,
  validateCheckout,
} from "../lib/checkout";

const validInput = () => ({
  items: [{ id: "bose-qc45", quantity: 1 }],
  customer: {
    name: "Test Customer",
    email: "TEST@example.com",
    phone: "+994 50 123 45 67",
  },
  address: {
    line1: "12 Example Street",
    city: "Baku",
    country: "AZ",
    postalCode: "AZ1000",
  },
});

test("checkout validates and normalizes a Baku delivery", () => {
  const input = validateCheckout(validInput());
  assert.equal(input.customer.email, "test@example.com");
  assert.equal(input.address.city, "Baku");
  assert.equal(input.address.line2, "");
  assert.deepEqual(input.items, [{ id: "bose-qc45", quantity: 1 }]);
});

test("server pricing ignores client-supplied amounts and uses AZN minor units", () => {
  const input = validateCheckout({
    ...validInput(),
    items: [{ id: "bose-qc45", quantity: 1, price: 1 }],
  });
  const quote = priceCheckout(input, {});
  assert.equal(quote.subtotal, 549);
  assert.equal(quote.shipping, 35);
  assert.equal(quote.total, 584);
  const lineItem = stripeLineItems(quote.items)[0];
  assert.equal(lineItem.price_data?.unit_amount, 54900);
  assert.equal(lineItem.price_data?.currency, "azn");
});

test("sample shipping threshold and merchant overrides price consistently", () => {
  const input = validateCheckout({
    ...validInput(),
    items: [{ id: "iphone-16-pro", quantity: 1 }],
  });
  assert.equal(priceCheckout(input, {}).shipping, 0);
  assert.equal(
    priceCheckout(input, {
      SHIPPING_FEE_AZN: "42",
      FREE_SHIPPING_THRESHOLD_AZN: "3000",
    }).shipping,
    42,
  );
  assert.throws(
    () => priceCheckout(input, { SHIPPING_FEE_AZN: "not-a-number" }),
    /not available/,
  );
});

test("unknown products, duplicates and unsupported quantities are rejected", () => {
  for (const items of [
    [{ id: "nonexistent-product", quantity: 1 }],
    [{ id: "bose-qc45", quantity: 0 }],
    [{ id: "bose-qc45", quantity: -1 }],
    [{ id: "bose-qc45", quantity: 1.5 }],
    [{ id: "bose-qc45", quantity: 6 }],
    [{ id: "bose-qc45", quantity: "1" }],
    [
      { id: "bose-qc45", quantity: 1 },
      { id: "bose-qc45", quantity: 1 },
    ],
  ])
    assert.throws(() => validateCheckout({ ...validInput(), items }));
});

test("delivery outside Baku or Azerbaijan is rejected", () => {
  const input = validInput();
  assert.throws(
    () =>
      validateCheckout({
        ...input,
        address: { ...input.address, city: "Dubai" },
      }),
    /Baku/,
  );
  assert.throws(
    () =>
      validateCheckout({
        ...input,
        address: { ...input.address, country: "AE" },
      }),
    /Baku/,
  );
  assert.equal(
    validateCheckout({ ...input, address: { ...input.address, city: "Bakı" } })
      .address.city,
    "Baku",
  );
});

test("customer input requires valid contact and delivery details", () => {
  const input = validInput();
  assert.throws(
    () =>
      validateCheckout({
        ...input,
        customer: { ...input.customer, email: "not-an-email" },
      }),
    /email/,
  );
  assert.throws(
    () =>
      validateCheckout({
        ...input,
        customer: { ...input.customer, phone: "123abc456" },
      }),
    /phone/,
  );
  assert.throws(
    () =>
      validateCheckout({
        ...input,
        customer: { ...input.customer, name: "A\nB" },
      }),
    /full name/,
  );
  assert.throws(
    () =>
      validateCheckout({
        ...input,
        address: { ...input.address, postalCode: "XYZ" },
      }),
    /postal code/,
  );
});

test("payments fail closed until provider and a safe origin are configured", () => {
  const env = {
    PAYMENT_PROVIDER: "stripe",
    STRIPE_SECRET_KEY: "sk_test_example",
    STRIPE_WEBHOOK_SECRET: "whsec_example",
    APP_URL: "https://shop.example.com",
  };
  assert.deepEqual(paymentConfiguration(env), {
    secretKey: "sk_test_example",
    appUrl: "https://shop.example.com",
  });
  assert.equal(paymentConfiguration({}), null);
  assert.equal(paymentConfiguration({ ...env, PAYMENT_PROVIDER: "" }), null);
  assert.equal(paymentConfiguration({ ...env, STRIPE_SECRET_KEY: "" }), null);
  assert.equal(
    paymentConfiguration({ ...env, STRIPE_WEBHOOK_SECRET: "" }),
    null,
  );
  assert.equal(
    paymentConfiguration({
      ...env,
      STRIPE_SECRET_KEY: "sk_live_example",
      APP_URL: "http://localhost:3000",
    }),
    null,
  );
  assert.ok(
    paymentConfiguration({ ...env, STRIPE_SECRET_KEY: "sk_live_example" }),
  );
  for (const appUrl of [
    "http://shop.example.com",
    "https://user:password@shop.example.com",
    "https://shop.example.com/path",
    "https://shop.example.com?redirect=evil",
    "javascript:alert(1)",
  ]) {
    assert.equal(paymentConfiguration({ ...env, APP_URL: appUrl }), null);
  }
  assert.ok(paymentConfiguration({ ...env, APP_URL: "http://localhost:3000" }));
});

test("idempotency keys preserve retries without conflating different orders", () => {
  const input = validateCheckout(validInput());
  const key = "checkout_request_123456";
  assert.equal(
    checkoutIdempotencyKey(key, input),
    checkoutIdempotencyKey(key, input),
  );
  assert.notEqual(
    checkoutIdempotencyKey(key, input),
    checkoutIdempotencyKey(key, {
      ...input,
      items: [{ id: "bose-qc45", quantity: 2 }],
    }),
  );
  assert.equal(checkoutIdempotencyKey(null, input), undefined);
  assert.throws(() => checkoutIdempotencyKey("bad", input));
});

test("signed webhook verification rejects modified payloads", () => {
  const stripe = stripeClient("sk_test_example");
  const secret = "whsec_test_example";
  const payload = JSON.stringify({
    id: "evt_example",
    object: "event",
    type: "checkout.session.completed",
    data: { object: { id: "cs_example" } },
  });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  assert.equal(
    stripe.webhooks.constructEvent(payload, signature, secret).id,
    "evt_example",
  );
  assert.throws(() =>
    stripe.webhooks.constructEvent(
      payload.replace("cs_example", "cs_modified"),
      signature,
      secret,
    ),
  );
});

test("paid-order persistence atomically deduplicates receipts and session IDs", () => {
  const directory = mkdtempSync(join(tmpdir(), "dubai-orders-test-"));
  const dbPath = join(directory, "orders.sqlite");
  const input = validateCheckout(validInput());
  const event = {
    id: "evt_paid_1",
    type: "checkout.session.completed",
    created: 1770000000,
    data: {
      object: {
        id: "cs_test_order",
        payment_status: "paid",
        currency: "azn",
        amount_total: 58400,
        payment_intent: "pi_test_order",
        customer_email: "test@example.com",
        metadata: checkoutMetadata(input),
      },
    },
  } as unknown as Stripe.Event;
  try {
    assert.deepEqual(persistPaymentEvent(event, { ORDERS_DB_PATH: dbPath }), {
      recorded: true,
    });
    assert.deepEqual(persistPaymentEvent(event, { ORDERS_DB_PATH: dbPath }), {
      recorded: false,
    });
    assert.deepEqual(
      persistPaymentEvent(
        {
          ...event,
          id: "evt_paid_2",
          type: "checkout.session.async_payment_succeeded",
        } as Stripe.Event,
        { ORDERS_DB_PATH: dbPath },
      ),
      { recorded: true },
    );
    const db = new DatabaseSync(dbPath);
    try {
      assert.equal(
        (
          db.prepare("SELECT COUNT(*) AS count FROM orders").get() as {
            count: number;
          }
        ).count,
        1,
      );
      assert.equal(
        (
          db.prepare("SELECT COUNT(*) AS count FROM payment_events").get() as {
            count: number;
          }
        ).count,
        2,
      );
      assert.equal(
        (
          db.prepare("SELECT amount_total FROM orders").get() as {
            amount_total: number;
          }
        ).amount_total,
        58400,
      );
    } finally {
      db.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("unpaid or unrelated notifications never create a paid order", () => {
  const event = {
    id: "evt_unpaid",
    type: "checkout.session.completed",
    created: 1770000000,
    data: {
      object: {
        id: "cs_test_unpaid",
        payment_status: "unpaid",
        currency: "azn",
        metadata: { store: "dubai-electronics" },
      },
    },
  } as unknown as Stripe.Event;
  assert.deepEqual(persistPaymentEvent(event), { recorded: false });
  assert.deepEqual(
    persistPaymentEvent({
      ...event,
      type: "payment_intent.created",
    } as Stripe.Event),
    { recorded: false },
  );
});
