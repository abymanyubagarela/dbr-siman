import RoomDashboard from '@/components/rooms/RoomDashboard'
import { ToastProvider } from '@/components/ui/feedback'

export default function Home() {
  return <ToastProvider><RoomDashboard /></ToastProvider>
}
