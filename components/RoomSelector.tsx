'use client'

import { useState, useEffect } from 'react'
import { supabase, type Room } from '@/lib/supabase'

interface Props {
  onSelect: (roomId: string) => void
  onStartSession: (roomId: string) => void
  isLoading: boolean
}

export default function RoomSelector({ onSelect, onStartSession, isLoading }: Props) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [newRoomName, setNewRoomName] = useState('')
  const [showNewRoomForm, setShowNewRoomForm] = useState(false)

  useEffect(() => {
    fetchRooms()
  }, [])

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase.from('rooms').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setRooms(data || [])
    } catch (error) {
      console.error('Failed to fetch rooms:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddRoom = async () => {
    if (!newRoomName.trim()) return

    try {
      const { data, error } = await supabase
        .from('rooms')
        .insert([{ name: newRoomName, location: '' }])
        .select()
        .single()

      if (error) throw error

      setRooms([data, ...rooms])
      setNewRoomName('')
      setShowNewRoomForm(false)
    } catch (error) {
      console.error('Failed to create room:', error)
    }
  }

  const handleSelect = (roomId: string) => {
    setSelectedId(roomId)
    onSelect(roomId)
  }

  const handleStart = () => {
    if (selectedId) {
      onStartSession(selectedId)
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-foreground">Loading rooms...</div>
  }

  return (
    <div className="space-y-6">
      {showNewRoomForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-2 border-primary">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Create New Room</h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Room name (e.g., Bedroom, Kitchen)"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              className="flex-1 px-4 py-2 border border-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              onKeyPress={(e) => e.key === 'Enter' && handleAddRoom()}
            />
            <button
              onClick={handleAddRoom}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
            >
              Create
            </button>
          </div>
          <button
            onClick={() => setShowNewRoomForm(false)}
            className="mt-2 text-sm text-foreground/60 hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="grid gap-3">
        {rooms.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-foreground/60 mb-4">No rooms yet</p>
            <button
              onClick={() => setShowNewRoomForm(true)}
              className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition"
            >
              Create First Room
            </button>
          </div>
        ) : (
          <>
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => handleSelect(room.id)}
                className={`p-4 rounded-lg border-2 transition text-left ${
                  selectedId === room.id
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-secondary bg-white dark:bg-gray-800 hover:border-primary/50'
                }`}
              >
                <h3 className="font-semibold text-lg text-foreground">{room.name}</h3>
                {room.location && <p className="text-sm text-foreground/60 mt-1">{room.location}</p>}
              </button>
            ))}
            {!showNewRoomForm && (
              <button
                onClick={() => setShowNewRoomForm(true)}
                className="p-4 rounded-lg border-2 border-dashed border-secondary text-foreground/60 hover:text-foreground hover:border-primary transition"
              >
                + Add New Room
              </button>
            )}
          </>
        )}
      </div>

      {selectedId && (
        <button
          onClick={handleStart}
          disabled={isLoading}
          className="w-full py-4 bg-primary text-white text-lg font-semibold rounded-lg hover:bg-primary/90 disabled:bg-primary/50 transition"
        >
          {isLoading ? 'Starting...' : 'Start Inventory Session'}
        </button>
      )}
    </div>
  )
}
