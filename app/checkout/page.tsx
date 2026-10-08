import type { Metadata } from "next";
import { Suspense } from "react";
import Checkout from "@/components/checkout";
import "./checkout.css";

export const metadata: Metadata = {
  title: "Checkout",
  description:
    "Your electronics, delivered from Dubai to Baku. Review your bag and delivery details.",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="checkout-loading">Preparing your checkout…</div>
      }
    >
      <Checkout />
    </Suspense>
  );
}
