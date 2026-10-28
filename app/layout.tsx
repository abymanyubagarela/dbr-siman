import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: "DBR | Manajemen Ruangan",
  description: "Kelola data ruangan dan inventaris aset secara terpusat.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head><link rel="stylesheet" href="https://site-assets.fontawesome.com/releases/v6.7.2/css/all.css" /></head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
