import GuestInventory from "@/components/inventory/GuestInventory";
import { PageLoader } from "@/components/ui/PageLoader";

export const dynamic = "force-dynamic";

export default function UserScanPage() {
  return <><GuestInventory title="Inventarisasi User" showTabs /><PageLoader /></>;
}
