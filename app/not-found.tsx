import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
export default function NotFound() {
  return (
    <main className="error-page">
      <div>
        <p className="eyebrow">A SMALL DETOUR</p>
        <h1>
          Let’s get you
          <br />
          <span>back to possibility.</span>
        </h1>
        <p>
          We couldn’t find that page. Your next great upgrade is still waiting
          in the collection.
        </p>
        <Link className="button button-dark" href="/">
          Back to the collection <ArrowUpRight size={18} />
        </Link>
      </div>
    </main>
  );
}
