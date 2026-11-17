import type { Metadata } from "next";
import ScanRecapPage from "@/components/inventory/ScanRecapPage";
import { AppShell } from "@/components/layout/AppShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rekap Scan | DBR Manajemen Ruangan",
  description: "Rekap jumlah barang yang sudah discan berdasarkan kode barang.",
};

export default function RekapScanRoute() {
  return (
    <AppShell bagian="Rekap Scan">
      <ScanRecapPage />
    </AppShell>
  );
}
