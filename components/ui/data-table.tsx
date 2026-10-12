'use client'

import { useMemo } from 'react'
import { Tombol } from './feedback'

export function TableToolbar({ children }: { children: React.ReactNode }) { return <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">{children}</div> }
export function TablePagination({ halaman, totalHalaman, saatUbah }: { halaman: number; totalHalaman: number; saatUbah: (halaman: number) => void }) { const label = useMemo(() => `Halaman ${halaman} dari ${totalHalaman}`, [halaman, totalHalaman]); return <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between"><span>{label}</span><div className="flex gap-2"><Tombol jenis="sekunder" nonaktif={halaman <= 1} onClick={() => saatUbah(halaman - 1)}>Sebelumnya</Tombol><Tombol jenis="sekunder" nonaktif={halaman >= totalHalaman} onClick={() => saatUbah(halaman + 1)}>Berikutnya</Tombol></div></div> }
export function DataTableFrame({ children }: { children: React.ReactNode }) { return <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">{children}</div> }

