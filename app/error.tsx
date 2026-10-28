'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="public-page">
      <section className="public-card">
        <h1>We couldn’t load this page.</h1>
        <p>Check the deployment’s database and configuration, then try again.</p>
        <button className="button primary" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
