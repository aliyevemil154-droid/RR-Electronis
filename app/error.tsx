"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="error-page">
      <div>
        <p className="eyebrow">A BRIEF PAUSE</p>
        <h1>
          A little moment.
          <br />
          <span>We’ll be right back.</span>
        </h1>
        <p>
          Something interrupted this page. Please try again to continue
          exploring.
        </p>
        <button className="button button-dark" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
