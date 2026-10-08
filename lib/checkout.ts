import Stripe from "stripe";
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getProduct, type Product } from "./catalog";

export const CHECKOUT_UNAVAILABLE =
  "Online payments are not available yet. Please try again later.";

export class CheckoutError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

export interface CheckoutInput {
  items: { id: string; quantity: number }[];
  customer: { name: string; email: string; phone: string };
  address: {
    line1: string;
    line2: string;
    city: "Baku";
    postalCode: string;
    country: "AZ";
  };
}

type Environment = Record<string, string | undefined>;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CheckoutError(
      "Please check your checkout details and try again.",
    );
  }
  return value as Record<string, unknown>;
}

function cleanString(
  value: unknown,
  label: string,
  min: number,
  max: number,
): string {
  if (typeof value !== "string")
    throw new CheckoutError(`Please enter ${label}.`);
  const text = value.trim();
  if (
    text.length < min ||
    text.length > max ||
    /[\u0000-\u001f\u007f]/.test(text)
  ) {
    throw new CheckoutError(`Please enter a valid ${label}.`);
  }
  return text;
}

export function validateCheckout(value: unknown): CheckoutInput {
  const input = record(value);
  if (
    !Array.isArray(input.items) ||
    input.items.length < 1 ||
    input.items.length > 6
  ) {
    throw new CheckoutError(
      "Please add a product to your bag before checking out.",
    );
  }
  const seen = new Set<string>();
  const items = input.items.map((value) => {
    const item = record(value);
    const id = cleanString(item.id, "product", 1, 80);
    if (!getProduct(id))
      throw new CheckoutError(
        "One of your selected products is no longer available.",
      );
    if (seen.has(id))
      throw new CheckoutError("Please review the quantities in your bag.");
    seen.add(id);
    if (
      typeof item.quantity !== "number" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 5
    ) {
      throw new CheckoutError("You can order between 1 and 5 of each product.");
    }
    return { id, quantity: item.quantity };
  });
  const customer = record(input.customer);
  const email = cleanString(
    customer.email,
    "email address",
    3,
    254,
  ).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new CheckoutError("Please enter a valid email address.");
  const phone = cleanString(customer.phone, "phone number", 7, 24);
  if (
    !/^\+?[\d\s()-]+$/.test(phone) ||
    phone.replace(/\D/g, "").length < 7 ||
    phone.replace(/\D/g, "").length > 15
  ) {
    throw new CheckoutError("Please enter a valid phone number.");
  }
  const address = record(input.address);
  const city = cleanString(address.city, "city", 2, 60);
  if (!/^(baku|bakı|baki)$/i.test(city) || address.country !== "AZ") {
    throw new CheckoutError(
      "Delivery is currently available to Baku, Azerbaijan.",
    );
  }
  const postalCode =
    address.postalCode === undefined || address.postalCode === ""
      ? ""
      : cleanString(address.postalCode, "postal code", 4, 6).toUpperCase();
  if (postalCode && !/^(AZ)?\d{4}$/.test(postalCode))
    throw new CheckoutError("Please enter a valid Azerbaijan postal code.");
  return {
    items,
    customer: {
      name: cleanString(customer.name, "full name", 2, 100),
      email,
      phone,
    },
    address: {
      line1: cleanString(address.line1, "delivery address", 5, 180),
      line2:
        address.line2 === undefined || address.line2 === ""
          ? ""
          : cleanString(address.line2, "apartment or building details", 1, 180),
      city: "Baku",
      postalCode,
      country: "AZ",
    },
  };
}

function configuredWholeAmount(
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined || value === "") return fallback;
  if (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) > 100000
  ) {
    throw new CheckoutError(CHECKOUT_UNAVAILABLE, 503);
  }
  return Number(value);
}

export function priceCheckout(
  input: Pick<CheckoutInput, "items">,
  env: Environment = process.env,
) {
  const items = input.items.map((item) => {
    const product = getProduct(item.id);
    if (!product)
      throw new CheckoutError(
        "One of your selected products is no longer available.",
      );
    return { product, quantity: item.quantity };
  });
  const subtotal = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );
  const policy = shippingPolicy(env);
  const shipping =
    subtotal >= policy.freeShippingThreshold ? 0 : policy.shippingFee;
  return {
    items,
    subtotal,
    shipping,
    total: subtotal + shipping,
    currency: "AZN" as const,
  };
}

export function shippingPolicy(env: Environment = process.env) {
  // Demonstration delivery policy; the merchant must approve it before accepting payments.
  return {
    shippingFee: configuredWholeAmount(env.SHIPPING_FEE_AZN, 35),
    freeShippingThreshold: configuredWholeAmount(
      env.FREE_SHIPPING_THRESHOLD_AZN,
      1500,
    ),
  };
}

export function paymentConfiguration(
  env: Environment = process.env,
): { secretKey: string; appUrl: string } | null {
  if (
    env.PAYMENT_PROVIDER !== "stripe" ||
    !env.STRIPE_SECRET_KEY ||
    !/^sk_(test|live)_/.test(env.STRIPE_SECRET_KEY) ||
    !env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_") ||
    !env.APP_URL
  )
    return null;
  try {
    const url = new URL(env.APP_URL);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    const testMode = env.STRIPE_SECRET_KEY.startsWith("sk_test_");
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol !== "https:" &&
        !(testMode && url.protocol === "http:" && local))
    )
      return null;
    if (url.pathname !== "/") return null;
    return { secretKey: env.STRIPE_SECRET_KEY, appUrl: url.origin };
  } catch {
    return null;
  }
}

export function requirePaymentConfiguration() {
  const configuration = paymentConfiguration();
  if (!configuration) throw new CheckoutError(CHECKOUT_UNAVAILABLE, 503);
  return configuration;
}

export function stripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 20000 });
}

const paymentEventTypes = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
];

export function webhookMatchesPaymentMode(
  event: Stripe.Event,
  secretKey: string,
): boolean {
  const live = secretKey.startsWith("sk_live_");
  if (event.livemode !== live) return false;
  return (
    !paymentEventTypes.includes(event.type) ||
    (event.data.object as Stripe.Checkout.Session).livemode === live
  );
}

export function isStoreCheckoutSession(
  session: Stripe.Checkout.Session,
  secretKey: string,
): boolean {
  return (
    session.metadata?.store === "dubai-electronics" &&
    session.mode === "payment" &&
    session.currency === "azn" &&
    session.livemode === secretKey.startsWith("sk_live_")
  );
}

export function storePaymentStatus(
  session: Stripe.Checkout.Session,
  secretKey: string,
): "paid" | "pending" | "expired" {
  if (!isStoreCheckoutSession(session, secretKey))
    throw new CheckoutError("We couldn't find this payment.", 404);
  if (session.status === "complete" && session.payment_status === "paid")
    return "paid";
  return session.status === "expired" ? "expired" : "pending";
}

export function checkoutIdempotencyKey(
  key: string | null,
  input: CheckoutInput,
): string | undefined {
  if (key === null) return undefined;
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(key))
    throw new CheckoutError("Please refresh checkout and try again.");
  return createHash("sha256")
    .update(key)
    .update(JSON.stringify(input))
    .digest("hex");
}

export function stripeLineItems(
  items: { product: Product; quantity: number }[],
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  return items.map(({ product, quantity }) => ({
    quantity,
    price_data: {
      currency: "azn",
      unit_amount: product.price * 100,
      product_data: {
        name: product.name,
        description: product.subtitle,
        metadata: { product_id: product.id },
      },
    },
  }));
}

export function checkoutMetadata(input: CheckoutInput): Record<string, string> {
  return {
    store: "dubai-electronics",
    items: JSON.stringify(input.items),
    customer_name: input.customer.name,
    customer_phone: input.customer.phone,
    delivery_line1: input.address.line1,
    delivery_line2: input.address.line2,
    delivery_city: "Baku",
    delivery_postal_code: input.address.postalCode,
    delivery_country: "AZ",
  };
}

// Only signed Stripe webhooks call this function. Event receipt and order are committed together.
export function persistPaymentEvent(
  event: Stripe.Event,
  env: Environment = process.env,
): { recorded: boolean } {
  if (!paymentEventTypes.includes(event.type)) return { recorded: false };
  const session = event.data.object as Stripe.Checkout.Session;
  if (
    session.payment_status !== "paid" ||
    session.metadata?.store !== "dubai-electronics" ||
    session.currency !== "azn"
  )
    return { recorded: false };
  const dbPath =
    env.ORDERS_DB_PATH || join(process.cwd(), ".data", "orders.sqlite");
  mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(dbPath);
  try {
    chmodSync(dbPath, 0o600);
    db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
    db.exec(`
      CREATE TABLE IF NOT EXISTS payment_events (
        event_id TEXT PRIMARY KEY,
        received_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS orders (
        checkout_session_id TEXT PRIMARY KEY,
        payment_intent_id TEXT,
        amount_total INTEGER NOT NULL,
        currency TEXT NOT NULL,
        customer_email TEXT,
        details_json TEXT NOT NULL,
        paid_at TEXT NOT NULL
      );
    `);
    db.exec("BEGIN IMMEDIATE");
    const receipt = db
      .prepare(
        "INSERT OR IGNORE INTO payment_events (event_id, received_at) VALUES (?, ?)",
      )
      .run(event.id, new Date().toISOString());
    if (receipt.changes === 0) {
      db.exec("COMMIT");
      return { recorded: false };
    }
    db.prepare(
      `INSERT OR IGNORE INTO orders
      (checkout_session_id, payment_intent_id, amount_total, currency, customer_email, details_json, paid_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      session.id,
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || null,
      session.amount_total ?? 0,
      session.currency,
      session.customer_details?.email || session.customer_email || null,
      JSON.stringify(session.metadata),
      new Date(event.created * 1000).toISOString(),
    );
    db.exec("COMMIT");
    return { recorded: true };
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* No transaction is active if initialization failed. */
    }
    throw error;
  } finally {
    db.close();
  }
}
