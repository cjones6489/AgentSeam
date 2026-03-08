import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentSeam",
  description: "Approval layer for risky AI agent actions.",
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
