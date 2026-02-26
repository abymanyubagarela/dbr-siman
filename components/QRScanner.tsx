'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  sessionId: string
  roomId: string
  onScanned: (assetId: string) => void
}

export default function QRScanner({ sessionId, onScanned }: Props) {
  const [manualAssetId, setManualAssetId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [lastScannedIds, setLastScannedIds] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleAssetIdSubmit = async (assetId: string) => {
    if (!assetId.trim()) {
      setErrorMessage('Asset ID cannot be empty')
      return
    }

    try {
      // Check if asset already exists in this session
      const { data: existing } = await supabase
        .from('inventory_items')
        .select('id')
        .eq('session_id', sessionId)
        .eq('asset_id', assetId)
        .single()

      if (existing) {
        setErrorMessage(`Asset ${assetId} already scanned in this session`)
        setManualAssetId('')
        setTimeout(() => setErrorMessage(''), 3000)
        return
      }

      // Create inventory item
      const { error } = await supabase
        .from('inventory_items')
        .insert([
          {
            session_id: sessionId,
            asset_id: assetId,
            status: 'scanned',
          },
        ])

      if (error) throw error

      setLastScannedIds([assetId, ...lastScannedIds.slice(0, 4)])
      setManualAssetId('')
      setErrorMessage('')
      onScanned(assetId)
    } catch (error) {
      console.error('Error scanning asset:', error)
      setErrorMessage('Failed to record asset')
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 border-2 border-primary">
        <h2 className="text-2xl font-bold mb-6 text-center text-foreground">Scan or Enter Asset ID</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Asset ID</label>
            <input
              ref={inputRef}
              type="text"
              value={manualAssetId}
              onChange={(e) => {
                setManualAssetId(e.target.value)
                setErrorMessage('')
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAssetIdSubmit(manualAssetId)
                }
              }}
              placeholder="Scan QR code or enter asset ID"
              className="w-full px-4 py-3 border-2 border-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-lg"
            />
          </div>

          {errorMessage && <div className="text-red-500 text-sm font-medium">{errorMessage}</div>}

          <button
            onClick={() => handleAssetIdSubmit(manualAssetId)}
            className="w-full py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition"
          >
            Scan Item
          </button>
        </div>

        {lastScannedIds.length > 0 && (
          <div className="mt-6 pt-6 border-t border-secondary">
            <p className="text-sm text-foreground/60 mb-3">Recently scanned:</p>
            <div className="flex flex-wrap gap-2">
              {lastScannedIds.map((id) => (
                <span
                  key={id}
                  className="px-3 py-1 bg-secondary text-foreground text-sm rounded-full font-medium"
                >
                  {id}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Tip:</strong> Scan QR codes from assets or manually enter asset IDs. After scanning, you'll be prompted to take a photo.
        </p>
      </div>
    </div>
  )
}
