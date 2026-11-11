import ScannedItemsPage from "@/components/inventory/ScannedItemsPage";
import { AppShell } from "@/components/layout/AppShell";

export const dynamic = "force-dynamic";

export default function HasilScanPage() {
  return <AppShell bagian="Hasil Scan"><ScannedItemsPage /></AppShell>;
}
