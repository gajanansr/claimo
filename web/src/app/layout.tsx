import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "claimo. — Ride Expense Automation",
  description: "Automatically track, sync, and generate reimbursement reports for your ride expenses.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "claimo.",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full`}
    >
      <body className="min-h-full flex flex-col bg-black antialiased">
        {children}
        <Toaster theme="dark" position="bottom-center" toastOptions={{ className: 'bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-xl shadow-lg' }} />
      </body>
    </html>
  );
}
