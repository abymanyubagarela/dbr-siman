import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Room Inventory System',
  description: 'Scan and photograph room inventory with asset IDs',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
