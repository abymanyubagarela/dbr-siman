"use client";

import { useState } from "react";

export function AppShell({
  children,
  judul = "DBR",
  bagian = "Manajemen ruang",
}: {
  children: React.ReactNode;
  judul?: string;
  bagian?: string;
}) {
  const [sidebarTerbuka, setSidebarTerbuka] = useState(false);
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 bg-[#142B4A] text-white transition-transform lg:translate-x-0 ${sidebarTerbuka ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-16 items-center border-b border-white/10 px-5">
          <span className="mr-3 flex size-8 items-center justify-center rounded-md bg-white font-bold text-[#142B4A]">
            S
          </span>
          <span className="font-bold">{judul}</span>
        </div>
        <nav className="flex flex-col gap-1 p-3" aria-label="Navigasi utama">
          <a
            href="#beranda"
            className="rounded-md bg-white/10 px-3 py-2.5 text-sm font-semibold"
          >
            {bagian}
          </a>
          <a
            href="#pengaturan"
            className="rounded-md px-3 py-2.5 text-sm text-slate-300 hover:bg-white/10"
          >
            Pengaturan
          </a>
        </nav>
      </aside>
      {sidebarTerbuka && (
        <button
          aria-label="Tutup navigasi"
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          onClick={() => setSidebarTerbuka(false)}
        />
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Buka navigasi"
              className="rounded-md border border-slate-200 px-2 py-1.5 text-lg lg:hidden"
              onClick={() => setSidebarTerbuka(true)}
            >
              ☰
            </button>
            <div>
              <p className="text-xs text-slate-500">
                Sistem Informasi Manajemen Aset Negara
              </p>
              <h1 className="font-semibold">{bagian}</h1>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-700">
              Administrator
            </p>
            <p className="text-xs text-slate-500">Akses pengelola</p>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
