import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Используем Node runtime, чтобы читать локальный icon.png через fs
export const runtime = "nodejs";
export const alt = "CapyRun — ИИ-тренер по бегу для начинающих и любителей";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logoData = await readFile(join(process.cwd(), "app/icon.png"));
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px 80px 64px",
          background:
            "radial-gradient(900px 500px at 90% 0%, #FFD699 0%, transparent 60%), radial-gradient(700px 400px at 0% 100%, #FFF8CC 0%, transparent 60%), #FFF6DE",
          fontFamily: "sans-serif",
        }}
      >
        {/* Logo + brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img
            src={logoSrc}
            alt=""
            width={64}
            height={64}
            style={{
              objectFit: "contain",
              borderRadius: 14,
            }}
          />
          <div
            style={{
              fontSize: 36,
              fontWeight: 700,
              color: "#0E0E0E",
              letterSpacing: "-0.02em",
            }}
          >
            CapyRun
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 16px",
              background: "white",
              border: "1px solid rgba(14,14,14,0.1)",
              borderRadius: 999,
              fontSize: 22,
              color: "#595958",
              alignSelf: "flex-start",
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                background: "#4ABE7C",
              }}
            />
            ИИ-тренер по бегу · в бете
          </div>

          <div
            style={{
              fontSize: 84,
              fontWeight: 600,
              color: "#0E0E0E",
              letterSpacing: "-0.035em",
              lineHeight: 1,
              maxWidth: 1000,
            }}
          >
            Бегайте умнее{" "}
            <span style={{ color: "#DF6133", fontStyle: "italic" }}>
              без живого тренера
            </span>
          </div>

          <div
            style={{
              fontSize: 28,
              color: "#595958",
              lineHeight: 1.4,
              maxWidth: 900,
            }}
          >
            План под ваш уровень, понятные тренировки и спокойный ИИ-собеседник,
            который всегда на связи.
          </div>
        </div>

        {/* Footer row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#595958",
            fontSize: 22,
          }}
        >
          <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
            <span style={{ fontWeight: 600, color: "#0E0E0E" }}>Strava</span>
            <span>Garmin</span>
            <span>Polar</span>
            <span>Coros</span>
            <span>Apple Watch</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 22px",
              background:
                "linear-gradient(180deg, #E97644 0%, #DF6133 55%, #C9521F 100%)",
              color: "white",
              borderRadius: 999,
              fontWeight: 600,
              fontSize: 22,
            }}
          >
            capyrun.com
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
