import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import { LocalState } from "@/components/LocalState/LocalState";

export const metadata: Metadata = {
  title: "Computer Shop",
  description: "Katalog produktów komputerowych",
  authors: [{ name: "Kacper Mirocha" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body>
        <Header />
        <LocalState />
        <main>{children}</main>

        <Footer />
      </body>
    </html>
  );
}
