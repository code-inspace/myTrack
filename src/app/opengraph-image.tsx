import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "MyTrack — Le tracker d'habitudes & agenda personnalisé";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#111214",
          backgroundImage:
            "radial-gradient(circle at 50% 20%, rgba(212, 246, 61, 0.15), transparent 60%), radial-gradient(circle at 85% 85%, rgba(34, 197, 94, 0.1), transparent 50%)",
          padding: "64px 80px",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {/* Top brand header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          {/* Logo Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "16px",
                backgroundColor: "#D4F63D",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 30px rgba(212, 246, 61, 0.35)",
              }}
            >
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 17L8.5 7.5L12 14L15.5 7.5L20 17"
                  stroke="#111214"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="6" r="2" fill="#111214" />
              </svg>
            </div>
            <div style={{ display: "flex", fontSize: "32px", fontWeight: "900", color: "#FFFFFF" }}>
              My<span style={{ color: "#D4F63D" }}>Track</span>
            </div>
          </div>

          <div
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#D4F63D",
              padding: "8px 20px",
              borderRadius: "9999px",
              fontSize: "16px",
              fontWeight: "700",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            PWA & Agenda 2.0
          </div>
        </div>

        {/* Center Main Message */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            maxWidth: "960px",
            marginTop: "20px",
          }}
        >
          <div
            style={{
              fontSize: "58px",
              fontWeight: "900",
              color: "#FFFFFF",
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            Le tracker d'habitudes & agenda personnalisé
          </div>

          <div
            style={{
              fontSize: "24px",
              color: "#9CA3AF",
              fontWeight: "500",
              marginTop: "20px",
              lineHeight: 1.4,
              maxWidth: "800px",
            }}
          >
            Structure tes journées, booste ta discipline et suis tes séries quotidiennes avec un calendrier interactif et un coach IA.
          </div>
        </div>

        {/* Bottom Feature Badges */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            width: "100%",
          }}
        >
          {[
            "⚡ Agenda Timeline & Glisser-Déposer",
            "🎯 Habitudes & Streaks Quotidiens",
            "📈 Analytics & Statistiques Riches",
            "🤖 Coach IA Personnalisé",
          ].map((pill, i) => (
            <div
              key={i}
              style={{
                backgroundColor: "#1C1D22",
                border: "1px solid #2B2E38",
                color: "#E5E7EB",
                fontSize: "15px",
                fontWeight: "700",
                padding: "12px 20px",
                borderRadius: "16px",
                display: "flex",
                alignItems: "center",
              }}
            >
              {pill}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
