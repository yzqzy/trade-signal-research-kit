import type { ReactNode } from "react";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { ThemeProvider } from "@/components/ThemeProvider";

import logo from "../public/logo.svg";

import "./globals.css";

export const metadata = {
  title: "研报中心 | TradeSignal",
  description: "研究报告时间流与条目详情。",
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="zh-CN"
      dir="ltr"
      suppressHydrationWarning
      className="min-h-full bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100"
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href={logo.src} />
      </head>
      <body className="rh-body min-h-full bg-inherit text-inherit antialiased">
        <ThemeProvider>
          <SiteHeader />
          <main className="min-h-0 flex-1">{children}</main>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
