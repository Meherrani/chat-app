import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MCP Search",
  description: "Live Google Search results via a local MCP server.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
