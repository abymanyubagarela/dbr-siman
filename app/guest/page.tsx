import GuestInventory from "@/components/inventory/GuestInventory";
import { PageLoader } from "@/components/ui/PageLoader";

export const dynamic = "force-dynamic";

export default function GuestPage() {
  return <><GuestInventory /><PageLoader /></>;
}
