"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Gamepad2,
  Headphones,
  Heart,
  Laptop,
  Menu,
  Minus,
  PackageCheck,
  Plane,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Tablet,
  Truck,
  X,
  Zap,
} from "lucide-react";
import { categories, getProduct, products, type Product } from "@/lib/catalog";
import Dialog from "./dialog";

type CartItem = { id: string; quantity: number };
type Modal =
  | "search"
  | "cart"
  | "wishlist"
  | "delivery"
  | "support"
  | "menu"
  | "product"
  | null;
type Currency = "AZN" | "USD" | "AED";
const CART_KEY = "dubai-electronics-cart";
const icons = {
  Smartphones: Smartphone,
  Laptops: Laptop,
  Audio: Headphones,
  Tablets: Tablet,
  Gaming: Gamepad2,
};

function price(value: number, currency: Currency = "AZN") {
  const rate =
    currency === "USD" ? 1 / 1.7 : currency === "AED" ? 3.6725 / 1.7 : 1;
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value * rate);
  return `${formatted} ${currency === "AZN" ? "₼" : currency === "USD" ? "$" : "AED"}`;
}

export default function Storefront() {
  const [modal, setModal] = useState<Modal>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product>(products[0]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [currency, setCurrency] = useState<Currency>("AZN");
  const [category, setCategory] = useState("All devices");
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [sort, setSort] = useState("featured");
  const [toast, setToast] = useState("");
  const [newsletter, setNewsletter] = useState("");
  const [newsletterState, setNewsletterState] = useState("");
  const [newsletterBusy, setNewsletterBusy] = useState(false);
  const [supportStatus, setSupportStatus] = useState("");
  const [supportBusy, setSupportBusy] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function loadShoppingSession() {
      try {
        const items: unknown = JSON.parse(
          localStorage.getItem(CART_KEY) ?? "[]",
        );
        if (Array.isArray(items))
          setCart(
            items.filter(
              (item) =>
                item &&
                getProduct(item.id) &&
                Number.isInteger(item.quantity) &&
                item.quantity > 0 &&
                item.quantity <= 5,
            ),
          );
        const saved: unknown = JSON.parse(
          localStorage.getItem("dubai-electronics-wishlist") ?? "[]",
        );
        if (Array.isArray(saved))
          setWishlist(
            saved.filter(
              (id): id is string => typeof id === "string" && !!getProduct(id),
            ),
          );
      } catch {
        /* Corrupt browser storage starts a fresh shopping session. */
      }
      setHydrated(true);
    }
    loadShoppingSession();
    window.addEventListener("cart-updated", loadShoppingSession);
    window.addEventListener("storage", loadShoppingSession);
    return () => {
      window.removeEventListener("cart-updated", loadShoppingSession);
      window.removeEventListener("storage", loadShoppingSession);
    };
  }, []);
  useEffect(() => {
    if (hydrated)
      try {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
      } catch {
        /* Shopping still works without storage. */
      }
  }, [cart, hydrated]);
  useEffect(() => {
    if (hydrated)
      try {
        localStorage.setItem(
          "dubai-electronics-wishlist",
          JSON.stringify(wishlist),
        );
      } catch {
        /* Optional persistence. */
      }
  }, [wishlist, hydrated]);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  useEffect(() => {
    document.documentElement.classList.add("enhanced-motion");
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.08 },
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("enhanced-motion");
    };
  }, []);

  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  }
  function addToCart(product: Product) {
    if (cart.find((item) => item.id === product.id)?.quantity === 5) {
      notify("You can add up to 5 of each item.");
      return;
    }
    setCart((items) => {
      const existing = items.find((item) => item.id === product.id);
      return existing
        ? items.map((item) =>
            item.id === product.id
              ? { ...item, quantity: Math.min(5, item.quantity + 1) }
              : item,
          )
        : [...items, { id: product.id, quantity: 1 }];
    });
    notify(`${product.name} added to your bag`);
  }
  function toggleWishlist(id: string) {
    setWishlist((items) =>
      items.includes(id) ? items.filter((item) => item !== id) : [...items, id],
    );
  }
  function openProduct(product: Product) {
    setSelectedProduct(product);
    setModal("product");
  }
  function browse(next = "All devices") {
    setCategory(next);
    setCatalogSearch("");
    setShowAll(true);
    setModal(null);
    document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
  }
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce(
    (sum, item) => sum + (getProduct(item.id)?.price ?? 0) * item.quantity,
    0,
  );
  const filteredProducts = useMemo(() => {
    let list = products.filter(
      (product) =>
        (category === "All devices" || product.category === category) &&
        `${product.name} ${product.subtitle} ${product.category}`
          .toLowerCase()
          .includes(catalogSearch.toLowerCase()),
    );
    if (sort === "low") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "high") list = [...list].sort((a, b) => b.price - a.price);
    return showAll || category !== "All devices" || catalogSearch
      ? list
      : list.slice(0, 4);
  }, [category, showAll, catalogSearch, sort]);
  const searchResults = products.filter((product) =>
    `${product.name} ${product.category}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  async function subscribe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNewsletterBusy(true);
    setNewsletterState("");
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newsletter }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "We couldn't save your email. Please try again.",
        );
      setNewsletterState("You're on the list. Thanks for joining us!");
      setNewsletter("");
    } catch (error) {
      setNewsletterState(
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setNewsletterBusy(false);
    }
  }
  async function sendInquiry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSupportBusy(true);
    setSupportStatus("");
    const form = event.currentTarget,
      fields = new FormData(form);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(fields)),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "We couldn't save your message. Please try again.",
        );
      setSupportStatus(
        "Your message has been received. Thank you for getting in touch.",
      );
      form.reset();
    } catch (error) {
      setSupportStatus(
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setSupportBusy(false);
    }
  }

  const productCard = (product: Product) => (
    <article className="product-card" key={product.id}>
      <div className="product-visual">
        {product.badge && (
          <span className="product-badge">
            <Sparkles size={11} /> The spotlight
          </span>
        )}
        <button
          className={`favorite-button ${wishlist.includes(product.id) ? "is-saved" : ""}`}
          onClick={() => toggleWishlist(product.id)}
          aria-label={`${wishlist.includes(product.id) ? "Remove" : "Save"} ${product.name} ${wishlist.includes(product.id) ? "from" : "to"} wishlist`}
          aria-pressed={wishlist.includes(product.id)}
        >
          <Heart size={18} />
        </button>
        <button
          className="product-image-button"
          onClick={() => openProduct(product)}
          aria-label={`View ${product.name}`}
        >
          <Image
            src={product.image}
            alt={product.name}
            width={420}
            height={420}
            className="product-image"
          />
        </button>
        <button className="quick-view" onClick={() => openProduct(product)}>
          A closer look <ArrowUpRight size={14} />
        </button>
      </div>
      <div className="product-info">
        <p className="product-category">{product.category}</p>
        <button className="product-name" onClick={() => openProduct(product)}>
          {product.name}
        </button>
        <p className="product-subtitle">{product.subtitle}</p>
        <div className="product-bottom">
          <div>
            <span className="product-price">
              {price(product.price, currency)}
            </span>
            <div className="color-dots">
              {product.colors.map((color) => (
                <span
                  key={color.name}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
              <span className="color-label">{product.colors[0].name}</span>
            </div>
          </div>
          <button
            className="add-button"
            aria-label={`Add ${product.name} to bag`}
            onClick={() => addToCart(product)}
          >
            <Plus size={21} />
          </button>
        </div>
      </div>
    </article>
  );

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="announcement">
        <div className="container announcement-inner">
          <span>
            <Plane size={12} /> From Dubai, with possibility. Delivered to Baku.
          </span>
          <button onClick={() => setModal("delivery")}>
            Meet your new tech destination <ArrowUpRight size={13} />
          </button>
        </div>
      </div>
      <header className="header">
        <div className="container header-inner">
          <Link href="/" className="brand" aria-label="Dubai Electronics home">
            <span className="brand-mark">
              <Zap size={24} fill="currentColor" strokeWidth={1.2} />
            </span>
            <span>
              dubai<span className="brand-sub">ELECTRONICS</span>
            </span>
          </Link>
          <nav className="desktop-nav" aria-label="Main navigation">
            <button onClick={() => browse()}>
              Shop all <ChevronDown size={13} />
            </button>
            <a href="#featured">The spotlight</a>
            <a href="#story">Our story</a>
            <button onClick={() => setModal("delivery")}>
              Dubai to Baku <ArrowUpRight size={12} />
            </button>
          </nav>
          <div className="header-actions">
            <label className="currency-picker">
              <span className="sr-only">Display currency</span>
              <select
                aria-label="Display currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
              >
                <option value="AZN">AZN ₼</option>
                <option value="USD">USD $</option>
                <option value="AED">AED</option>
              </select>
              <ChevronDown size={12} />
            </label>
            <span className="header-divider" />
            <button
              className="icon-button"
              aria-label="Search products"
              onClick={() => setModal("search")}
            >
              <Search size={20} />
            </button>
            <button
              className="icon-button wishlist-toggle"
              aria-label={`Wishlist, ${wishlist.length} ${wishlist.length === 1 ? "item" : "items"}`}
              onClick={() => setModal("wishlist")}
            >
              <Heart size={20} />
              {wishlist.length > 0 && (
                <span className="tiny-count">{wishlist.length}</span>
              )}
            </button>
            <button
              className="bag-button"
              aria-label={`Shopping bag, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
              onClick={() => setModal("cart")}
            >
              <ShoppingBag size={19} />
              <span className="bag-count">{cartCount}</span>
            </button>
            <button
              className="icon-button mobile-menu-toggle"
              aria-label="Open menu"
              onClick={() => setModal("menu")}
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="hero container">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="little-star">✳</span> GOOD TECH. NO BORDERS.
            </p>
            <h1>
              Your next upgrade.
              <br />
              <span>A world closer.</span>
            </h1>
            <p className="hero-description">
              The tech you love, thoughtfully selected in Dubai.
              <br className="desktop-break" /> Delivered to your everyday in
              Baku.
            </p>
            <div className="hero-buttons">
              <button className="button button-dark" onClick={() => browse()}>
                Find your next upgrade <ArrowUpRight size={18} />
              </button>
              <button
                className="hero-secondary"
                onClick={() => setModal("delivery")}
              >
                <span className="play-circle">
                  <Plane size={15} />
                </span>
                How it gets to you
              </button>
            </div>
            <div className="hero-footnote">
              <span className="mini-check">
                <Check size={11} />
              </span>{" "}
              Carefully selected. Connected to your world.
            </div>
            <a className="scroll-cue" href="#shop">
              <ArrowDown size={15} /> A little scroll. A lot to discover.
            </a>
          </div>
          <div className="hero-art">
            <div className="hero-art-top">
              <span>
                <span className="live-dot" /> THE EVERYDAY, ELEVATED
              </span>
              <span>01 — 06</span>
            </div>
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="hero-word">closer.</div>
            <Image
              src="/images/hero-generated.png"
              alt="Two titanium smartphones, front and back, against a soft green backdrop"
              width={850}
              height={850}
              className="hero-product"
              priority
            />
            <div className="hero-tag">
              <Sparkles size={14} />
              <span>
                A fresh perspective.
                <br />
                <strong>A familiar feeling.</strong>
              </span>
            </div>
            <div className="hero-product-label">
              <div>
                <span className="label-eyebrow">IN THE SPOTLIGHT</span>
                <h2>iPhone 16 Pro</h2>
                <span className="hero-product-price">
                  {price(products[0].price, currency)} <span>· 256 GB</span>
                </span>
              </div>
              <button
                className="round-arrow"
                aria-label="Discover iPhone 16 Pro"
                onClick={() => openProduct(products[0])}
              >
                <ArrowUpRight size={22} />
              </button>
            </div>
            <div className="route-pill">
              <span className="route-flag">🇦🇪</span> DXB{" "}
              <span className="route-line">
                <Plane size={14} />
              </span>{" "}
              GYD <span className="route-flag">🇦🇿</span>
            </div>
          </div>
        </section>

        <div className="brand-strip container">
          <span>
            Big names.
            <br />
            <strong>Better everyday.</strong>
          </span>
          <div className="brand-word apple-word">
            <svg
              width="21"
              height="25"
              viewBox="0 0 24 29"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M18.8 15.2c0-3.4 2.8-5 2.9-5.1-1.6-2.3-4.1-2.6-5-2.6-2.1-.2-4.1 1.2-5.2 1.2-1 0-2.7-1.2-4.4-1.2C4.8 7.6 2.6 9 1.4 11 .1 13.3-.1 17.9 2.5 22.5c1.3 2.3 2.8 4.9 4.8 4.8 1.9-.1 2.6-1.2 4.9-1.2 2.2 0 2.9 1.2 4.8 1.2 2.1 0 3.4-2.2 4.6-4.6 1.5-2.6 2.1-5.1 2.1-5.2-.1 0-4.9-1.9-4.9-6.3zm-3.7-9.8C16.2 4 17 2.1 16.8.2c-1.6.1-3.5 1.1-4.6 2.4-1 1.2-1.9 3.1-1.7 4.9 1.8.2 3.5-.9 4.6-2.1z" />
            </svg>
            Apple
          </div>
          <div className="brand-word samsung-word">SAMSUNG</div>
          <div className="brand-word bose-word">BOSE</div>
          <div className="brand-word playstation-word">
            <Gamepad2 size={26} strokeWidth={1.4} /> PlayStation
          </div>
        </div>

        <section className="catalog-section container reveal" id="shop">
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE CURATED COLLECTION</p>
              <h2>
                Good tech. <span>Great possibilities.</span>
              </h2>
            </div>
            <button
              className="text-link"
              onClick={() => {
                setShowAll(!showAll);
                setCategory("All devices");
                setCatalogSearch("");
              }}
            >
              {showAll ? "View the essentials" : "Explore all products"}{" "}
              <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="catalog-toolbar">
            <div
              className="category-tabs"
              role="group"
              aria-label="Product category"
            >
              <button
                className={category === "All devices" ? "active" : ""}
                aria-pressed={category === "All devices"}
                onClick={() => {
                  setCategory("All devices");
                  setCatalogSearch("");
                }}
              >
                <span className="all-icon">✳</span> All devices
              </button>
              {categories.map((cat) => {
                const Icon = icons[cat];
                return (
                  <button
                    key={cat}
                    className={category === cat ? "active" : ""}
                    aria-pressed={category === cat}
                    onClick={() => {
                      setCategory(cat);
                      setCatalogSearch("");
                    }}
                  >
                    <Icon size={16} />
                    {cat}
                  </button>
                );
              })}
            </div>
            <label className="sort-picker">
              <span className="sr-only">Sort products</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Sort products"
              >
                <option value="featured">Featured</option>
                <option value="low">Price: low to high</option>
                <option value="high">Price: high to low</option>
              </select>
              <ChevronDown size={13} />
            </label>
          </div>
          {catalogSearch && (
            <div className="search-caption">
              Results for “{catalogSearch}”{" "}
              <button
                onClick={() => setCatalogSearch("")}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            </div>
          )}
          <div className="product-grid">
            {filteredProducts.map(productCard)}
          </div>
          {!filteredProducts.length && (
            <div className="empty-state">
              <Search size={30} />
              <h3>No matches just yet.</h3>
              <p>Try another product or explore the full collection.</p>
              <button className="button button-dark" onClick={() => browse()}>
                Explore all devices <ArrowRight size={16} />
              </button>
            </div>
          )}
          <div className="catalog-footer">
            <span>A little something for every part of your day.</span>
            <span>
              {filteredProducts.length.toString().padStart(2, "0")} /{" "}
              {products.length.toString().padStart(2, "0")} curated essentials
            </span>
          </div>
        </section>

        <section className="feature-banner container reveal" id="featured">
          <div className="feature-copy">
            <p className="eyebrow">
              <span className="little-star">✳</span> BUILT FOR YOUR NEXT BIG
              IDEA.
            </p>
            <h2>
              Room to imagine.
              <br />
              <span>Power to create.</span>
            </h2>
            <p>
              Meet MacBook Pro with M2. For ideas that deserve
              <br className="desktop-break" /> a little more power, wherever
              your day takes you.
            </p>
            <button
              className="button button-lime"
              onClick={() => openProduct(products[1])}
            >
              Meet your new MacBook <ArrowUpRight size={18} />
            </button>
            <div className="feature-specs">
              <span>
                <strong>M2</strong>Apple silicon
              </span>
              <span>
                <strong>13.3″</strong>Retina display
              </span>
              <span>
                <strong>1.4 kg</strong>Ready to go anywhere
              </span>
            </div>
          </div>
          <div className="feature-art">
            <div className="feature-glow" />
            <span className="feature-watermark">air.</span>
            <Image
              src="/images/macbook-header.png"
              alt="MacBook Pro laptop"
              width={850}
              height={650}
              className="feature-laptop"
            />
            <div className="feature-caption">
              <span>MacBook Pro M2</span>
              <span>From {price(products[1].price, currency)}</span>
            </div>
          </div>
        </section>

        <section className="journey-section container reveal" id="story">
          <div className="journey-copy">
            <p className="eyebrow">A SHORTER DISTANCE TO SOMETHING GREAT</p>
            <h2>
              From the heart of Dubai.
              <br />
              <span>To your corner of Baku.</span>
            </h2>
            <p>
              We believe your next great device shouldn’t feel a world away. We
              bring thoughtfully selected electronics from Dubai to Baku, with a
              simple shopping experience from discovery to delivery.
            </p>
            <button className="text-link" onClick={() => setModal("delivery")}>
              Get to know the journey <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="journey-card">
            <div className="route-cities">
              <div>
                <span className="city-flag">🇦🇪</span>
                <h3>Dubai</h3>
                <span>Where it starts</span>
              </div>
              <div className="flight-path">
                <span className="path-dot" />
                <span className="path-dash" />
                <Plane size={23} />
                <span className="path-dash" />
                <span className="path-dot" />
              </div>
              <div>
                <span className="city-flag">🇦🇿</span>
                <h3>Baku</h3>
                <span>Where it belongs</span>
              </div>
            </div>
            <div className="journey-caption">
              <PackageCheck size={19} />
              <span>
                Thoughtfully sourced. Carefully packed.
                <br />
                <strong>Made to arrive in your everyday.</strong>
              </span>
              <span className="journey-mini-star">✳</span>
            </div>
          </div>
        </section>

        <section
          className="benefits container reveal"
          aria-label="The Dubai Electronics experience"
        >
          <div>
            <PackageCheck />
            <h3>A considered collection</h3>
            <p>
              Great devices, chosen with
              <br />
              your everyday in mind.
            </p>
          </div>
          <div>
            <Plane />
            <h3>Dubai to your doorstep</h3>
            <p>
              A direct journey from Dubai
              <br />
              to Baku, Azerbaijan.
            </p>
          </div>
          <div>
            <ShieldCheck />
            <h3>Peace of mind at checkout</h3>
            <p>
              Payment handled by a secure
              <br />
              provider when we launch.
            </p>
          </div>
          <div>
            <Heart />
            <h3>A more personal experience</h3>
            <p>
              Questions before you order?
              <br />
              <button onClick={() => setModal("support")}>
                Let’s help you find your fit.
              </button>
            </p>
          </div>
        </section>

        <section className="newsletter-section reveal">
          <div className="container newsletter-inner">
            <div>
              <p className="eyebrow">A LITTLE MORE IN THE KNOW</p>
              <h2>
                Good things. <span>In your inbox.</span>
              </h2>
              <p>
                New arrivals, fresh inspiration, and your next great upgrade.
              </p>
            </div>
            <div className="newsletter-form-wrap">
              <form className="newsletter-form" onSubmit={subscribe}>
                <label className="sr-only" htmlFor="newsletter-email">
                  Your email address
                </label>
                <input
                  id="newsletter-email"
                  type="email"
                  required
                  maxLength={254}
                  value={newsletter}
                  placeholder="Your email address"
                  onChange={(e) => setNewsletter(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={newsletterBusy}
                  aria-label="Join the newsletter"
                >
                  {newsletterBusy ? (
                    <span className="spinner" />
                  ) : (
                    <ArrowUpRight size={22} />
                  )}
                </button>
              </form>
              <p className="newsletter-disclaimer">
                By joining, you agree to our{" "}
                <Link href="/policies/privacy">Privacy Policy</Link>. No spam.
                Just a little inspiration.
              </p>
              <p className="newsletter-status" role="status">
                {newsletterState}
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container">
          <div className="footer-main">
            <div className="footer-brand">
              <Link href="/" className="brand">
                <span className="brand-mark">
                  <Zap size={24} fill="currentColor" strokeWidth={1.2} />
                </span>
                <span>
                  dubai<span className="brand-sub">ELECTRONICS</span>
                </span>
              </Link>
              <p>
                Better tech. A world closer.
                <br />
                From Dubai to Baku, with possibility.
              </p>
              <span className="footer-location">
                <span className="live-dot" /> DUBAI, UAE → BAKU, AZERBAIJAN
              </span>
            </div>
            <div className="footer-links">
              <h3>Find your upgrade</h3>
              {categories.map((cat) => (
                <button key={cat} onClick={() => browse(cat)}>
                  {cat}
                </button>
              ))}
            </div>
            <div className="footer-links">
              <h3>Here to help</h3>
              <button onClick={() => setModal("delivery")}>
                Shipping & delivery
              </button>
              <Link href="/policies/returns">Returns & warranty</Link>
              <button onClick={() => setModal("support")}>Get in touch</button>
              <button onClick={() => setModal("support")}>
                Frequently asked questions
              </button>
            </div>
            <div className="footer-note">
              <span className="footer-star">✳</span>
              <h3>
                Make room for
                <br />
                something great.
              </h3>
              <button className="text-link" onClick={() => browse()}>
                Explore the collection <ArrowUpRight size={16} />
              </button>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} Dubai Electronics.</span>
            <div>
              <Link href="/policies/privacy">Privacy</Link>
              <Link href="/policies/terms">Terms</Link>
              <span>Designed for your everyday.</span>
            </div>
          </div>
          <p className="preview-note">
            Preview collection · Product prices, stock, and delivery terms will
            be confirmed before launch.{" "}
            {currency !== "AZN" &&
              "Currency conversions are indicative; checkout is in AZN."}
          </p>
        </div>
      </footer>

      {toast && (
        <div className="toast" role="status">
          <CircleCheck size={19} />
          <span>{toast}</span>
          <button
            onClick={() => {
              setToast("");
              setModal("cart");
            }}
          >
            View bag <ArrowRight size={14} />
          </button>
        </div>
      )}

      {modal === "search" && (
        <Dialog onClose={() => setModal(null)} className="search-dialog">
          <p className="eyebrow">FIND YOUR NEXT UPGRADE</p>
          <h2 id="modal-title">What are you looking for?</h2>
          <form
            className="search-form"
            onSubmit={(e) => {
              e.preventDefault();
              setCatalogSearch(search.trim());
              setShowAll(true);
              setCategory("All devices");
              setModal(null);
              document
                .getElementById("shop")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <Search size={21} />
            <input
              aria-label="Search the collection"
              placeholder="Try iPhone, MacBook, or headphones"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-autofocus
            />
            <button
              type="submit"
              className="icon-button"
              aria-label="See search results"
            >
              <ArrowRight size={19} />
            </button>
          </form>
          <p className="search-meta">
            {search
              ? `${searchResults.length} ${searchResults.length === 1 ? "result" : "results"}`
              : "A few favourites to get you started"}
          </p>
          <div className="search-results">
            {searchResults.map((product) => (
              <button
                key={product.id}
                className="search-result"
                onClick={() => openProduct(product)}
              >
                <Image src={product.image} alt="" width={64} height={64} />
                <span>
                  <strong>{product.name}</strong>
                  <small>{product.category}</small>
                </span>
                <span>{price(product.price, currency)}</span>
                <ChevronRight size={17} />
              </button>
            ))}
            {!searchResults.length && (
              <p className="muted">
                No matches. Try a different device or brand.
              </p>
            )}
          </div>
        </Dialog>
      )}

      {modal === "cart" && (
        <Dialog drawer onClose={() => setModal(null)} className="cart-dialog">
          <p className="eyebrow">GREAT CHOICES START HERE</p>
          <h2 id="modal-title">
            Your shopping bag <span className="title-count">{cartCount}</span>
          </h2>
          {cart.length ? (
            <>
              <div className="cart-items">
                {cart.map((item) => {
                  const product = getProduct(item.id)!;
                  return (
                    <article className="cart-item" key={item.id}>
                      <Image
                        src={product.image}
                        alt={product.name}
                        width={105}
                        height={105}
                      />
                      <div className="cart-item-info">
                        <h3>{product.name}</h3>
                        <p>{product.subtitle}</p>
                        <strong>
                          {price(product.price * item.quantity, currency)}
                        </strong>
                        <div className="cart-controls">
                          <div className="quantity-control">
                            <button
                              aria-label={`Decrease ${product.name} quantity`}
                              onClick={() =>
                                setCart((items) =>
                                  items.flatMap((i) =>
                                    i.id !== item.id
                                      ? [i]
                                      : i.quantity > 1
                                        ? [{ ...i, quantity: i.quantity - 1 }]
                                        : [],
                                  ),
                                )
                              }
                            >
                              <Minus size={13} />
                            </button>
                            <span>{item.quantity}</span>
                            <button
                              disabled={item.quantity >= 5}
                              aria-label={`Increase ${product.name} quantity`}
                              onClick={() =>
                                setCart((items) =>
                                  items.map((i) =>
                                    i.id === item.id
                                      ? {
                                          ...i,
                                          quantity: Math.min(5, i.quantity + 1),
                                        }
                                      : i,
                                  ),
                                )
                              }
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                          <button
                            className="remove-item"
                            onClick={() =>
                              setCart((items) =>
                                items.filter((i) => i.id !== item.id),
                              )
                            }
                            aria-label={`Remove ${product.name} from bag`}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              <div className="cart-summary">
                <div>
                  <span>Subtotal</span>
                  <strong>{price(subtotal, currency)}</strong>
                </div>
                <p>Shipping is calculated at checkout. Payment is in AZN.</p>
                <Link className="button button-dark" href="/checkout">
                  Continue to checkout <ArrowRight size={17} />
                </Link>
                <button
                  className="continue-shopping"
                  onClick={() => setModal(null)}
                >
                  Keep exploring
                </button>
                <span className="cart-secure">
                  <ShieldCheck size={14} /> Your next upgrade is in good
                  company.
                </span>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <ShoppingBag size={38} />
              <h3>A little room for possibility.</h3>
              <p>Your bag is empty. Find something you’ll love.</p>
              <button className="button button-dark" onClick={() => browse()}>
                Explore the collection <ArrowUpRight size={17} />
              </button>
            </div>
          )}
        </Dialog>
      )}

      {modal === "wishlist" && (
        <Dialog drawer onClose={() => setModal(null)}>
          <p className="eyebrow">A LITTLE INSPIRATION FOR LATER</p>
          <h2 id="modal-title">Your saved favourites</h2>
          {wishlist.length ? (
            <div className="wishlist-list">
              {wishlist.map((id) => {
                const product = getProduct(id)!;
                return (
                  <article className="wishlist-item" key={id}>
                    <button onClick={() => openProduct(product)}>
                      <Image
                        src={product.image}
                        alt={product.name}
                        width={100}
                        height={100}
                      />
                    </button>
                    <div>
                      <h3>{product.name}</h3>
                      <p>{price(product.price, currency)}</p>
                      <button
                        className="text-link"
                        onClick={() => addToCart(product)}
                      >
                        Add to bag <Plus size={15} />
                      </button>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={`Remove ${product.name} from wishlist`}
                      onClick={() => toggleWishlist(id)}
                    >
                      <X size={17} />
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <Heart size={38} />
              <h3>Keep the good things close.</h3>
              <p>Tap the heart on a device to save it here.</p>
              <button className="button button-dark" onClick={() => browse()}>
                Find a favourite <ArrowUpRight size={17} />
              </button>
            </div>
          )}
        </Dialog>
      )}

      {modal === "product" && (
        <Dialog onClose={() => setModal(null)} className="product-dialog">
          <div className="product-detail-image">
            <Image
              src={selectedProduct.image}
              alt={selectedProduct.name}
              width={650}
              height={650}
            />
            <span className="product-detail-tag">
              <Sparkles size={13} /> An everyday upgrade
            </span>
          </div>
          <div className="product-detail-copy">
            <p className="eyebrow">{selectedProduct.category}</p>
            <h2 id="modal-title">{selectedProduct.name}</h2>
            <p className="muted">{selectedProduct.subtitle}</p>
            <p className="detail-price">
              {price(selectedProduct.price, currency)}
            </p>
            <p className="color-description">
              <span style={{ background: selectedProduct.colors[0].value }} />
              {selectedProduct.colors[0].name}
            </p>
            <ul className="spec-list">
              {selectedProduct.specs.map((spec) => (
                <li key={spec}>
                  <Check size={15} />
                  {spec}
                </li>
              ))}
            </ul>
            <button
              className="button button-dark"
              onClick={() => addToCart(selectedProduct)}
            >
              Add to your bag <ShoppingBag size={18} />
            </button>
            <button
              className="detail-wishlist"
              onClick={() => toggleWishlist(selectedProduct.id)}
            >
              <Heart
                size={16}
                fill={
                  wishlist.includes(selectedProduct.id)
                    ? "currentColor"
                    : "none"
                }
              />
              {wishlist.includes(selectedProduct.id)
                ? "Saved to your favourites"
                : "Save for a little later"}
            </button>
            <p className="detail-note">
              <Truck size={15} /> From Dubai to Baku. Delivery details at
              checkout.
            </p>
          </div>
        </Dialog>
      )}

      {modal === "delivery" && (
        <Dialog onClose={() => setModal(null)} className="info-dialog">
          <p className="eyebrow">FROM DUBAI TO YOUR EVERYDAY</p>
          <h2 id="modal-title">A simpler way to get there.</h2>
          <p className="info-intro">
            Your next upgrade starts in Dubai and arrives in Baku, Azerbaijan.
            Here’s how the journey works.
          </p>
          <div className="delivery-steps">
            <div>
              <span>01</span>
              <div>
                <h3>Find your fit</h3>
                <p>
                  Explore the collection and choose the device that’s right for
                  your day.
                </p>
              </div>
              <Smartphone size={22} />
            </div>
            <div>
              <span>02</span>
              <div>
                <h3>A clear checkout</h3>
                <p>
                  Enter your Baku delivery address. Review the final order and
                  shipping price before paying.
                </p>
              </div>
              <ShieldCheck size={22} />
            </div>
            <div>
              <span>03</span>
              <div>
                <h3>Dubai to your doorstep</h3>
                <p>
                  Once payment is confirmed, your product is prepared for
                  shipment from Dubai to Baku.
                </p>
              </div>
              <Plane size={22} />
            </div>
          </div>
          <div className="info-callout">
            <PackageCheck size={22} />
            <p>
              Our delivery service is being prepared for launch. Final delivery
              times, customs terms, and shipping fees will be published before
              orders open.
            </p>
          </div>
          <button className="button button-dark" onClick={() => browse()}>
            Explore the collection <ArrowUpRight size={17} />
          </button>
        </Dialog>
      )}

      {modal === "support" && (
        <Dialog onClose={() => setModal(null)} className="info-dialog">
          <p className="eyebrow">A LITTLE HELP GOES A LONG WAY</p>
          <h2 id="modal-title">Let’s find your next upgrade.</h2>
          <div className="faq-list">
            <details>
              <summary>
                Where do you deliver?
                <Plus size={16} />
              </summary>
              <p>
                We are preparing delivery from Dubai to Baku, Azerbaijan. The
                final shipping options will be shown before payment when
                ordering opens.
              </p>
            </details>
            <details>
              <summary>
                Can I pay online?
                <Plus size={16} />
              </summary>
              <p>
                Online payments will be available when our payment provider is
                connected. You can explore the collection and save your
                favourites in the meantime.
              </p>
            </details>
            <details>
              <summary>
                What about warranty and returns?
                <Plus size={16} />
              </summary>
              <p>
                Warranty coverage depends on the device and its regional model.
                We will publish the final return and warranty terms before
                accepting orders.
              </p>
            </details>
          </div>
          <h3 className="contact-title">Have something else in mind?</h3>
          <form className="contact-form" onSubmit={sendInquiry}>
            <label>
              Your name
              <input
                name="name"
                required
                minLength={2}
                maxLength={100}
                placeholder="Your full name"
                autoComplete="name"
              />
            </label>
            <label>
              Email address
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>
            <label>
              Your message
              <textarea
                name="message"
                required
                minLength={10}
                maxLength={2000}
                placeholder="Tell us what you’re looking for…"
                rows={3}
              />
            </label>
            <p className="form-consent">
              Your message is stored for follow-up in line with our{" "}
              <Link href="/policies/privacy">Privacy Policy</Link>.
            </p>
            <button
              className="button button-dark"
              disabled={supportBusy}
              type="submit"
            >
              {supportBusy ? "Sending…" : "Send your message"}
              <ArrowUpRight size={16} />
            </button>
            <p role="status" className="form-status">
              {supportStatus}
            </p>
          </form>
        </Dialog>
      )}

      {modal === "menu" && (
        <Dialog
          drawer
          onClose={() => setModal(null)}
          className="mobile-navigation"
        >
          <p className="eyebrow">DUBAI ELECTRONICS</p>
          <h2 id="modal-title">A world of possibility.</h2>
          <nav aria-label="Mobile navigation">
            <button onClick={() => browse()}>
              Shop all <ArrowUpRight size={21} />
            </button>
            {categories.map((cat) => (
              <button key={cat} onClick={() => browse(cat)}>
                {cat}
                <ChevronRight size={18} />
              </button>
            ))}
            <button onClick={() => setModal("delivery")}>
              Dubai to Baku <Plane size={20} />
            </button>
            <button onClick={() => setModal("support")}>
              Here to help <Heart size={20} />
            </button>
            <button onClick={() => setModal("wishlist")}>
              Your favourites <span>{wishlist.length}</span>
            </button>
          </nav>
        </Dialog>
      )}
    </>
  );
}
