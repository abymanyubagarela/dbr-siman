"use client";

import { useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/aset", label: "Aset", icon: "▤" },
  { href: "/inventarisasi", label: "Inventarisasi", icon: "◫" },
  { href: "/#ruangan", label: "Ruangan", icon: "⌂" },
];

export function AppShell({
  children,
  judul = "DBR",
  bagian = "Dashboard",
}: {
  children: React.ReactNode;
  judul?: string;
  bagian?: string;
}) {
  const [sidebarTerbuka, setSidebarTerbuka] = useState(false);
  return (
    <div className="min-h-screen bg-[#eef0f2] p-0 text-[#111111] sm:p-4 lg:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1540px] overflow-hidden rounded-none bg-[#f8f9f8] shadow-[0_20px_70px_rgba(22,32,28,0.12)] sm:rounded-[28px] lg:min-h-[calc(100vh-4rem)]">
        <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-[#f8f9f8] px-5 py-7 transition-transform sm:absolute lg:relative lg:translate-x-0 ${sidebarTerbuka ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center px-2">
            <img src="/images/openlogistics-logo.jpg" alt="OpenLogistics" className="h-14 w-full max-w-[180px] object-contain object-left mix-blend-multiply" />
          </div>
          <p className="mt-12 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Menu</p>
          <nav className="mt-3 flex flex-col gap-1" aria-label="Navigasi utama">
            {navItems.map((item, index) => <a key={item.href} href={item.href} onClick={() => setSidebarTerbuka(false)} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${index === 0 && bagian === "Dashboard" ? "bg-[#dff2e9] font-bold text-[#176e4f]" : "text-slate-500 hover:bg-white hover:text-[#176e4f]"}`}><span className="w-5 text-center text-lg text-current">{item.icon}</span>{item.label}{item.label === "Aset" && <span className="ml-auto rounded-md bg-[#176e4f] px-1.5 py-0.5 text-[10px] text-white">Data</span>}</a>)}
          </nav>
          <p className="mt-10 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">General</p>
          <nav className="mt-3 flex flex-col gap-1"><a href="#pengaturan" className="rounded-xl px-3 py-3 text-sm font-medium text-slate-500 hover:bg-white hover:text-[#176e4f]">⚙ <span className="ml-3">Pengaturan</span></a><a href="#bantuan" className="rounded-xl px-3 py-3 text-sm font-medium text-slate-500 hover:bg-white hover:text-[#176e4f]">? <span className="ml-4">Bantuan</span></a></nav>
          <div className="mt-auto rounded-2xl bg-[#103d2d] p-4 text-white"><p className="text-sm font-bold">Kelola lebih cepat</p><p className="mt-1 text-xs leading-5 text-emerald-100">Semua data aset dalam satu tempat.</p><a href="/aset" className="mt-4 block rounded-full bg-[#2d9a6b] px-3 py-2 text-center text-xs font-bold">Buka data aset</a></div>
        </aside>
        {sidebarTerbuka && <button aria-label="Tutup navigasi" className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setSidebarTerbuka(false)} />}
        <div className="min-w-0 flex-1">
          <header className="flex h-[76px] items-center justify-between border-b border-slate-200 bg-[#f8f9f8] px-5 sm:px-8"><div className="flex items-center gap-3"><button type="button" aria-label="Buka navigasi" className="rounded-lg border border-slate-200 px-2 py-1.5 text-lg lg:hidden" onClick={() => setSidebarTerbuka(true)}>☰</button><div className="hidden items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-400 sm:flex"><span className="text-lg text-slate-700">⌕</span><span>Search task</span><kbd className="ml-10 rounded-md bg-slate-100 px-2 py-1 text-[10px]">⌘ F</kbd></div><span className="text-sm font-semibold text-slate-500 sm:hidden">{bagian}</span></div><div className="flex items-center gap-3"><button aria-label="Pesan" className="hidden size-10 rounded-full border border-slate-200 bg-white text-lg sm:block">✉</button><button aria-label="Notifikasi" className="size-10 rounded-full border border-slate-200 bg-white text-lg">♧</button><div className="flex items-center gap-2 border-l border-slate-200 pl-3"><div className="flex size-10 items-center justify-center rounded-full bg-[#f0c5b9] text-xl">A</div><div className="hidden sm:block"><p className="text-sm font-bold">Administrator</p><p className="text-xs text-slate-400">admin@dbr.go.id</p></div></div></div></header>
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
