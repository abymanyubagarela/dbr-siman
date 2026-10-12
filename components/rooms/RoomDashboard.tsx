'use client'

import { useEffect, useMemo, useState } from 'react'
import { read, utils } from 'xlsx'
import { supabase, type MasterRuangan } from '@/lib/supabase'

type FormRuangan = { nama_ruang: string; jenis_ruang: string; luas: string }
const kosong: FormRuangan = { nama_ruang: '', jenis_ruang: '', luas: '' }

export function RoomDashboard() {
  const [ruangan, setRuangan] = useState<MasterRuangan[]>([])
  const [memuat, setMemuat] = useState(true)
  const [pesan, setPesan] = useState('')
  const [kesalahan, setKesalahan] = useState('')
  const [kataKunci, setKataKunci] = useState('')
  const [jenis, setJenis] = useState('Semua jenis')
  const [halaman, setHalaman] = useState(1)
  const [form, setForm] = useState<FormRuangan>(kosong)
  const [edit, setEdit] = useState<MasterRuangan | null>(null)
  const [modal, setModal] = useState(false)
  const [detail, setDetail] = useState<MasterRuangan | null>(null)

  const muatRuangan = async () => {
    setMemuat(true)
    const { data, error } = await supabase.from('master_ruangan').select('id,nama_ruang,jenis_ruang,luas,created_at,updated_at').order('created_at', { ascending: false })
    if (error) setKesalahan('Data ruangan belum dapat dimuat. Periksa koneksi dan izin database.')
    else setRuangan((data ?? []) as MasterRuangan[])
    setMemuat(false)
  }
  useEffect(() => { void muatRuangan() }, [])

  const pilihanJenis = useMemo(() => Array.from(new Set(ruangan.map((item) => item.jenis_ruang).filter(Boolean))) as string[], [ruangan])
  const hasil = useMemo(() => ruangan.filter((item) => `${item.nama_ruang} ${item.nama_ruang?? ''}`.toLowerCase().includes(kataKunci.toLowerCase()) && (jenis === 'Semua jenis' || item.jenis_ruang === jenis)), [ruangan, kataKunci, jenis])
  const totalHalaman = Math.max(1, Math.ceil(hasil.length / 8))
  const tampak = hasil.slice((halaman - 1) * 8, halaman * 8)

  const bukaTambah = () => { setEdit(null); setForm(kosong); setKesalahan(''); setModal(true) }
  const bukaEdit = (item: MasterRuangan) => { setEdit(item); setForm({ nama_ruang: item.nama_ruang, jenis_ruang: item.jenis_ruang ?? '', luas: item.luas?.toString() ?? '' }); setKesalahan(''); setModal(true) }
  const simpan = async (event: React.FormEvent) => {
    event.preventDefault(); setKesalahan('')
    const luas = form.luas.trim() ? Number(form.luas.replace(',', '.')) : null
    if (!form.nama_ruang.trim()) return setKesalahan('Nama ruang wajib diisi.')
    if (form.luas.trim() && (luas === null || !Number.isFinite(luas) || luas < 0)) return setKesalahan('Luas harus berupa angka positif.')
    const data = { nama_ruang: form.nama_ruang.trim(), jenis_ruang: form.jenis_ruang.trim() || null, luas }
    const hasilSimpan = edit ? await supabase.from('master_ruangan').update({ ...data, updated_at: new Date().toISOString() }).eq('id', edit.id).select('id').maybeSingle() : await supabase.from('master_ruangan').insert(data).select('id').maybeSingle()
    if (hasilSimpan.error || !hasilSimpan.data) return setKesalahan(hasilSimpan.error?.message ?? 'Perubahan tidak tersimpan.')
    setModal(false); setPesan(edit ? 'Data ruangan berhasil diperbarui.' : 'Ruangan baru berhasil ditambahkan.'); await muatRuangan()
  }
  const hapus = async (item: MasterRuangan) => {
    if (!window.confirm(`Hapus ruang “${item.nama_ruang}”?`)) return
    const hasilHapus = await supabase.from('master_ruangan').delete().eq('id', item.id).select('id').maybeSingle()
    if (hasilHapus.error || !hasilHapus.data) return setKesalahan(hasilHapus.error?.message ?? 'Ruangan tidak terhapus.')
    setPesan('Ruangan berhasil dihapus.'); if (detail?.id === item.id) setDetail(null); await muatRuangan()
  }
  const imporExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return
    try {
      const buku = read(await file.arrayBuffer(), { type: 'array' }); const baris = utils.sheet_to_json<Record<string, unknown>>(buku.Sheets[buku.SheetNames[0]], { defval: '' })
      const data = baris.map((baris) => { const normal: Record<string, string> = {}; Object.entries(baris).forEach(([k, v]) => { normal[k.toLowerCase().trim().replace(/[_\s]+/g, ' ')] = String(v ?? '').trim() }); return normal })
      let berhasil = 0; let dilewati = 0; let gagal = 0
      for (const item of data) {
        const nama = item['nama ruang'] || item['nama ruangan'] || item.nama_ruang; const tipe = item['jenis ruang'] || item['jenis ruangan'] || item.jenis_ruang; const luasTeks = (item.luas || item['luas ruangan'] || '').replace(',', '.'); const luas = luasTeks ? Number(luasTeks) : null
        if (!nama || (luasTeks && !Number.isFinite(luas))) { gagal++; continue }
        const duplikat = await supabase.from('master_ruangan').select('id').eq('nama_ruang', nama).eq('jenis_ruang', tipe || '').maybeSingle()
        if (duplikat.data) { dilewati++; continue }
        const masuk = await supabase.from('master_ruangan').insert({ nama_ruang: nama, jenis_ruang: tipe || null, luas })
        masuk.error ? gagal++ : berhasil++
      }
      setPesan(`Impor selesai: ${berhasil} berhasil, ${dilewati} duplikat dilewati, ${gagal} gagal.`); await muatRuangan()
    } catch { setKesalahan('File Excel tidak dapat dibaca. Gunakan format .xlsx atau .csv.') } finally { event.target.value = '' }
  }

  return <main className="min-h-screen overflow-hidden bg-[#07111f] text-slate-100"><div className="pointer-events-none fixed inset-0"><div className="absolute -left-32 -top-32 size-[28rem] rounded-full bg-cyan-500/15 blur-3xl"/><div className="absolute right-0 top-1/3 size-[24rem] rounded-full bg-violet-500/15 blur-3xl"/></div>
    <header className="relative border-b border-white/10 bg-white/[0.04] backdrop-blur-xl"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-2xl bg-cyan-400 font-black text-slate-950 shadow-lg shadow-cyan-400/20">S</div><div><p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300">SIMAN</p><p className="font-semibold">Sistem Inventaris Aset Negara</p></div></div><div className="flex items-center gap-2 text-xs text-slate-300"><span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_12px] shadow-emerald-400"/>Sistem aktif</div></div></header>
    <section className="relative mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-12"><div className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div><p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Pusat kendali aset</p><h1 className="text-4xl font-black tracking-[-0.05em] sm:text-5xl">Manajemen ruang</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Kelola data master ruangan secara terpusat, cepat, dan siap digunakan untuk inventarisasi.</p></div><div className="flex flex-wrap gap-3"><label className="cursor-pointer rounded-2xl border border-white/15 bg-white/[0.08] px-4 py-3 text-sm font-semibold backdrop-blur-xl transition hover:bg-white/[0.14]">Impor Excel<input type="file" accept=".xlsx,.csv" className="sr-only" onChange={imporExcel}/></label><button onClick={bukaTambah} className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-400/20 transition hover:bg-cyan-300">+ Tambah ruang</button></div></div>
      <div className="mb-6 grid gap-4 sm:grid-cols-3"><Stat label="Total ruang" value={ruangan.length} caption="Terdaftar di sistem"/><Stat label="Jenis ruang" value={pilihanJenis.length} caption="Kategori aktif"/><div className="rounded-3xl border border-emerald-300/20 bg-emerald-400/10 p-5 backdrop-blur-xl"><p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Status data</p><p className="mt-3 text-xl font-black">{memuat ? 'Memuat...' : 'Tersinkronisasi'}</p><p className="mt-1 text-xs text-emerald-200/70">Pembaruan terbaru tersedia</p></div></div>
      {pesan && <Notice tone="info" text={pesan}/>} {kesalahan && <Notice tone="error" text={kesalahan}/>}<div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.07] shadow-2xl shadow-black/20 backdrop-blur-xl"><div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold">Daftar ruang</h2><p className="mt-1 text-xs text-slate-400">{hasil.length} hasil dari {ruangan.length} data</p></div><div className="flex flex-col gap-2 sm:flex-row"><input value={kataKunci} onChange={(e) => { setKataKunci(e.target.value); setHalaman(1) }} placeholder="Cari nama atau jenis..." className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none placeholder:text-slate-500 focus:border-cyan-300"/><select value={jenis} onChange={(e) => { setJenis(e.target.value); setHalaman(1) }} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm outline-none focus:border-cyan-300"><option>Semua jenis</option>{pilihanJenis.map((item) => <option key={item}>{item}</option>)}</select></div></div>
        {memuat ? <div className="p-16 text-center text-sm text-slate-400">Memuat data ruang...</div> : tampak.length === 0 ? <div className="p-16 text-center"><p className="font-semibold">Belum ada data ruang</p><p className="mt-2 text-sm text-slate-400">Tambahkan data baru atau impor dari Excel.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-black/10 text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-4">Nama ruang</th><th className="px-5 py-4">Jenis ruang</th><th className="px-5 py-4">Luas</th><th className="px-5 py-4 text-right">Aksi</th></tr></thead><tbody className="divide-y divide-white/10">{tampak.map((item) => <tr key={item.id} className="transition hover:bg-white/[0.05]"><td className="px-5 py-4 font-semibold">{item.nama_ruang}</td><td className="px-5 py-4 text-slate-300">{item.jenis_ruang || 'Belum diisi'}</td><td className="px-5 py-4 text-slate-300">{item.luas != null ? `${item.luas} m²` : 'Belum diisi'}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => setDetail(item)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-300/10">Detail</button><button onClick={() => bukaEdit(item)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Edit</button><button onClick={() => void hapus(item)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-300/10">Hapus</button></div></td></tr>)}</tbody></table></div>}
        {hasil.length > 0 && <div className="flex items-center justify-between border-t border-white/10 px-5 py-4 text-xs text-slate-400"><span>Halaman {halaman} dari {totalHalaman}</span><div className="flex gap-2"><button disabled={halaman === 1} onClick={() => setHalaman(halaman - 1)} className="rounded-lg border border-white/10 px-3 py-2 disabled:opacity-30">Sebelumnya</button><button disabled={halaman === totalHalaman} onClick={() => setHalaman(halaman + 1)} className="rounded-lg border border-white/10 px-3 py-2 disabled:opacity-30">Berikutnya</button></div></div>}</div></section>
    {modal && <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"><form onSubmit={simpan} className="w-full max-w-md rounded-3xl border border-white/15 bg-[#102033] p-6 shadow-2xl"><p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Master ruang</p><h2 className="mt-2 text-2xl font-black">{edit ? 'Edit data ruang' : 'Tambah ruang'}</h2><div className="mt-6 flex flex-col gap-4"><Field label="Nama ruang" value={form.nama_ruang} onChange={(value) => setForm({ ...form, nama_ruang: value })} required/><Field label="Jenis ruang" value={form.jenis_ruang} onChange={(value) => setForm({ ...form, jenis_ruang: value })}/><Field label="Luas ruang (m²)" type="number" value={form.luas} onChange={(value) => setForm({ ...form, luas: value })}/></div><div className="mt-7 flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold">Batal</button><button className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950">Simpan data</button></div></form></div>}
    {detail && <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"><div className="w-full max-w-md rounded-3xl border border-white/15 bg-[#102033] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Detail ruang</p><h2 className="mt-2 text-2xl font-black">{detail.nama_ruang}</h2></div><button onClick={() => setDetail(null)} aria-label="Tutup detail" className="text-2xl text-slate-400">×</button></div><div className="mt-6 rounded-2xl bg-black/20 p-4 text-sm"><p className="text-slate-400">Jenis ruang</p><strong className="mt-1 block">{detail.jenis_ruang || 'Belum diisi'}</strong><p className="mt-4 text-slate-400">Luas ruang</p><strong className="mt-1 block">{detail.luas != null ? `${detail.luas} m²` : 'Belum diisi'}</strong></div></div></div>}
  </main>
}

function Stat({ label, value, caption }: { label: string; value: number; caption: string }) { return <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-5 backdrop-blur-xl"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-3 text-3xl font-black">{value}</p><p className="mt-1 text-xs text-slate-400">{caption}</p></div> }
function Notice({ tone, text }: { tone: 'info' | 'error'; text: string }) { return <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${tone === 'error' ? 'border-rose-300/20 bg-rose-400/10 text-rose-200' : 'border-cyan-300/20 bg-cyan-400/10 text-cyan-200'}`}>{text}</div> }
function Field({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label className="text-sm font-semibold text-slate-200">{label}<input required={required} type={type} min={type === 'number' ? '0' : undefined} step={type === 'number' ? '0.01' : undefined} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 font-normal outline-none focus:border-cyan-300"/></label> }

export default RoomDashboard
