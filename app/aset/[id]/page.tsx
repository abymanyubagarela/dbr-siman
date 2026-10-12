import { supabase } from '@/lib/supabase'

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data } = await supabase.from('master_aset').select('id,nama_barang,kode_barang,nup,merk,tipe,kondisi,status').eq('id', id).maybeSingle()
  if (!data) return <main className="p-8">Aset tidak ditemukan.</main>
  return <main className="mx-auto max-w-lg p-8"><h1 className="text-2xl font-bold">{data.nama_barang ?? 'Aset'}</h1><p className="mt-2 text-slate-500">Kode: {data.kode_barang ?? '-'} · NUP: {data.nup ?? '-'}</p><dl className="mt-6 grid gap-3 rounded-xl border p-5"><div><dt className="text-xs text-slate-500">Merk / Tipe</dt><dd>{data.merk ?? '-'} / {data.tipe ?? '-'}</dd></div><div><dt className="text-xs text-slate-500">Kondisi</dt><dd>{data.kondisi ?? '-'}</dd></div><div><dt className="text-xs text-slate-500">Status</dt><dd>{data.status ?? '-'}</dd></div></dl></main>
}
