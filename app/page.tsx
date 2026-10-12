'use client'

import { useEffect, useMemo, useState } from 'react'
import { read, utils } from 'xlsx'
import { supabase, type Room } from '@/lib/supabase'

type RoomForm = { name: string; location: string }
const PAGE_SIZE = 8

export default function Home() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('Semua lokasi')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState<RoomForm>({ name: '', location: '' })
  const [editing, setEditing] = useState<Room | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [detail, setDetail] = useState<Room | null>(null)
  const [importReport, setImportReport] = useState<string>('')

  const loadRooms = async () => {
    setLoading(true); setError('')
    const { data, error: dbError } = await supabase.from('rooms').select('id,name,location,created_at').order('created_at', { ascending: false })
    if (dbError) setError('Data ruangan belum dapat dimuat. Periksa koneksi database dan kebijakan RLS.')
    else setRooms((data ?? []) as Room[])
    setLoading(false)
  }
  useEffect(() => { loadRooms() }, [])

  const locations = useMemo(() => Array.from(new Set(rooms.map((room) => room.location).filter(Boolean))) as string[], [rooms])
  const filtered = rooms.filter((room) => `${room.name} ${room.location ?? ''}`.toLowerCase().includes(query.toLowerCase()) && (location === 'Semua lokasi' || room.location === location))
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const openCreate = () => { setEditing(null); setForm({ name: '', location: '' }); setShowForm(true) }
  const openEdit = (room: Room) => { setEditing(room); setForm({ name: room.name, location: room.location ?? '' }); setShowForm(true) }
  const saveRoom = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.name.trim() || !form.location.trim()) return setError('Nama ruangan dan lokasi wajib diisi.')
    const result = editing
      ? await supabase.from('rooms').update({ name: form.name.trim(), location: form.location.trim() }).eq('id', editing.id)
      : await supabase.from('rooms').insert({ name: form.name.trim(), location: form.location.trim() })
    if (result.error) setError(result.error.message)
    else { setShowForm(false); await loadRooms() }
  }
  const removeRoom = async (room: Room) => {
    if (!window.confirm(`Hapus ruangan “${room.name}”? Data sesi inventaris terkait dapat ikut terdampak.`)) return
    const { error: dbError } = await supabase.from('rooms').delete().eq('id', room.id)
    if (dbError) setError(dbError.message); else await loadRooms()
  }
  const importExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return
    try {
      const workbook = read(await file.arrayBuffer(), { type: 'array' })
      const rows = utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: '' })
      const normalized = rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase().trim(), String(value).trim()])))
      const nameKey = Object.keys(normalized[0] ?? {}).find((key) => ['nama ruangan', 'nama', 'name'].includes(key))
      const locationKey = Object.keys(normalized[0] ?? {}).find((key) => ['lokasi', 'location', 'gedung'].includes(key))
      if (!nameKey || !locationKey) return setImportReport('Gagal: header wajib “Nama Ruangan” dan “Lokasi” tidak ditemukan.')
      let success = 0, skipped = 0, failed = 0
      for (const row of normalized) {
        const name = row[nameKey]?.trim(), roomLocation = row[locationKey]?.trim()
        if (!name || !roomLocation) { failed++; continue }
        if (rooms.some((room) => room.name.toLowerCase() === name.toLowerCase() && (room.location ?? '').toLowerCase() === roomLocation.toLowerCase())) { skipped++; continue }
        const { error: insertError } = await supabase.from('rooms').insert({ name, location: roomLocation })
        if (insertError) failed++; else success++
      }
      setImportReport(`Impor selesai: ${success} berhasil, ${skipped} dilewati (duplikat), ${failed} gagal.`); await loadRooms()
    } catch { setImportReport('Gagal membaca file. Gunakan format .xlsx atau .csv dengan header yang sesuai.') }
    event.target.value = ''
  }

  return <main className="min-h-screen bg-[#f6f8fb] text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">SIMAN</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Manajemen Ruangan</h1></div><div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">Inventaris aset</div></div></header>
    <section className="mx-auto max-w-7xl px-6 py-8"><div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm text-slate-500">Kelola daftar ruang dan identitas QR secara terpusat.</p><p className="mt-2 text-sm text-slate-500"><span className="font-semibold text-slate-900">{rooms.length}</span> ruangan terdaftar</p></div><div className="flex flex-wrap gap-3"><label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:bg-slate-50">Import Excel<input type="file" accept=".xlsx,.csv" className="sr-only" onChange={importExcel} /></label><button onClick={openCreate} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">+ Tambah Ruangan</button></div></div>
      {importReport && <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">{importReport}</div>}{error && <div className="mb-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row"><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} placeholder="Cari nama ruangan atau lokasi..." className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /><select value={location} onChange={(e) => { setLocation(e.target.value); setPage(1) }} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-blue-500"><option>Semua lokasi</option>{locations.map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{loading ? <div className="p-12 text-center text-sm text-slate-500">Memuat data ruangan...</div> : visible.length === 0 ? <div className="p-12 text-center"><p className="font-semibold">Belum ada ruangan</p><p className="mt-1 text-sm text-slate-500">Tambahkan ruangan baru atau impor data dari Excel.</p></div> : <table className="w-full text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-4">Nama Ruangan</th><th className="px-5 py-4">Lokasi</th><th className="px-5 py-4">ID Internal</th><th className="px-5 py-4 text-right">Aksi</th></tr></thead><tbody className="divide-y divide-slate-100">{visible.map((room) => <tr key={room.id} className="hover:bg-slate-50"><td className="px-5 py-4 font-semibold">{room.name}</td><td className="px-5 py-4 text-slate-600">{room.location ?? '—'}</td><td className="max-w-[220px] truncate px-5 py-4 font-mono text-xs text-slate-400">{room.id}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => setDetail(room)} className="rounded-md px-2 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">Detail</button><button onClick={() => openEdit(room)} className="rounded-md px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">Edit</button><button onClick={() => removeRoom(room)} className="rounded-md px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Hapus</button></div></td></tr>)}</tbody></table>}{!loading && filtered.length > 0 && <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-sm text-slate-500"><span>Halaman {page} dari {totalPages}</span><div className="flex gap-2"><button disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded-md border px-3 py-1.5 disabled:opacity-40">Sebelumnya</button><button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="rounded-md border px-3 py-1.5 disabled:opacity-40">Berikutnya</button></div></div>}</div>
    </section>
    {showForm && <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4"><form onSubmit={saveRoom} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h2 className="text-xl font-bold">{editing ? 'Edit Ruangan' : 'Tambah Ruangan'}</h2><div className="mt-5 flex flex-col gap-4"><label className="text-sm font-medium">Nama Ruangan<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 outline-none focus:border-blue-500" /></label><label className="text-sm font-medium">Lokasi<input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 outline-none focus:border-blue-500" /></label></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm font-semibold">Batal</button><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Simpan</button></div></form></div>}
    {detail && <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-blue-600">DETAIL RUANGAN</p><h2 className="mt-1 text-2xl font-bold">{detail.name}</h2></div><button onClick={() => setDetail(null)} className="text-2xl text-slate-400">×</button></div><div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm"><p><span className="text-slate-500">Lokasi</span><br /><strong>{detail.location}</strong></p><p className="mt-4"><span className="text-slate-500">ID stabil</span><br /><code className="break-all">{detail.id}</code></p></div><div className="mt-5 flex justify-end gap-3"><a target="_blank" rel="noreferrer" href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(`${window.location.origin}/rooms/${detail.id}`)}`} className="rounded-lg border px-4 py-2 text-sm font-semibold">Buka QR PNG</a><button onClick={() => window.print()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Cetak</button></div><p className="mt-3 text-xs text-slate-400">QR mengarah ke halaman detail berdasarkan ID internal yang tidak berubah saat data diedit.</p></div></div>}
  </main>
}
