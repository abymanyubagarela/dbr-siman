import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Room = MasterRuangan

export interface MasterRuangan {
  id: string
  nama_ruang: string
  jenis_ruang: string | null
  luas: number | null
  created_at: string
  updated_at: string
}

export interface MasterAset {
  id: string
  jenis_bmn: string | null
  kode_barang: string | null
  nup: string | null
  nama_barang: string | null
  merk: string | null
  tipe: string | null
  kondisi: string | null
  umur_aset: number | null
  intra_extra: string | null
  status: string | null
  kode_register: string | null
  created_at: string
  updated_at: string
}
