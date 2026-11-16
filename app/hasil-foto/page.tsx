import type { Metadata } from "next";
import UnscannedPhotosPage from "@/components/inventory/UnscannedPhotosPage";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Hasil Foto Tidak Terscan | DBR",
  description: "Daftar foto barang yang dicatat tanpa scan QR atau barcode.",
};

export const dynamic = "force-dynamic";

export default function HasilFotoPage() {
  return <AppShell bagian="Hasil Foto"><UnscannedPhotosPage /></AppShell>;
}
