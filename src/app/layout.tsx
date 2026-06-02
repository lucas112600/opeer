import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Opper",
  description: "Opper 是一個 Threads 風格的公共話題審判與匿名社交擂台。在這裡你可以自訂主題、大膽爆料，享受物理隔離級別的匿名安全保護，並一鍵下載 👍/👎 得票比例極簡限動戰報，反向引流全新社交市場！",
  keywords: ["Opper", "匿名社交", "Threads 匿名", "話題審判", "脆匿名", "爆料擂台", "微辣AA制"],
  authors: [{ name: "Opper Team" }],
  openGraph: {
    title: "Opper",
    description: "拋開社交包袱，直面真實輿論！Opper 提供物理隔離的匿名防禦，發表文章接受大眾投標，並能一鍵轉化為迷因戰報限動圖卡。",
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
