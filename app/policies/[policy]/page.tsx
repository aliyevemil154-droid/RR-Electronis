import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Zap } from "lucide-react";
import "./policies.css";

const documents: Record<
  string,
  { title: string; intro: string; sections: [string, string][] }
> = {
  privacy: {
    title: "Your privacy matters.",
    intro:
      "A clear look at the information this website uses and how it is handled.",
    sections: [
      [
        "Information you choose to share",
        "Your shopping bag and saved favourites are stored in your browser. If you join our updates list, we store your email address. Contact messages are stored with your name, email, and message so they can be reviewed. When online ordering opens, contact and delivery information will be used to process and fulfill your order.",
      ],
      [
        "Payments",
        "Payments are currently unavailable while a provider is selected. The prepared hosted checkout sends payment details directly to the selected payment provider. This website does not collect or store card numbers.",
      ],
      [
        "Storage and requests",
        "Information submitted through the website is stored in a private server database. Please use the contact form to request access to, correction of, or deletion of the information you submitted. Marketing messages have not started; email delivery and unsubscribe handling will be connected before campaigns begin.",
      ],
      [
        "Before sales open",
        "The business's verified legal identity, contact details, retention periods, and final privacy terms will be published before live sales. This page describes the current website behavior and will be updated as services are connected.",
      ],
    ],
  },
  terms: {
    title: "A clear way to shop.",
    intro:
      "These initial terms explain how the preview storefront works while we prepare for launch.",
    sections: [
      [
        "Preview collection",
        "Product information, images, prices, and shipping quotes are illustrative and require final merchant confirmation. The catalog is not a promise of availability. Display currencies other than AZN are indicative conversions; checkout is quoted in AZN.",
      ],
      [
        "Online ordering",
        "Online payments are disabled until a payment provider is selected and connected. Adding an item to your bag does not reserve stock or place an order. An order must not be considered paid until payment is verified by the payment provider.",
      ],
      [
        "Delivery from Dubai to Baku",
        "The intended service ships products from Dubai to Baku, Azerbaijan. Delivery timelines, shipping charges, customs responsibilities, taxes, and cancellation procedures will be confirmed and published before orders are accepted.",
      ],
      [
        "Final terms",
        "The business's legal seller information, sales contract, return rights, warranty coverage, and support contact details must be finalized before launch. Mandatory rights under applicable law remain unaffected.",
      ],
    ],
  },
  returns: {
    title: "Care, beyond the checkout.",
    intro:
      "We want every purchase to have clear return and warranty information.",
    sections: [
      [
        "Return terms",
        "The storefront is currently a preview and does not accept payments. The final return window, eligibility rules, return shipping process, and refund timelines will be published before ordering opens. No return period is promised by the preview.",
      ],
      [
        "Regional warranty",
        "Warranty coverage can vary by brand, model, and regional variant. Coverage in Azerbaijan will be verified for each product before live sales. Do not assume that a Dubai-sourced device has a local manufacturer warranty.",
      ],
      [
        "Questions before you order",
        "Use the contact form on the home page to ask about a device or warranty. The final policy will include verified contact information and return instructions before orders are accepted.",
      ],
    ],
  },
  shipping: {
    title: "Dubai to your doorstep.",
    intro: "A considered journey, from Dubai to Baku, Azerbaijan.",
    sections: [
      [
        "Where we plan to deliver",
        "The initial delivery service is intended for Baku, Azerbaijan. Delivery is prepared in Dubai. Availability for other cities has not been confirmed.",
      ],
      [
        "Shipping quotes",
        "The preview shows an example delivery fee of 35 AZN, waived for a merchandise subtotal of 1,500 AZN or more. These sample amounts can be changed and must be verified before live orders. Final charges will be shown before payment.",
      ],
      [
        "Delivery timing and customs",
        "Delivery times, customs duties, import documentation, taxes, and the party responsible for each charge must be finalized before launch. No estimated arrival date is promised while the service is being prepared.",
      ],
      [
        "Returns and warranty",
        "Please read our Returns & Warranty page. Regional warranty coverage and the final returns process will be confirmed before we accept orders.",
      ],
    ],
  },
};
export function generateStaticParams() {
  return Object.keys(documents).map((policy) => ({ policy }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ policy: string }>;
}) {
  const { policy } = await params;
  return { title: documents[policy]?.title ?? "Information" };
}
export default async function PolicyPage({
  params,
}: {
  params: Promise<{ policy: string }>;
}) {
  const { policy } = await params,
    document = documents[policy];
  if (!document) notFound();
  return (
    <>
      <header className="policy-header container">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Zap size={24} fill="currentColor" />
          </span>
          <span>
            dubai<span className="brand-sub">ELECTRONICS</span>
          </span>
        </Link>
        <Link className="text-link" href="/">
          <ArrowLeft size={15} /> Back to the collection
        </Link>
      </header>
      <main className="policy-main container">
        <p className="eyebrow">DUBAI ELECTRONICS · INFORMATION</p>
        <h1>{document.title}</h1>
        <p className="policy-intro">{document.intro}</p>
        <nav className="policy-nav" aria-label="Policy documents">
          {["shipping", "returns", "privacy", "terms"].map((name) => (
            <Link
              key={name}
              href={`/policies/${name}`}
              aria-current={name === policy ? "page" : undefined}
            >
              {name === "returns"
                ? "Returns & warranty"
                : name[0].toUpperCase() + name.slice(1)}
            </Link>
          ))}
        </nav>
        {document.sections.map(([title, body]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </section>
        ))}
        <Link className="button button-dark" href="/">
          Find your next upgrade <ArrowUpRight size={17} />
        </Link>
      </main>
      <footer className="policy-footer container">
        © {new Date().getFullYear()} Dubai Electronics. From Dubai to Baku.
      </footer>
    </>
  );
}
