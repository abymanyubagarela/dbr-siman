'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import RoomSelector from '@/components/RoomSelector'
import SessionStarter from '@/components/SessionStarter'

export default function Home() {
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Check if we're resuming a session
    const resumedSessionId = sessionStorage.getItem('currentSessionId')
    const resumedRoomId = sessionStorage.getItem('currentRoomId')
    if (resumedSessionId && resumedRoomId) {
      setSessionId(resumedSessionId)
      setSelectedRoom(resumedRoomId)
    }
  }, [])

  const handleRoomSelect = (roomId: string) => {
    setSelectedRoom(roomId)
  }

  const handleStartSession = async (roomId: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('inventory_sessions')
        .insert([{ room_id: roomId }])
        .select()
        .single()

      if (error) throw error

      sessionStorage.setItem('currentSessionId', data.id)
      sessionStorage.setItem('currentRoomId', roomId)
      setSessionId(data.id)
    } catch (error) {
      console.error('Failed to start session:', error)
      alert('Failed to start inventory session')
    } finally {
      setLoading(false)
    }
  }

  if (sessionId) {
    return <SessionStarter sessionId={sessionId} roomId={selectedRoom!} />
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-secondary p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-center mt-8 mb-12 text-foreground">
          Room Inventory System
        </h1>
        <RoomSelector onSelect={handleRoomSelect} onStartSession={handleStartSession} isLoading={loading} />
      </div>
    </main>
  )
}
