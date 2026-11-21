import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./fonts.css";


export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  const title = "TradeReview — 历史交易复盘";
  const description =
    "导入券商成交，遮蔽未来行情，逐根复盘每一次真实决策。";
  const image = new URL("/og.png", metadataBase).href;

  return {
    metadataBase,
    title,
    description,
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title,
      description,
      images: [{ url: image, width: 1731, height: 909 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className="antialiased"
      >
        {children}
      </body>
    </html>
  );
}
