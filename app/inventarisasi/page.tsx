import InventoryModule from '@/components/inventory/InventoryModule'
import { AppShell } from '@/components/layout/AppShell'

export const dynamic = 'force-dynamic'

export default function InventarisasiPage() {
  return <AppShell bagian="Inventarisasi"><InventoryModule /></AppShell>
}
