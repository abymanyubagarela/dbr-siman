"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type NadaToast = "sukses" | "galat" | "peringatan" | "info";
type Toast = { id: number; nada: NadaToast; pesan: string };
type ToastContextValue = {
  tampilkanToast: (nada: NadaToast, pesan: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const tampilkanToast = useCallback((nada: NadaToast, pesan: string) => {
    const id = Date.now() + Math.random();
    setToasts((saatIni) => [...saatIni, { id, nada, pesan }]);
    window.setTimeout(
      () => setToasts((saatIni) => saatIni.filter((toast) => toast.id !== id)),
      4500,
    );
  }, []);
  const value = useMemo(() => ({ tampilkanToast }), [tampilkanToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-96"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto w-full rounded-lg border bg-white px-4 py-3 text-sm shadow-lg ${warnaToast[toast.nada]}`}
          >
            <p className="font-semibold">{judulToast[toast.nada]}</p>
            <p className="mt-1 text-slate-600">{toast.pesan}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const judulToast: Record<NadaToast, string> = {
  sukses: "Berhasil",
  galat: "Terjadi kesalahan",
  peringatan: "Perhatian",
  info: "Informasi",
};
const warnaToast: Record<NadaToast, string> = {
  sukses: "border-emerald-200",
  galat: "border-rose-200",
  peringatan: "border-amber-200",
  info: "border-emerald-200",
};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context)
    throw new Error("useToast harus digunakan di dalam ToastProvider");
  return context;
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-label="Memuat"
      role="status"
      className={`inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  );
}
export function LoadingSpinner({
  label = "Memuat Data...",
}: {
  label?: string;
}) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
      <Spinner />
      {label}
    </div>
  );
}
export function TableSkeleton({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div
      className="flex flex-col gap-3 p-5"
      aria-label="Memuat tabel"
      role="status"
    >
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex gap-4">
          {Array.from({ length: columns }, (_, column) => (
            <div
              key={column}
              className="h-10 flex-1 animate-pulse rounded-md bg-slate-200"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
export function CardSkeleton() {
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5"
      aria-label="Memuat kartu"
      role="status"
    >
      <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
      <div className="h-8 w-1/2 animate-pulse rounded bg-slate-200" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
    </div>
  );
}

export function EmptyState({
  judul = "Belum ada data",
  pesan = "Belum ada data yang dapat ditampilkan.",
  aksi,
}: {
  judul?: string;
  pesan?: string;
  aksi?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <p className="font-semibold text-slate-900">{judul}</p>
      <p className="max-w-md text-sm text-slate-500">{pesan}</p>
      {aksi && <div className="mt-3">{aksi}</div>}
    </div>
  );
}
export function ErrorState({
  pesan = "Data belum dapat dimuat.",
  cobaLagi,
}: {
  pesan?: string;
  cobaLagi?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 px-6 py-14 text-center"
    >
      <p className="font-semibold text-rose-700">Data tidak tersedia</p>
      <p className="text-sm text-slate-600">{pesan}</p>
      {cobaLagi && (
        <button
          type="button"
          onClick={cobaLagi}
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Coba lagi
        </button>
      )}
    </div>
  );
}

export function KonfirmasiDialog({
  terbuka,
  judul = "Konfirmasi tindakan",
  pesan,
  labelKonfirmasi = "Lanjutkan",
  saatKonfirmasi,
  saatBatal,
}: {
  terbuka: boolean;
  judul?: string;
  pesan: string;
  labelKonfirmasi?: string;
  saatKonfirmasi: () => void;
  saatBatal: () => void;
}) {
  if (!terbuka) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="judul-konfirmasi"
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl"
      >
        <h2 id="judul-konfirmasi" className="text-lg font-bold text-slate-950">
          {judul}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{pesan}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={saatBatal}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={saatKonfirmasi}
            className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
          >
            {labelKonfirmasi}
          </button>
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({
  children,
  warna = "netral",
}: {
  children: React.ReactNode;
  warna?: "aktif" | "peringatan" | "galat" | "netral";
}) {
  const kelas = {
    aktif: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    peringatan: "bg-amber-50 text-amber-700 ring-amber-200",
    galat: "bg-rose-50 text-rose-700 ring-rose-200",
    netral: "bg-slate-100 text-slate-700 ring-slate-200",
  }[warna];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${kelas}`}
    >
      {children}
    </span>
  );
}

export function Tombol({
  children,
  memuat = false,
  nonaktif = false,
  jenis = "utama",
  type = "button",
  onClick,
}: {
  children: React.ReactNode;
  memuat?: boolean;
  nonaktif?: boolean;
  jenis?: "utama" | "sekunder" | "bahaya";
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
}) {
  const kelas = {
    utama: "bg-emerald-600 text-white hover:bg-emerald-700",
    sekunder:
      "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
    bahaya: "bg-rose-600 text-white hover:bg-rose-700",
  }[jenis];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={nonaktif || memuat}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${kelas}`}
    >
      {memuat && <Spinner />}
      {children}
    </button>
  );
}

export function FormError({ children }: { children?: React.ReactNode }) {
  return children ? (
    <p role="alert" className="text-sm text-rose-600">
      {children}
    </p>
  ) : null;
}

export type { NadaToast };
export { ToastContext };
