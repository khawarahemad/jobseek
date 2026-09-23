import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "JobOps CRM – Autonomous AI Job Search & Outreach SaaS",
  description:
    "Autonomous AI CRM that researches companies, writes hyper-personalized emails, and dispatches via your Gmail account.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className={`${inter.className} bg-[#09090b] text-zinc-100 min-h-screen antialiased selection:bg-indigo-500/20 selection:text-indigo-200`}>
        {children}
      </body>
    </html>
  );
}
