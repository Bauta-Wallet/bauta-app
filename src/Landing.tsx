import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();

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
      <div style={{ width: "100%", maxWidth: 520, textAlign: "center" }}>
        <img
          src="/logo.png"
          alt="bauta wallet"
          style={{ width: 163, marginBottom: 24 }}
        />

        <h1
          style={{
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            marginBottom: 12,
          }}
        >
          bauta<span style={{ color: "#e5e5e5" }}>.</span>
          <span style={{ color: "#4f46e5" }}>wallet</span>
        </h1>

        <p
          style={{
            fontSize: 14,
            color: "#555",
            marginBottom: 48,
            lineHeight: 1.8,
          }}
        >
          Privacy-first stealth payments
          <br />
          Make the trace meaningless
        </p>

        <p
          style={{
            fontSize: 11,
            color: "#333",
            marginBottom: 48,
            lineHeight: 1.8,
          }}
        >
          Self-host and unlock{" "}
          <a
            href="https://railgun.org/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#4f46e5", textDecoration: "none" }}
          >
            RAILGUN
          </a>{" "}
          private balances,
          <br />
          auto-shield and full stealth scanning.
          <br />
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "center",
          }}
        >
          <button
            onClick={() => navigate("/lookup")}
            style={{
              width: 220,
              padding: "12px 24px",
              background: "#4f46e5",
              border: "none",
              borderRadius: 6,
              color: "#fff",
              fontSize: 13,
              fontFamily: "monospace",
              cursor: "pointer",
              letterSpacing: "0.05em",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#4338ca")}
            onMouseOut={(e) => (e.currentTarget.style.background = "#4f46e5")}
          >
            send privately →
          </button>

          <a
            href="https://github.com/ivanmmurciaua/bauta-wallet"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: 220,
              padding: "12px 24px",
              boxSizing: "border-box",
              background: "none",
              border: "1px solid #1f1f1f",
              borderRadius: 6,
              color: "#555",
              fontSize: 13,
              fontFamily: "monospace",
              cursor: "pointer",
              letterSpacing: "0.05em",
              textDecoration: "none",
              display: "block",
              textAlign: "center",
            }}
            onMouseOver={(e) => (e.currentTarget.style.borderColor = "#333")}
            onMouseOut={(e) => (e.currentTarget.style.borderColor = "#1f1f1f")}
          >
            self-host →
          </a>
        </div>

        <p style={{ marginTop: 64, fontSize: 10, color: "#333" }}>
          ERC-5564 · ERC-6538 · open source
        </p>
      </div>

      <a
        href="https://github.com/Bauta-Wallet"
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
