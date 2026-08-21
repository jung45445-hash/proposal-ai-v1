import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Proposal AI V1",
  description: "전시·체험사업 제안서 AI 프로토타입",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
