import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Opeer",
  description: "opeer真牛逼",
  keywords: ["Opeer", "匿名社交", "Threads 匿名", "話題審判", "脆匿名", "爆料擂台", "微辣AA制"],
  authors: [{ name: "Opeer Team" }],
  openGraph: {
    title: "Opeer",
    description: "opeer真牛逼",
    type: "website",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-TW"
      className={`${inter.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-black text-[#f3f5f7] select-none md:select-text">
        {children}
      </body>
    </html>
  );
}
