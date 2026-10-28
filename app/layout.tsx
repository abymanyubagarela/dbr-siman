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
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
