import { NextResponse } from "next/server";
import {
  CheckoutError,
  requirePaymentConfiguration,
  storePaymentStatus,
  stripeClient,
} from "@/lib/checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const configuration = requirePaymentConfiguration();
    const sessionId = new URL(request.url).searchParams.get("session_id");
    if (
      !sessionId ||
      !/^cs_(test_|live_)?[A-Za-z0-9]{20,240}$/.test(sessionId)
    ) {
      throw new CheckoutError(
        "We couldn't find this payment. Please check the link.",
      );
    }
    const session = await stripeClient(
      configuration.secretKey,
    ).checkout.sessions.retrieve(sessionId);
    const status = storePaymentStatus(session, configuration.secretKey);
    return NextResponse.json(
      {
        status,
        orderId: status === "paid" ? session.id : undefined,
        total:
          session.amount_total === null ? null : session.amount_total / 100,
        currency: session.currency?.toUpperCase() || "AZN",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof CheckoutError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    console.error("Payment status lookup failed.");
    return NextResponse.json(
      {
        error: "We couldn't verify your payment yet. Please try again shortly.",
      },
      { status: 502 },
    );
  }
}
