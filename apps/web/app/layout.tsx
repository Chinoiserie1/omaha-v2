import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Omaha",
  description: "Invest on the Signals of the Top 1%",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
