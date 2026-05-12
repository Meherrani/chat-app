import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search Chat",
  description: "Conversational AI grounded in Google Search results via MCP.",
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
