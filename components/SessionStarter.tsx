'use client'

import { useState } from 'react'
import QRScanner from './QRScanner'
import PhotoCapture from './PhotoCapture'

interface Props {
  sessionId: string
  roomId: string
}

export default function SessionStarter({ sessionId, roomId }: Props) {
  const [assetId, setAssetId] = useState<string | null>(null)
  const [itemsScanned, setItemsScanned] = useState(0)

  const handleScanned = (id: string) => {
    setAssetId(id)
  }

  const handlePhotoCaptured = () => {
    setAssetId(null)
    setItemsScanned((prev) => prev + 1)
  }

  const handleEndSession = () => {
    if (confirm('End inventory session?')) {
      sessionStorage.removeItem('currentSessionId')
      sessionStorage.removeItem('currentRoomId')
      window.location.href = '/'
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-secondary p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-foreground">Inventory Session</h1>
          <div className="flex gap-2">
            <span className="px-4 py-2 bg-secondary rounded-lg text-foreground text-sm font-medium">
              Items: {itemsScanned}
            </span>
            <button
              onClick={handleEndSession}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm"
            >
              End Session
            </button>
          </div>
        </div>

        {!assetId ? (
          <QRScanner sessionId={sessionId} roomId={roomId} onScanned={handleScanned} />
        ) : (
          <PhotoCapture
            sessionId={sessionId}
            assetId={assetId}
            onPhotoCaptured={handlePhotoCaptured}
            onCancel={() => setAssetId(null)}
          />
        )}
      </div>
    </main>
  )
}
