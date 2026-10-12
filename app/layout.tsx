import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SIMAN | Manajemen Ruangan',
  description: 'Kelola data ruangan dan inventaris aset secara terpusat.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
