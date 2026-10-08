import { NextResponse } from "next/server";
import {
  CheckoutError,
  CHECKOUT_UNAVAILABLE,
  checkoutIdempotencyKey,
  checkoutMetadata,
  paymentConfiguration,
  priceCheckout,
  requirePaymentConfiguration,
  stripeClient,
  shippingPolicy,
  stripeLineItems,
  validateCheckout,
} from "@/lib/checkout";
import { readLimitedBody, RequestBodyError } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  try {
    return NextResponse.json(
      { configured: paymentConfiguration() !== null, ...shippingPolicy() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { configured: false, ...shippingPolicy({}) },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  try {
    const configuration = requirePaymentConfiguration();
    const origin = request.headers.get("origin");
    if (origin && origin !== configuration.appUrl)
      throw new CheckoutError("Please open checkout from our website.", 403);
    if (!request.headers.get("content-type")?.includes("application/json"))
      throw new CheckoutError(
        "Please check your checkout details and try again.",
      );
    const body = (await readLimitedBody(request, 16384)).toString("utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new CheckoutError(
        "Please check your checkout details and try again.",
      );
    }
    const input = validateCheckout(parsed);
    const quote = priceCheckout(input);
    const idempotencyKey = checkoutIdempotencyKey(
      request.headers.get("idempotency-key"),
      input,
    );
    const stripe = stripeClient(configuration.secretKey);
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: input.customer.email,
        line_items: stripeLineItems(quote.items),
        shipping_options: [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              fixed_amount: { amount: quote.shipping * 100, currency: "azn" },
              display_name: "Dubai to Baku delivery",
            },
          },
        ],
        metadata: checkoutMetadata(input),
        payment_intent_data: { metadata: { store: "dubai-electronics" } },
        success_url: `${configuration.appUrl}/order?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${configuration.appUrl}/checkout?cancelled=1`,
        expires_at: Math.floor(Date.now() / 1000) + 1800,
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    );
    if (!session.url) throw new CheckoutError(CHECKOUT_UNAVAILABLE, 503);
    return NextResponse.json(
      { url: session.url, sessionId: session.id },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof RequestBodyError)
      return NextResponse.json(
        { error: "Please check your checkout details and try again." },
        { status: error.status },
      );
    if (error instanceof CheckoutError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    console.error("Checkout provider request failed.");
    return NextResponse.json(
      { error: "We couldn't start your payment. Please try again shortly." },
      { status: 502 },
    );
  }
}
