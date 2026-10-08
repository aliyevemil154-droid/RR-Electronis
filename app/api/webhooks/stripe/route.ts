import { NextResponse } from "next/server";
import {
  isStoreCheckoutSession,
  paymentConfiguration,
  persistPaymentEvent,
  storePaymentStatus,
  stripeClient,
  webhookMatchesPaymentMode,
} from "@/lib/checkout";
import { readLimitedBody, RequestBodyError } from "@/lib/request";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const configuration = paymentConfiguration();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!configuration || !webhookSecret?.startsWith("whsec_")) {
    return NextResponse.json(
      { error: "Payment notifications are unavailable." },
      { status: 503 },
    );
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature)
    return NextResponse.json(
      { error: "Invalid payment notification." },
      { status: 400 },
    );
  let event;
  try {
    const body = await readLimitedBody(request, 1048576);
    event = stripeClient(configuration.secretKey).webhooks.constructEvent(
      body,
      signature,
      webhookSecret,
    );
  } catch (error) {
    if (error instanceof RequestBodyError && error.status === 413)
      return NextResponse.json(
        { error: "Notification is too large." },
        { status: 413 },
      );
    return NextResponse.json(
      { error: "Invalid payment notification." },
      { status: 400 },
    );
  }
  if (!webhookMatchesPaymentMode(event, configuration.secretKey)) {
    return NextResponse.json(
      { error: "Invalid payment notification." },
      { status: 400 },
    );
  }
  if (
    [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
    ].includes(event.type)
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (
      !isStoreCheckoutSession(session, configuration.secretKey) ||
      storePaymentStatus(session, configuration.secretKey) !== "paid"
    ) {
      return NextResponse.json({ received: true, recorded: false });
    }
  }
  try {
    const result = persistPaymentEvent(event);
    return NextResponse.json({ received: true, recorded: result.recorded });
  } catch {
    console.error("A verified payment notification could not be saved.");
    // Stripe retries non-2xx responses. Never acknowledge an order that was not committed.
    return NextResponse.json(
      { error: "Payment notification could not be saved." },
      { status: 500 },
    );
  }
}
