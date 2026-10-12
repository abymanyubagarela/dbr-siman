'use client'

import { useEffect, useMemo, useState } from 'react'
import { read, utils } from 'xlsx'
import { supabase, type Room } from '@/lib/supabase'

type RoomForm = { nama_ruang: string; jenis_ruang: string; luas: string }
const PAGE_SIZE = 8

function Icon({ children }: { children: React.ReactNode }) {
  return <span aria-hidden="true" className="inline-flex size-5 items-center justify-center text-current">{children}</span>
}

export default function Home() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [query, setQuery] = useState('')
  const [jenisRuang, setJenisRuang] = useState('Semua jenis')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState<RoomForm>({ nama_ruang: '', jenis_ruang: '', luas: '' })
  const [editing, setEditing] = useState<Room | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [detail, setDetail] = useState<Room | null>(null)
  const [importReport, setImportReport] = useState('')

  const loadRooms = async () => {
    setLoading(true); setError('')
    const { data, error: dbError } = await supabase.from('master_ruangan').select('id,nama_ruang,jenis_ruang,luas,created_at,updated_at').order('created_at', { ascending: false })
    if (dbError) setError('Data ruangan belum dapat dimuat. Periksa koneksi database dan kebijakan RLS.')
    else setRooms((data ?? []) as Room[])
    setLoading(false)
  }
  useEffect(() => { loadRooms() }, [])

  const jenisOptions = useMemo(() => Array.from(new Set(rooms.map((room) => room.nama_ruang).filter(Boolean))) as string[], [rooms])
  const filtered = rooms.filter((room) => `${room.nama_ruang} ${room.jenis_ruang ?? ''}`.toLowerCase().includes(query.toLowerCase()) && (jenisRuang === 'Semua jenis' || room.jenis_ruang === jenisRuang))
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const openCreate = () => { setEditing(null); setForm({ nama_ruang: '', jenis_ruang: '', luas: '' }); setShowForm(true) }
  const openEdit = (room: Room) => { setEditing(room); setForm({ nama_ruang: room.nama_ruang, jenis_ruang: room.jenis_ruang ?? '', luas: room.luas?.toString() ?? '' }); setShowForm(true) }
  const saveRoom = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.nama_ruang.trim() || !form.jenis_ruang.trim()) return setError('Nama ruangan dan lokasi wajib diisi.')
    const payload = { nama_ruang: form.nama_ruang.trim(), jenis_ruang: form.jenis_ruang.trim() || null, luas: form.luas.trim() ? Number(form.luas) : null }
    if (Number.isNaN(payload.luas)) return setError('Luas ruangan harus berupa angka.')
    const result = editing ? await supabase.from('master_ruangan').update(payload).eq('id', editing.id) : await supabase.from('master_ruangan').insert(payload)
    if (result.error) setError(result.error.message); else { setShowForm(false); await loadRooms() }
  }
  const removeRoom = async (room: Room) => {
    if (!window.confirm(`Hapus ruangan “${room.nama_ruang}”? Data sesi inventaris terkait dapat ikut terdampak.`)) return
    const { error: dbError } = await supabase.from('master_ruangan').delete().eq('id', room.id)
    if (dbError) setError(dbError.message); else await loadRooms()
  }
  const importExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return
    try {
      const workbook = read(await file.arrayBuffer(), { type: 'array' })
      const rows = utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: '' })
      const normalized = rows.map((row) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.toLowerCase().trim().replace(/[_\s]+/g, ' '),
      String(value ?? '').trim(),
    ])
  )
)

const headers = Object.keys(normalized[0] ?? {})
const findHeader = (names: string[]) => headers.find((header) => names.includes(header))
const nameKey = findHeader(['nama ruangan', 'nama ruang', 'nama_ruang'])
const jenisKey = findHeader(['jenis ruang', 'jenis ruangan', 'jenis_ruang'])
const luasKey = findHeader(['luas', 'luas ruangan'])

const missingColumns: string[] = []
if (!nameKey) missingColumns.push('Nama Ruang')
if (!jenisKey) missingColumns.push('Jenis Ruang')
if (!luasKey) missingColumns.push('Luas')
if (missingColumns.length > 0) {
  setImportReport(
    `Gagal: kolom ${missingColumns.join(', ')} tidak ditemukan. ` +
    `Header yang terdeteksi: ${headers.join(', ') || 'tidak ada'}.`
  )
  return
}

let success = 0
let skipped = 0
let failed = 0
for (const row of normalized) {
  const nama_ruang = row[nameKey!]?.trim()
  const jenis_ruang = row[jenisKey!]?.trim()
  const luasText = row[luasKey!]?.replace(',', '.').trim()
  if (!nama_ruang || !jenis_ruang) {
    failed += 1
    continue
  }
  const luas = luasText ? Number(luasText) : null
  if (luasText && (!Number.isFinite(luas) || luas < 0)) {
    failed += 1
    continue
  }

  const { data: duplicate } = await supabase
    .from('master_ruangan')
    .select('id')
    .eq('nama_ruang', nama_ruang)
    .eq('jenis_ruang', jenis_ruang)
    .maybeSingle()
  if (duplicate) {
    skipped += 1
    continue
  }

  const { error: insertError } = await supabase
    .from('master_ruangan')
    .insert({ nama_ruang, jenis_ruang, luas })
  if (insertError) failed += 1
  else success += 1
}

setImportReport(`Impor selesai: ${success} berhasil, ${skipped} dilewati (duplikat), ${failed} gagal.`)
await loadRooms()

} catch (error) {
  console.error('Import error:', error)

  const detail =
    typeof error === 'object' && error !== null && 'message' in error
      ? String(error.message)
      : String(error)

  setImportReport(`Gagal impor: ${detail}`)
} finally {
  event.target.value = ''
}
}

  return <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
    <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur"><div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-4 lg:px-10"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-slate-950 text-sm font-black tracking-tight text-white">S</div><div><p className="text-[11px] font-bold uppercase tracking-[0.22em] text-teal-600">SIMAN</p><p className="text-base font-bold tracking-tight text-slate-950">Sistem Inventaris Aset</p></div></div><div className="hidden items-center gap-3 sm:flex"><span className="size-2 rounded-full bg-emerald-500"/><span className="text-sm font-medium text-slate-500">Sistem online</span><div className="ml-3 size-9 rounded-full bg-teal-100 text-center text-sm font-bold leading-9 text-teal-800">AD</div></div></div></header>
    <section className="mx-auto max-w-[1400px] px-5 py-8 lg:px-10 lg:py-10"><div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700"><span className="size-1.5 rounded-full bg-teal-500"/>Master data</div><h1 className="text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">Manajemen ruangan</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Kelola daftar ruang dan identitas aset secara terpusat untuk proses inventaris yang lebih rapi.</p></div><div className="flex flex-wrap gap-3"><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"><Icon>↥</Icon>Import Excel<input type="file" accept=".xlsx,.csv" className="sr-only" onChange={importExcel}/></label><button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"><Icon>+</Icon>Tambah ruangan</button></div></div>
      <div className="mb-6 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgb(15,23,42,0.04)]"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total ruangan</p><p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{rooms.length}</p><p className="mt-1 text-xs text-slate-500">Terdaftar di sistem</p></div><div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgb(15,23,42,0.04)]"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Jenis ruang</p><p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{jenisOptions.length}</p><p className="mt-1 text-xs text-slate-500">Kategori terdaftar</p></div><div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-5 shadow-[0_8px_30px_rgb(13,148,136,0.06)]"><p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Status data</p><p className="mt-2 text-xl font-bold tracking-tight text-teal-950">{loading ? 'Memuat...' : 'Tersinkronisasi'}</p><p className="mt-1 text-xs text-teal-700/70">Pembaruan real-time</p></div></div>
      {importReport && <div className="mb-5 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-800">{importReport}</div>}{error && <div className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgb(15,23,42,0.04)]"><div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-slate-950">Daftar ruangan</h2><p className="mt-1 text-xs text-slate-500">{filtered.length} hasil dari {rooms.length} data</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100"><Icon>⌕</Icon><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} placeholder="Cari ruangan..." className="w-full bg-transparent px-2 py-2.5 text-sm outline-none placeholder:text-slate-400 sm:w-52"/></div><select value={jenisRuang} onChange={(e) => { setJenisRuang(e.target.value); setPage(1) }} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"><option>Semua jenis</option>{jenisOptions.map((item) => <option key={item}>{item}</option>)}</select></div></div>
        {loading ? <div className="p-16 text-center text-sm text-slate-500">Memuat data ruangan...</div> : visible.length === 0 ? <div className="p-16 text-center"><p className="font-semibold">Belum ada ruangan</p><p className="mt-1 text-sm text-slate-500">Tambahkan ruangan baru atau impor data dari Excel.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3.5">Nama ruangan</th><th className="px-5 py-3.5">Jenis ruang</th><th className="px-5 py-3.5">Luas (m²)</th><th className="px-5 py-3.5">ID internal</th><th className="px-5 py-3.5 text-right">Aksi</th></tr></thead><tbody className="divide-y divide-slate-100">{visible.map((room) => <tr key={room.id} className="transition hover:bg-slate-50/70"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-lg bg-teal-50 text-xs font-bold text-teal-700">{room.nama_ruang.slice(0, 2).toUpperCase()}</div><span className="font-semibold text-slate-900">{room.nama_ruang}</span></div></td><td className="px-5 py-4 text-slate-600">{room.jenis_ruang ?? '—'}</td><td className="px-5 py-4 text-slate-600">{room.luas != null ? `${room.luas} m²` : '—'}</td><td className="max-w-[220px] truncate px-5 py-4 font-mono text-xs text-slate-400">{room.id}</td><td className="px-5 py-4"><div className="flex justify-end gap-1"><button onClick={() => setDetail(room)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50">Detail</button><button onClick={() => openEdit(room)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">Edit</button><button onClick={() => removeRoom(room)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Hapus</button></div></td></tr>)}</tbody></table></div>}
        {!loading && filtered.length > 0 && <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-xs text-slate-500"><span>Halaman {page} dari {totalPages}</span><div className="flex gap-2"><button disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:opacity-40">Sebelumnya</button><button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:opacity-40">Berikutnya</button></div></div>}
      </div></section>
    {showForm && <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"><form onSubmit={saveRoom} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-6"><p className="text-xs font-bold uppercase tracking-wider text-teal-600">Master data</p><h2 className="mt-1 text-2xl font-bold">{editing ? 'Edit ruangan' : 'Tambah ruangan'}</h2></div><div className="flex flex-col gap-4"><label className="text-sm font-semibold">Nama ruangan<input required value={form.nama_ruang} onChange={(e) => setForm({ ...form, nama_ruang: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"/></label><label className="text-sm font-semibold">Lokasi<input required value={form.jenis_ruang} onChange={(e) => setForm({ ...form, jenis_ruang: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"/></label><label className="text-sm font-semibold">Luas ruangan (m²)<input type="number" min="0" step="0.01" value={form.luas} onChange={(e) => setForm({ ...form, luas: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"/></label></div><div className="mt-7 flex justify-end gap-3"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">Batal</button><button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Simpan</button></div></form></div>}
    {detail && <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-teal-600">Detail ruangan</p><h2 className="mt-1 text-2xl font-bold">{detail.nama_ruang}</h2></div><button aria-label="Tutup" onClick={() => setDetail(null)} className="rounded-lg px-2 text-2xl leading-none text-slate-400 hover:bg-slate-100">×</button></div><div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm"><p className="text-slate-500">Jenis ruang</p><strong className="mt-1 block">{detail.jenis_ruang ?? '—'}</strong><p className="mt-4 text-slate-500">Luas</p><strong className="mt-1 block">{detail.luas != null ? `${detail.luas} m²` : '—'}</strong><p className="mt-4 text-slate-500">ID stabil</p><code className="mt-1 block break-all text-xs">{detail.id}</code></div><div className="mt-6 flex justify-end gap-3"><a target="_blank" rel="noreferrer" href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(`${window.location.origin}/rooms/${detail.id}`)}`} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">Buka QR PNG</a><button onClick={() => window.print()} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Cetak</button></div></div></div>}
  </main>
}
