"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CircleAlert,
  LoaderCircle,
  PackageCheck,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { CheckoutHeader } from "./checkout";

type PaymentState = "loading" | "paid" | "pending" | "expired" | "error";
type CartItem = { id: string; quantity: number };

function isCartItem(value: unknown): value is CartItem {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "quantity" in value &&
    typeof value.quantity === "number" &&
    Number.isInteger(value.quantity) &&
    value.quantity > 0 &&
    value.quantity <= 5
  );
}

function reconcilePurchasedItems(sessionId: string) {
  try {
    const pending: unknown = JSON.parse(
      sessionStorage.getItem("dubai-electronics-pending-checkout") || "null",
    );
    if (
      typeof pending !== "object" ||
      pending === null ||
      !("sessionId" in pending) ||
      pending.sessionId !== sessionId ||
      !("items" in pending) ||
      !Array.isArray(pending.items) ||
      !pending.items.every(isCartItem)
    )
      return;
    const current: unknown = JSON.parse(
      localStorage.getItem("dubai-electronics-cart") || "[]",
    );
    if (!Array.isArray(current) || !current.every(isCartItem)) return;
    const purchased = new Map(
      pending.items.map((item) => [item.id, item.quantity]),
    );
    const remaining = current
      .map((item) => ({
        ...item,
        quantity: Math.max(0, item.quantity - (purchased.get(item.id) || 0)),
      }))
      .filter((item) => item.quantity > 0);
    localStorage.setItem("dubai-electronics-cart", JSON.stringify(remaining));
    sessionStorage.removeItem("dubai-electronics-pending-checkout");
    window.dispatchEvent(new Event("cart-updated"));
  } catch {
    /* Keep the bag intact if storage cannot safely be read or updated. */
  }
}

export default function OrderStatus() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [state, setState] = useState<PaymentState>("loading");
  const [message, setMessage] = useState("");
  const [reference, setReference] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    if (!sessionId) {
      setState("error");
      setMessage(
        "Open the order confirmation link from your checkout to see your payment status.",
      );
      return;
    }
    setState("loading");
    fetch(`/api/orders/status?session_id=${encodeURIComponent(sessionId)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "We couldn’t verify this payment.");
        return data;
      })
      .then((data) => {
        if (!active) return;
        if (data.status === "paid" || data.paymentStatus === "paid") {
          setState("paid");
          setReference(data.reference || data.orderId || "");
          reconcilePurchasedItems(sessionId);
        } else if (data.status === "expired") {
          setState("expired");
        } else {
          setState("pending");
        }
      })
      .catch((cause) => {
        if (active) {
          setState("error");
          setMessage(
            cause instanceof Error
              ? cause.message
              : "We couldn’t verify this payment. Please try again.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [sessionId, attempt]);

  return (
    <div className="checkout-shell">
      <CheckoutHeader />
      <main className="order-main">
        <span className="checkout-eyebrow">DUBAI ELECTRONICS</span>
        <section className="order-status-card">
          <div className={`order-status-icon order-status-${state}`}>
            {state === "loading" ? (
              <LoaderCircle
                className="checkout-spin"
                size={35}
                strokeWidth={1.5}
              />
            ) : state === "paid" ? (
              <Check size={38} strokeWidth={1.5} />
            ) : state === "pending" ? (
              <LoaderCircle size={35} strokeWidth={1.5} />
            ) : (
              <CircleAlert size={35} strokeWidth={1.5} />
            )}
          </div>
          <span className="order-status-tag">
            {state === "loading"
              ? "One moment"
              : state === "paid"
                ? "Payment confirmed"
                : state === "pending"
                  ? "Payment processing"
                  : state === "expired"
                    ? "Checkout expired"
                    : "Payment status"}
          </span>
          <h1>
            {state === "loading" ? (
              <>
                A quick check.
                <br />
                <em>Then you’re all set.</em>
              </>
            ) : state === "paid" ? (
              <>
                Thank you.
                <br />
                <em>Payment received.</em>
              </>
            ) : state === "pending" ? (
              <>
                A little patience.
                <br />
                <em>We’re checking your payment.</em>
              </>
            ) : (
              <>
                Let’s check
                <br />
                <em>your order.</em>
              </>
            )}
          </h1>
          <p className="order-status-description">
            {state === "loading"
              ? "We’re securely verifying your payment with our payment provider."
              : state === "paid"
                ? "Your payment has been verified. Thank you for choosing Dubai Electronics. Keep your payment confirmation for your records."
                : state === "pending"
                  ? "Your payment hasn’t been confirmed yet. If you’ve completed payment, it may take a moment to appear. Check again before placing another order."
                  : state === "expired"
                    ? "This checkout session has expired. Your bag is still saved. Return to checkout to start a new payment."
                    : message}
          </p>
          {state === "paid" && (
            <>
              <div className="order-route">
                <span>
                  <PackageCheck size={22} /> Dubai
                </span>
                <div>
                  <span />
                  <Truck size={20} />
                  <span />
                </div>
                <span>
                  <span className="order-destination-dot" /> Baku
                </span>
              </div>
              {reference && (
                <p className="order-reference">
                  Order reference <strong>{reference}</strong>
                </p>
              )}
            </>
          )}
          {(state === "pending" || (state === "error" && sessionId)) && (
            <button
              type="button"
              className="checkout-primary"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Check payment again <ArrowRight size={17} />
            </button>
          )}
          {state !== "loading" && (
            <Link
              className={
                state === "paid" || !sessionId
                  ? "checkout-primary"
                  : "order-secondary-link"
              }
              href={state === "paid" || !sessionId ? "/" : "/checkout"}
            >
              {state === "paid" || !sessionId
                ? "Continue exploring"
                : "Return to checkout"}
              <ArrowRight size={17} />
            </Link>
          )}
          <div className="order-secure">
            <ShieldCheck size={16} />{" "}
            {state === "paid"
              ? "Verified payment status"
              : "Secure payment lookup"}
          </div>
        </section>
        <p className="order-footnote">
          From Dubai to Baku. A little closer to what you love.
        </p>
      </main>
      <footer className="checkout-footer">
        <span>© {new Date().getFullYear()} Dubai Electronics</span>
        <div>
          <Link href="/policies/privacy">Privacy</Link>
          <Link href="/policies/terms">Terms</Link>
        </div>
      </footer>
    </div>
  );
}
