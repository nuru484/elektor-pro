"use client";

// Root-level error boundary: replaces the entire document when the root
// layout itself fails, so it must render its own <html>/<body> and use no
// app components or global CSS (they may be what crashed).
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          alignItems: "center",
          background: "#171c28",
          color: "#f5f6f9",
          display: "flex",
          fontFamily: "system-ui, sans-serif",
          justifyContent: "center",
          margin: 0,
          minHeight: "100vh",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>
            Something went wrong.
          </h1>
          <p style={{ color: "#9aa3b4", marginTop: 12 }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#2f5fd0",
              border: "none",
              borderRadius: 9999,
              color: "#fff",
              cursor: "pointer",
              fontSize: 16,
              fontWeight: 500,
              marginTop: 24,
              padding: "12px 28px",
            }}
            type="button"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
