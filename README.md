# Dubai Electronics

A responsive electronics storefront for shipments from Dubai to Baku, Azerbaijan. Built with Next.js, TypeScript and React, with a persistent shopping bag, product browsing and a checkout flow. The illustrative catalog includes iPhone 16 Pro, MacBook Pro M2, Bose QuietComfort 45, Samsung Galaxy S23, AirPods Pro 2 and PlayStation 5. Inventory, regional product variants and AZN prices need merchant verification before sales begin.

## Local development

On **Windows 10 or 11**, extract the project ZIP using **Extract All**, then double-click `start-windows.cmd` inside the extracted folder. The launcher uses Node.js 24 if installed, or downloads a private portable copy from the official Node.js HTTPS release and verifies its pinned SHA-256 checksum. It installs dependencies from the lockfile, starts the local site, and opens your default browser only after the homepage responds. Keep the launcher window open. No administrator access or payment credentials are required. The first run needs an Internet connection for Node.js and npm dependencies.

Use Node.js 24 (required for the built-in SQLite order store) and npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Payments are unavailable by default: the merchant has not selected a payment provider. You can browse products, manage a bag and prepare delivery details without payment credentials. No demonstration transaction is marked as paid.

```sh
npm run typecheck
npm test
npm run build
npm run start
```

`npm run test:e2e` runs browser tests when Playwright browsers are installed. Local images and bundled fonts keep the storefront independent of third-party image or font services. Product-photo sources and license attribution are recorded in `public/images/SOURCES.md`; the iPhone illustration is generated artwork and should be reviewed against the exact product variant before launch.

## Optional Stripe adapter

The implementation includes an optional hosted Stripe Checkout adapter. Choosing a payment provider, opening an eligible merchant account and activating real payments are separate launch decisions. Confirm Stripe merchant-country eligibility and AZN support for the intended account before selecting this adapter. Never enter secret keys into browser code or commit `.env.local`.

To test this adapter after selecting Stripe, configure the following in `.env.local` or the deployment's secret settings:

```dotenv
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=your_private_test_key
STRIPE_WEBHOOK_SECRET=your_private_webhook_signing_secret
APP_URL=http://localhost:3000
```

Use actual provider-issued test credentials; the placeholder values above cannot process payments. Checkout requires both a secret key and a webhook signing secret. Live keys require an HTTPS `APP_URL`; only test keys permit localhost HTTP. The site origin must have no path, query or credentials. Restart the server after changing local environment values.

Create a webhook endpoint pointing to `/api/webhooks/stripe` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`. For local testing, Stripe CLI can forward events to `localhost:3000/api/webhooks/stripe`; store its signing secret securely. Live operation requires a publicly reachable HTTPS webhook. Card information is collected only on the provider's hosted page; this application never collects or stores card details.

Prices are recalculated on the server from `lib/catalog.ts`. The server accepts only known products, integer quantities between 1 and 5, valid contact details and delivery addresses in Baku, Azerbaijan. The success page verifies the checkout session with the payment provider. A signed, paid webhook commits an order and an event receipt in one SQLite transaction; duplicate events and duplicate paid sessions do not create duplicate orders. Unpaid sessions never become paid orders.

## API

- `GET /api/checkout`: returns payment availability as `configured` plus `shippingFee` and `freeShippingThreshold` in AZN. Availability remains false until the provider, secret key, webhook signing secret and site origin are configured.
- `POST /api/checkout`: accepts `items: [{ id, quantity }]`, `customer: { name, email, phone }`, and `address: { line1, line2?, city: "Baku", postalCode?, country: "AZ" }`; returns a hosted payment `url` and its `sessionId` for correlating the purchased bag. Errors return `{ "error": "..." }`, with HTTP 503 when payment is unavailable. An optional `Idempotency-Key` header protects repeated submissions.
- `GET /api/orders/status?session_id=...`: checks the provider and returns `status` (`paid`, `pending` or `expired`), `total`, `currency` and a paid-session `orderId`. It returns no customer contact details.
- `POST /api/webhooks/stripe`: requires a valid Stripe signature. Invalid signatures receive HTTP 400; persistence failures receive HTTP 500 so the provider retries delivery.

## Delivery configuration and launch review

The initial shipping quote is an example policy: **35 AZN**, waived for a merchandise subtotal of **1,500 AZN** or more. `SHIPPING_FEE_AZN` and `FREE_SHIPPING_THRESHOLD_AZN` allow whole-AZN overrides. Shipping figures, delivery timelines, customs duties, tax treatment, product availability, warranty and returns terms require merchant confirmation before accepting orders. Do not treat sample prices or draft policy text as confirmed business commitments.

Orders default to `.data/orders.sqlite`, which must remain private and is ignored by Git. Set `ORDERS_DB_PATH` to a persistent storage volume in production and arrange backups. Use one server instance with this SQLite implementation; deployments across multiple independent instances need a shared transactional database and a fulfillment process before launch. Keep the database out of public static directories. Contact and delivery details are stored for fulfillment; set a retention policy and publish the business's verified contact details, legal terms and privacy policy.

The storefront does not send fulfillment emails, book couriers, manage stock reservations or provide an administration dashboard. Add those operational integrations before promising automatic fulfillment. Configure platform-level checkout rate limiting before exposing live payments to unrestricted traffic.

Newsletter signups and contact inquiries are validated and stored in `.data/engagement.sqlite`. Set `ENGAGEMENT_DB_PATH` to a private persistent volume in production. These forms store submissions; they do not send email. Connect a mailing service with verified consent and unsubscribe handling before sending campaigns, and connect an inbox or admin interface to review support inquiries. Contact writes are limited to three submissions per email in ten minutes; add deployment-level spam protection for public launch.

The included privacy, terms, delivery, and returns pages explain preview behavior. Replace preliminary business terms with verified seller information and final policies before taking live payments. No sales, warranty, arrival-time, or registration claims are implied by the sample catalog.

## Cloud workspace

Use the existing `/workspace/RR-Electronis` checkout. Each cloud task already runs in an isolated environment; no additional Git worktree is needed. Run the development and validation commands above, keeping `.env.local`, dependencies and `.data` untracked. No external credentials are needed for storefront development.

For an embedded development preview, run `npm run preview`. This binds to `0.0.0.0:3000`, allows iframe embedding in this explicit development mode, and keeps payments unavailable. Regular development and production retain frame protection. Production retains it even if `WEB_PREVIEW=1` was mistakenly kept during the build. To use another port, run `npm run preview -- --port 3002`; `--open` opens the browser after readiness when running on your own computer.

A cloud server's `localhost` belongs to the cloud machine. Opening that address on Windows cannot reach the cloud server; `ERR_CONNECTION_REFUSED` means no local server is listening. A remote Web Preview requires the platform to forward port 3000 to a browser-accessible URL. This onboarding interface does not provide that forwarding feature. Use the Windows launcher to run the site on your computer. If another development platform supplies a forwarded hostname, set `PREVIEW_HOSTNAMES` to that exact hostname (without scheme or port) to allow its development assets, and set `APP_URL` to its exact origin if the proxy changes the host used by form requests. Do not invent a preview URL or expose payment secrets in a preview.
