import type { Metadata } from "next";
import { Suspense } from "react";
import OrderStatus from "@/components/order-status";
import "../checkout/checkout.css";

export const metadata: Metadata = {
  title: "Order status",
  description: "Check the payment status of your Dubai Electronics order.",
  robots: { index: false, follow: false },
};

export default function OrderPage() {
  return (
    <Suspense
      fallback={<div className="checkout-loading">Checking your payment…</div>}
    >
      <OrderStatus />
    </Suspense>
  );
}
