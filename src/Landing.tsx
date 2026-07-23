export default function Landing() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#e5e5e5",
        fontFamily: "monospace",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 720, textAlign: "center" }}>
        <img
          src="/logo.png"
          alt="bauta"
          style={{ width: "clamp(160px, 18vw, 240px)", marginBottom: 28 }}
        />

        <h1
          style={{
            fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            marginBottom: 24,
          }}
        >
          bauta
        </h1>

        {/* Headline: beachhead audience (apps + AI agents). */}
        <p
          style={{
            fontSize: "clamp(1.25rem, 3vw, 2.25rem)",
            fontWeight: 600,
            color: "#e5e5e5",
            marginBottom: 18,
            lineHeight: 1.5,
          }}
        >
          The privacy engine for apps &amp; AI agents
        </p>

        {/* Subtitle: the angle (engine, not a wallet), not a feature list. */}
        <p
          style={{
            fontSize: "clamp(0.95rem, 1.5vw, 1.25rem)",
            color: "#666",
            marginBottom: 48,
            lineHeight: 1.7,
          }}
        >
          Private by default for any account you already use. Bring your own
          wallet, Bauta adds the privacy layer. Embeddable in any stack.
        </p>

        {/* CTA: links to the live docs. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "center",
          }}
        >
          <a
            href="https://bauta-labs.github.io/sdk"
            style={{
              width: "clamp(220px, 22vw, 280px)",
              padding: "14px 28px",
              background: "#4f46e5",
              border: "none",
              borderRadius: 6,
              color: "#fff",
              fontSize: "clamp(0.85rem, 1.2vw, 1rem)",
              fontFamily: "monospace",
              cursor: "pointer",
              letterSpacing: "0.05em",
              textDecoration: "none",
              display: "inline-block",
              boxSizing: "border-box",
              textAlign: "center",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#4338ca")}
            onMouseOut={(e) => (e.currentTarget.style.background = "#4f46e5")}
          >
            Get started →
          </a>

          <span
            style={{
              fontSize: "clamp(0.7rem, 1vw, 0.85rem)",
              color: "#555",
              letterSpacing: "0.04em",
            }}
          >
            For institutions: coming soon
          </span>
        </div>

        {/* Trust badge: Kohaku as "built on", not the headline. Drop the fish
            SVG into public/ and swap the placeholder mark below for an <img>. */}
        <div
          style={{
            marginTop: 64,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            fontSize: "clamp(0.7rem, 1vw, 0.9rem)",
            color: "#444",
            letterSpacing: "0.04em",
          }}
        >
          <img src="/kohaku.svg" alt="Kohaku" style={{ height: "clamp(48px, 7vw, 88px)" }} />
          <span>Built on Ethereum&apos;s Kohaku</span>
        </div>
      </div>

      <a
        href="https://github.com/bauta-labs"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          opacity: 0.4,
          textDecoration: "none",
        }}
        onMouseOver={(e) => (e.currentTarget.style.opacity = "0.8")}
        onMouseOut={(e) => (e.currentTarget.style.opacity = "0.4")}
      >
        <svg
          height="20"
          viewBox="0 0 24 24"
          fill="#e5e5e5"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
      </a>
    </div>
  );
}
