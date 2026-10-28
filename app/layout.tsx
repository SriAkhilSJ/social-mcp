import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { AuthFetchBridge } from "@/components/auth-fetch-bridge";

export const metadata: Metadata = {
  title: "Socialix — AI Social Media Agent Team Platform",
  description:
    "Build, orchestrate, schedule, and publish social media campaigns with your autonomous AI Agent Team.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <AuthFetchBridge />
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
