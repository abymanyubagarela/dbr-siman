"use client";

import { useState } from "react";
import { PageLoader, setPageLoading } from "@/components/ui/PageLoader";

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
    <div className="h-screen overflow-hidden bg-[#eef0f2] p-0 text-[#111111] sm:p-4 lg:p-8">
      <div className="mx-auto flex h-full min-h-0 max-w-[1540px] overflow-hidden rounded-none bg-[#f8f9f8] shadow-[0_20px_70px_rgba(22,32,28,0.12)] sm:rounded-[28px]">
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-[#f8f9f8] px-5 py-7 transition-transform sm:absolute lg:relative lg:translate-x-0 ${sidebarTerbuka ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex items-center gap-3 px-2">
            <div className="flex size-10 items-center justify-center rounded-full border-[3px] border-[#197a58]">
              <img
                src="/logo.png"
                alt="Logo"
                className="size-7 object-contain"
              />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">{judul}</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Asset Management
              </p>
            </div>
          </div>
          <p className="mt-12 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Menu
          </p>
          <nav className="mt-3 flex flex-col gap-1" aria-label="Navigasi utama">
            {navItems.map((item, index) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => { setSidebarTerbuka(false); setPageLoading(true); }}
                className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${index === 0 && bagian === "Dashboard" ? "bg-[#dff2e9] font-bold text-[#176e4f]" : "text-slate-500 hover:bg-white hover:text-[#176e4f]"}`}
              >
                <span className="w-5 text-center text-lg text-current">
                  {item.icon}
                </span>
                {item.label}
                {item.label === "Aset" && (
                  <span className="ml-auto rounded-md bg-[#176e4f] px-1.5 py-0.5 text-[10px] text-white">
                    Data
                  </span>
                )}
              </a>
            ))}
          </nav>
          <p className="mt-10 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            General
          </p>
          <nav className="mt-3 flex flex-col gap-1">
            <a
              href="#pengaturan"
              className="rounded-xl px-3 py-3 text-sm font-medium text-slate-500 hover:bg-white hover:text-[#176e4f]"
            >
              ⚙ <span className="ml-3">Pengaturan</span>
            </a>
            <a
              href="#bantuan"
              className="rounded-xl px-3 py-3 text-sm font-medium text-slate-500 hover:bg-white hover:text-[#176e4f]"
            >
              ? <span className="ml-4">Bantuan</span>
            </a>
          </nav>
          <div className="mt-auto rounded-2xl bg-[#103d2d] p-4 text-white">
            <p className="text-sm font-bold">Kelola Lebih Cepat</p>
            <p className="mt-1 text-xs leading-5 text-emerald-100">
              Semua Data Aset Dalam Satu Tempat.
            </p>
            <a
              href="/aset"
              className="mt-4 block rounded-full bg-[#2d9a6b] px-3 py-2 text-center text-xs font-bold"
            >
              Buka Data Aset
            </a>
          </div>
        </aside>
        {sidebarTerbuka && (
          <button
            aria-label="Tutup navigasi"
            className="fixed inset-0 z-30 bg-black/20 lg:hidden"
            onClick={() => setSidebarTerbuka(false)}
          />
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-slate-200 bg-[#f8f9f8] px-5 sm:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Buka navigasi"
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-lg lg:hidden"
                onClick={() => setSidebarTerbuka(true)}
              >
                ☰
              </button>
              
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-[#f0c5b9] text-xl">
                  A
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-bold">Administrator</p>
                  <p className="text-xs text-slate-400">admin@dbr.go.id</p>
                </div>
              </div>
            </div>
          </header>
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">{children}</main>
          <PageLoader />
        </div>
      </div>
    </div>
  );
}
