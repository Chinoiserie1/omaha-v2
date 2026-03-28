import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface VaultPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: VaultPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Vault – Omaha`,
    description: "View this vault on Omaha",
    openGraph: {
      title: `Vault – Omaha`,
      description: "Invest like the Top 0.1%",
      url: `https://omaha.sh/vault/${id}`,
    },
  };
}

export default async function VaultRedirectPage({ params }: VaultPageProps) {
  const { id } = await params;
  const deepLink = `autopilot:///vault/${id}`;

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090B",
          color: "#F8FAFC",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          textAlign: "center",
          padding: "24px",
        }}
      >
        <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "12px" }}>
          Omaha
        </h1>
        <p style={{ fontSize: "16px", color: "#94A3B8", marginBottom: "32px" }}>
          Opening vault in the Omaha app...
        </p>
        <a
          href={deepLink}
          style={{
            display: "inline-block",
            padding: "14px 32px",
            borderRadius: "12px",
            background: "#3B82F6",
            color: "#FFFFFF",
            fontWeight: 600,
            fontSize: "16px",
            textDecoration: "none",
          }}
        >
          Open in App
        </a>
        <p
          style={{
            marginTop: "24px",
            fontSize: "14px",
            color: "#64748B",
          }}
        >
          Don&apos;t have the app?{" "}
          <a
            href="https://omaha.sh"
            style={{ color: "#3B82F6", textDecoration: "underline" }}
          >
            Learn more
          </a>
        </p>

        <script
          dangerouslySetInnerHTML={{
            __html: `
              setTimeout(function() {
                window.location.href = "${deepLink}";
              }, 500);
            `,
          }}
        />
      </body>
    </html>
  );
}
