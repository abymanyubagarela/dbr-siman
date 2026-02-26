import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Room = {
  id: string
  name: string
  location: string | null
  created_at: string
}

export type InventorySession = {
  id: string
  room_id: string
  started_at: string
  created_by: string | null
}

export type InventoryItem = {
  id: string
  session_id: string
  asset_id: string | null
  image_url: string | null
  status: 'scanned' | 'photographed'
  created_at: string
}
