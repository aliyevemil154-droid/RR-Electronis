"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CreditCard,
  Globe2,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
  Zap,
} from "lucide-react";
import { getProduct, formatPrice } from "@/lib/catalog";

const CART_KEY = "dubai-electronics-cart";
const SHIPPING_COST = 35;
const FREE_SHIPPING_THRESHOLD = 1500;
type CartItem = { id: string; quantity: number };

function readCart(): CartItem[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is CartItem =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        item.quantity <= 5 &&
        Boolean(getProduct(item.id)),
    );
  } catch {
    return [];
  }
}

export function CheckoutHeader() {
  return (
    <header className="checkout-header">
      <Link
        className="brand"
        href="/"
        aria-label="Dubai Electronics home"
      >
        <span className="brand-mark">
          <Zap size={24} fill="currentColor" strokeWidth={1.2} />
        </span>
        <span>
          dubai<span className="brand-sub">ELECTRONICS</span>
        </span>
      </Link>
      <div className="checkout-header-secure">
        <LockKeyhole size={14} /> Secure checkout
      </div>
      <Link href="/" className="checkout-back">
        <ArrowLeft size={16} />
        <span>Back to shopping</span>
      </Link>
    </header>
  );
}

export default function Checkout() {
  const searchParams = useSearchParams();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [shippingFee, setShippingFee] = useState(SHIPPING_COST);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(
    FREE_SHIPPING_THRESHOLD,
  );
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKey = useRef<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    line1: "",
    line2: "",
    city: "Baku",
    postalCode: "",
    country: "AZ",
  });

  useEffect(() => {
    setCart(readCart());
    setReady(true);
    let active = true;
    fetch("/api/checkout", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Payment availability could not be checked.");
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        setConfigured(data.configured === true);
        if (Number.isSafeInteger(data.shippingFee) && data.shippingFee >= 0)
          setShippingFee(data.shippingFee);
        if (
          Number.isSafeInteger(data.freeShippingThreshold) &&
          data.freeShippingThreshold >= 0
        )
          setFreeShippingThreshold(data.freeShippingThreshold);
      })
      .catch(() => {
        if (active) setConfigured(false);
      })
      .finally(() => {
        if (active) setConfigLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const subtotal = cart.reduce(
    (sum, item) => sum + (getProduct(item.id)?.price ?? 0) * item.quantity,
    0,
  );
  const shipping = subtotal >= freeShippingThreshold ? 0 : shippingFee;
  const total = subtotal + (cart.length ? shipping : 0);
  const quantity = cart.reduce((sum, item) => sum + item.quantity, 0);

  function updateCart(id: string, nextQuantity: number) {
    const next =
      nextQuantity === 0
        ? cart.filter((item) => item.id !== id)
        : cart.map((item) =>
            item.id === id
              ? { ...item, quantity: Math.min(5, Math.max(1, nextQuantity)) }
              : item,
          );
    setCart(next);
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(next));
    } catch {
      setError(
        "Your browser couldn’t save your bag. Enable browser storage before continuing.",
      );
    }
    window.dispatchEvent(new Event("cart-updated"));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || submitting || !cart.length) return;
    setSubmitting(true);
    setError("");
    try {
      if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey.current,
        },
        body: JSON.stringify({
          items: cart,
          customer: {
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
          },
          address: {
            line1: form.line1.trim(),
            line2: form.line2.trim(),
            city: form.city.trim(),
            postalCode: form.postalCode.trim(),
            country: form.country,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "We couldn’t start checkout. Please try again.",
        );
      const url = new URL(data.url);
      if (
        url.protocol !== "https:" ||
        !["checkout.stripe.com"].includes(url.hostname)
      )
        throw new Error(
          "The payment link could not be verified. Please try again.",
        );
      if (
        typeof data.sessionId !== "string" ||
        !/^cs_(test_|live_)?[A-Za-z0-9]{20,240}$/.test(data.sessionId)
      )
        throw new Error(
          "The payment session could not be verified. Please try again.",
        );
      try {
        sessionStorage.setItem(
          "dubai-electronics-pending-checkout",
          JSON.stringify({ sessionId: data.sessionId, items: cart }),
        );
      } catch {
        /* Keep the bag unchanged after payment when browser storage is unavailable. */
      }
      window.location.assign(url.toString());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "We couldn’t start checkout. Please try again.",
      );
      setSubmitting(false);
    }
  }

  const change =
    (field: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((previous) => ({ ...previous, [field]: event.target.value }));

  return (
    <div className="checkout-shell">
      <CheckoutHeader />
      <main className="checkout-main">
        <div className="checkout-title-block">
          <span className="checkout-eyebrow">THE GOOD PART IS NEXT</span>
          <h1>
            A little closer to <em>yours.</em>
          </h1>
          <p>Premium tech. A smooth journey from Dubai to your door.</p>
        </div>
        {!ready ? (
          <div className="checkout-loading">
            <LoaderCircle size={22} className="checkout-spin" /> Loading your
            bag…
          </div>
        ) : !cart.length ? (
          <section className="checkout-empty">
            <div className="checkout-empty-icon">
              <ShoppingBag size={34} strokeWidth={1.5} />
            </div>
            <h2>Your next upgrade is waiting.</h2>
            <p>Your bag is empty. Discover a little something you’ll love.</p>
            <Link className="checkout-primary" href="/">
              Explore the collection <ArrowRight size={18} />
            </Link>
          </section>
        ) : (
          <form onSubmit={submit} className="checkout-layout">
            <div className="checkout-details">
              {!configLoading && !configured && (
                <div className="checkout-notice checkout-preview-notice">
                  <strong>Store preview.</strong> Product prices, business
                  details, and delivery and return policies are awaiting
                  merchant confirmation. Online ordering is not available yet.{" "}
                  <Link href="/policies/terms">
                    Read our draft terms <ArrowRight size={12} />
                  </Link>
                </div>
              )}
              {searchParams.get("cancelled") === "1" && (
                <div role="status" className="checkout-notice">
                  Your payment wasn’t completed. Your bag is saved, so you can
                  continue whenever you’re ready.
                </div>
              )}
              <section className="checkout-card checkout-information">
                <div className="checkout-section-title">
                  <span className="checkout-step">01</span>
                  <div>
                    <h2>Your details</h2>
                    <p>Where we can reach you about your order.</p>
                  </div>
                </div>
                <div className="checkout-field-grid">
                  <label className="checkout-field checkout-full">
                    Full name
                    <input
                      name="name"
                      autoComplete="name"
                      placeholder="Your first and last name"
                      required
                      minLength={2}
                      maxLength={100}
                      value={form.name}
                      onChange={change("name")}
                    />
                  </label>
                  <label className="checkout-field">
                    Email address
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      required
                      maxLength={254}
                      value={form.email}
                      onChange={change("email")}
                    />
                  </label>
                  <label className="checkout-field">
                    Phone number
                    <input
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      placeholder="+994 50 123 45 67"
                      required
                      minLength={7}
                      maxLength={24}
                      pattern={String.raw`\+?[0-9\s\(\)\-]+`}
                      title="Enter a valid phone number, including the country code."
                      value={form.phone}
                      onChange={change("phone")}
                    />
                  </label>
                </div>
              </section>
              <section className="checkout-card checkout-information">
                <div className="checkout-section-title">
                  <span className="checkout-step">02</span>
                  <div>
                    <h2>Delivery address</h2>
                    <p>From Dubai, delivered with care to Baku.</p>
                  </div>
                  <MapPin
                    className="checkout-section-icon"
                    size={21}
                    strokeWidth={1.6}
                  />
                </div>
                <div className="checkout-field-grid">
                  <label className="checkout-field checkout-full">
                    Street address
                    <input
                      name="address-line1"
                      autoComplete="address-line1"
                      placeholder="Street name and building number"
                      required
                      minLength={5}
                      maxLength={180}
                      value={form.line1}
                      onChange={change("line1")}
                    />
                  </label>
                  <label className="checkout-field checkout-full">
                    Apartment, floor, or delivery note <span>(optional)</span>
                    <input
                      name="address-line2"
                      autoComplete="address-line2"
                      placeholder="Apartment, floor, or a helpful landmark"
                      maxLength={180}
                      value={form.line2}
                      onChange={change("line2")}
                    />
                  </label>
                  <label className="checkout-field">
                    City
                    <input
                      name="city"
                      autoComplete="address-level2"
                      value={form.city}
                      readOnly
                    />
                  </label>
                  <label className="checkout-field">
                    Postal code <span>(optional)</span>
                    <input
                      name="postal-code"
                      autoComplete="postal-code"
                      placeholder="AZ1000"
                      maxLength={6}
                      pattern="(?:[Aa][Zz])?[0-9]{4}"
                      title="Enter four digits, optionally prefixed by AZ (for example, AZ1000)."
                      value={form.postalCode}
                      onChange={change("postalCode")}
                    />
                  </label>
                  <div className="checkout-field checkout-full">
                    Country
                    <div className="checkout-fixed-field">
                      <span>🇦🇿 &nbsp; Azerbaijan</span>
                      <ChevronDown size={15} />
                    </div>
                  </div>
                </div>
                <div className="checkout-delivery">
                  <div className="checkout-delivery-icon">
                    <Truck size={21} strokeWidth={1.7} />
                  </div>
                  <div>
                    <strong>Dubai → Baku</strong>
                    <span>
                      Delivery time and any applicable customs charges must be
                      confirmed before payment.
                    </span>
                  </div>
                  <span className="checkout-delivery-price">
                    {shipping === 0 ? "Free" : formatPrice(shipping)}
                  </span>
                </div>
              </section>
              <section className="checkout-card checkout-information">
                <div className="checkout-section-title">
                  <span className="checkout-step">03</span>
                  <div>
                    <h2>Payment</h2>
                    <p>A secure final step for your next upgrade.</p>
                  </div>
                  <CreditCard
                    className="checkout-section-icon"
                    size={21}
                    strokeWidth={1.6}
                  />
                </div>
                {configLoading ? (
                  <div className="checkout-payment-note">
                    <LoaderCircle size={19} className="checkout-spin" />
                    <div>
                      <strong>Checking payment availability</strong>
                      <p>Just a moment while we prepare your checkout.</p>
                    </div>
                  </div>
                ) : configured ? (
                  <div className="checkout-payment-note">
                    <LockKeyhole size={22} />
                    <div>
                      <strong>Pay securely online</strong>
                      <p>
                        You’ll continue to a secure payment page. Your card
                        details stay with our payment provider.
                      </p>
                    </div>
                    <ShieldCheck size={22} />
                  </div>
                ) : (
                  <div className="checkout-payment-note checkout-coming-soon">
                    <CreditCard size={23} />
                    <div>
                      <strong>Online payments are coming soon</strong>
                      <p>
                        Our payment service is being prepared. Checkout will be
                        available once it’s ready.
                      </p>
                    </div>
                    <span className="checkout-coming-tag">Coming soon</span>
                  </div>
                )}
              </section>
            </div>
            <aside className="checkout-summary-wrap">
              <section className="checkout-card checkout-summary">
                <div className="checkout-summary-heading">
                  <h2>Your bag</h2>
                  <span>
                    {quantity} {quantity === 1 ? "item" : "items"}
                  </span>
                </div>
                <div className="checkout-items">
                  {cart.map((item) => {
                    const product = getProduct(item.id);
                    if (!product) return null;
                    return (
                      <div className="checkout-item" key={item.id}>
                        <div className="checkout-item-image">
                          <img src={product.image} alt={product.name} />
                        </div>
                        <div className="checkout-item-details">
                          <div className="checkout-item-top">
                            <h3>{product.name}</h3>
                            <button
                              type="button"
                              className="checkout-remove"
                              onClick={() => updateCart(item.id, 0)}
                              aria-label={`Remove ${product.name}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <p>{product.category}</p>
                          <div className="checkout-item-bottom">
                            <div className="checkout-quantity">
                              <button
                                type="button"
                                disabled={item.quantity <= 1}
                                onClick={() =>
                                  updateCart(item.id, item.quantity - 1)
                                }
                                aria-label={`Decrease ${product.name} quantity`}
                              >
                                <Minus size={12} />
                              </button>
                              <span>{item.quantity}</span>
                              <button
                                type="button"
                                disabled={item.quantity >= 5}
                                onClick={() =>
                                  updateCart(item.id, item.quantity + 1)
                                }
                                aria-label={`Increase ${product.name} quantity`}
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                            <strong>
                              {formatPrice(product.price * item.quantity)}
                            </strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="checkout-costs">
                  <div>
                    <span>Subtotal</span>
                    <strong>{formatPrice(subtotal)}</strong>
                  </div>
                  <div>
                    <span>Delivery to Baku</span>
                    <strong className={shipping === 0 ? "checkout-free" : ""}>
                      {shipping === 0 ? "Complimentary" : formatPrice(shipping)}
                    </strong>
                  </div>
                </div>
                <div className="checkout-total">
                  <div>
                    <span>Total</span>
                    <small>All prices in AZN</small>
                  </div>
                  <strong>{formatPrice(total)}</strong>
                </div>
                {shipping > 0 && (
                  <p className="checkout-shipping-progress">
                    <Truck size={14} /> Free delivery on orders of{" "}
                    {formatPrice(freeShippingThreshold)}+
                  </p>
                )}
                {error && (
                  <p role="alert" className="checkout-error">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={!configured || configLoading || submitting}
                  className="checkout-primary checkout-payment-button"
                >
                  {submitting ? (
                    <>
                      <LoaderCircle className="checkout-spin" size={18} />{" "}
                      Preparing secure payment…
                    </>
                  ) : configured ? (
                    <>
                      Continue to payment <ArrowRight size={18} />
                    </>
                  ) : configLoading ? (
                    "Preparing checkout…"
                  ) : (
                    "Payments coming soon"
                  )}
                </button>
                <p className="checkout-consent">
                  By continuing, you agree to our{" "}
                  <Link href="/policies/terms">Terms of Service</Link> and{" "}
                  <Link href="/policies/privacy">Privacy Policy</Link>.
                </p>
                <div className="checkout-summary-trust">
                  <LockKeyhole size={13} /> Encrypted & secure checkout
                </div>
              </section>
              <div className="checkout-care">
                <span className="checkout-care-icon">
                  <ShieldCheck size={24} strokeWidth={1.5} />
                </span>
                <div>
                  <strong>A thoughtful journey, every step.</strong>
                  <p>Carefully sourced. Securely packed. Ready for you.</p>
                </div>
              </div>
            </aside>
          </form>
        )}
        <div className="checkout-bottom-trust">
          <span>
            <ShieldCheck size={17} /> Carefully sourced electronics
          </span>
          <span>
            <Globe2 size={17} /> Dubai to Baku
          </span>
          <span>
            <Check size={17} /> Prices in AZN
          </span>
        </div>
      </main>
      <footer className="checkout-footer">
        <span>© {new Date().getFullYear()} Dubai Electronics</span>
        <div>
          <Link href="/policies/privacy">Privacy</Link>
          <Link href="/policies/terms">Terms</Link>
          <Link href="/policies/shipping">Delivery & returns</Link>
        </div>
      </footer>
    </div>
  );
}
