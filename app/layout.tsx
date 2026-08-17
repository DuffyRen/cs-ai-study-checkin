import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CS / AI 12 周学习打卡",
  description: "从 Python 到 LLM 与 Agent 的 84 天学习打卡计划。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
