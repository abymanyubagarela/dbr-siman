import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: "DBR | Manajemen Aset BMN",
  description: "Kelola inventaris, pencarian aset, dan pencetakan label BMN.",
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
