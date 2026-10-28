export default function NotFound() {
  return (
    <main className="public-page">
      <section className="public-card">
        <h1>This page is unavailable.</h1>
        <p>The link may have expired or its owner may have deleted the shared content.</p>
        <a className="button primary" href="/">
          Go to workspace
        </a>
      </section>
    </main>
  );
}
