"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { setPageLoading } from "@/components/ui/PageLoader";
import { supabase } from "@/lib/supabase";

type InventoryYear = { id: string; tahun: number; is_locked: boolean };
type MasterAssetRow = {
  id: string;
  kode_barang: string | null;
  nama_barang: string | null;
  nup: string | null;
  kode_register: string | null;
};
type InventoryRow = {
  master_aset_id: string;
  master_ruangan: { nama_ruang: string } | { nama_ruang: string }[] | null;
};
type RecapItem = MasterAssetRow & { scanned: boolean; namaRuang: string };
type RecapGroup = {
  key: string;
  kodeBarang: string;
  namaBarang: string;
  assets: RecapItem[];
  scanned: number;
};

const PAGE_SIZE = 1000;
const GROUPS_PER_PAGE = 10;
const EMPTY_CODE_KEY = "__tanpa_kode_barang__";

async function fetchInventoryYears(): Promise<InventoryYear[]> {
  const { data, error } = await supabase
    .from("inventarisasi_tahun")
    .select("id,tahun,is_locked")
    .order("tahun", { ascending: false });

  if (error) throw new Error("Tahun inventaris tidak dapat dimuat.");
  return (data ?? []) as InventoryYear[];
}

async function fetchAllMasterAssets(): Promise<MasterAssetRow[]> {
  const columns = "id,kode_barang,nama_barang,nup,kode_register";
  const firstPage = await supabase
    .from("master_aset")
    .select(columns, { count: "exact" })
    .order("id", { ascending: true })
    .range(0, PAGE_SIZE - 1);

  if (firstPage.error) throw new Error("Data master aset tidak dapat dimuat.");
  const assets = (firstPage.data ?? []) as MasterAssetRow[];
  const pageCount = Math.ceil((firstPage.count ?? assets.length) / PAGE_SIZE);

  for (let pageOffset = 1; pageOffset < pageCount; pageOffset += 4) {
    const pageNumbers = Array.from(
      { length: Math.min(4, pageCount - pageOffset) },
      (_, index) => pageOffset + index,
    );
    const pages = await Promise.all(pageNumbers.map(async (pageNumber) => {
      const from = pageNumber * PAGE_SIZE;
      const { data, error } = await supabase
        .from("master_aset")
        .select(columns)
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error("Data master aset tidak dapat dimuat.");
      return (data ?? []) as MasterAssetRow[];
    }));
    pages.forEach((page) => assets.push(...page));
  }

  return assets;
}

async function fetchScanRooms(yearId: string | null): Promise<Record<string, string | null>> {
  if (!yearId) return {};

  const columns = "master_aset_id,master_ruangan(nama_ruang)";
  const firstPage = await supabase
    .from("inventarisasi_aset")
    .select(columns, { count: "exact" })
    .eq("inventarisasi_tahun_id", yearId)
    .order("master_aset_id", { ascending: true })
    .range(0, PAGE_SIZE - 1);

  if (firstPage.error) throw new Error("Data hasil scan tidak dapat dimuat.");
  const rows = (firstPage.data ?? []) as unknown as InventoryRow[];
  const pageCount = Math.ceil((firstPage.count ?? rows.length) / PAGE_SIZE);

  for (let pageOffset = 1; pageOffset < pageCount; pageOffset += 4) {
    const pageNumbers = Array.from(
      { length: Math.min(4, pageCount - pageOffset) },
      (_, index) => pageOffset + index,
    );
    const pages = await Promise.all(pageNumbers.map(async (pageNumber) => {
      const from = pageNumber * PAGE_SIZE;
      const { data, error } = await supabase
        .from("inventarisasi_aset")
        .select(columns)
        .eq("inventarisasi_tahun_id", yearId)
        .order("master_aset_id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error("Data hasil scan tidak dapat dimuat.");
      return (data ?? []) as unknown as InventoryRow[];
    }));
    pages.forEach((page) => rows.push(...page));
  }

  return rows.reduce<Record<string, string | null>>((result, row) => {
    const room = Array.isArray(row.master_ruangan)
      ? row.master_ruangan[0]
      : row.master_ruangan;
    result[row.master_aset_id] = room?.nama_ruang?.trim() || null;
    return result;
  }, {});
}

function formatCount(value: number) {
  return value.toLocaleString("id-ID");
}

export default function ScanRecapPage() {
  const [yearId, setYearId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  const {
    data: years,
    error: yearsError,
    isLoading: yearsLoading,
    mutate: reloadYears,
  } = useSWR("scan-recap-years", fetchInventoryYears, {
    revalidateOnFocus: false,
  });
  const {
    data: assets,
    error: assetsError,
    isLoading: assetsLoading,
    mutate: reloadAssets,
  } = useSWR("scan-recap-master-assets", fetchAllMasterAssets, {
    revalidateOnFocus: false,
  });
  const scanKey = years === undefined
    ? null
    : ["scan-recap-scan-rooms", yearId || "no-year"] as const;
  const {
    data: scanRooms,
    error: scanError,
    isLoading: scansLoading,
    mutate: reloadScans,
  } = useSWR(
    scanKey,
    ([, selectedYear]) => fetchScanRooms(selectedYear === "no-year" ? null : selectedYear),
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    if (!years) return;
    const activeYear = years.find((year) => year.id === yearId);
    if (activeYear) return;
    setYearId((years.find((year) => year.is_locked) ?? years[0])?.id ?? "");
  }, [years, yearId]);

  const isLoading = yearsLoading || assetsLoading || (years !== undefined && scansLoading);
  useEffect(() => {
    setPageLoading(isLoading);
    return () => setPageLoading(false);
  }, [isLoading]);

  const groups = useMemo<RecapGroup[]>(() => {
    if (!assets) return [];
    const byCode = new Map<string, RecapItem[]>();

    for (const asset of assets) {
      const normalizedCode = asset.kode_barang?.trim() || "";
      const key = normalizedCode || EMPTY_CODE_KEY;
      const scanned = Object.prototype.hasOwnProperty.call(scanRooms ?? {}, asset.id);
      const scannedRoom = scanned ? scanRooms?.[asset.id] : null;
      const item: RecapItem = {
        ...asset,
        scanned,
        namaRuang: scanned
          ? scannedRoom || "Ruangan tidak tercatat"
          : "Belum tercatat",
      };
      const group = byCode.get(key) ?? [];
      group.push(item);
      byCode.set(key, group);
    }

    return Array.from(byCode, ([key, groupedAssets]) => ({
      key,
      kodeBarang: key === EMPTY_CODE_KEY ? "Belum ada kode" : key,
      namaBarang: groupedAssets.find((asset) => asset.nama_barang?.trim())?.nama_barang?.trim() || "Belum ada nama",
      assets: groupedAssets.sort((a, b) => (a.nup ?? "").localeCompare(b.nup ?? "", "id", { numeric: true })),
      scanned: groupedAssets.filter((asset) => asset.scanned).length,
    })).sort((a, b) => a.kodeBarang.localeCompare(b.kodeBarang, "id", { numeric: true, sensitivity: "base" }));
  }, [assets, scanRooms]);

  const filteredGroups = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("id-ID");
    if (!needle) return groups;
    return groups.filter((group) =>
      `${group.kodeBarang} ${group.namaBarang}`.toLocaleLowerCase("id-ID").includes(needle),
    );
  }, [groups, search]);
  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / GROUPS_PER_PAGE));
  const visibleGroups = filteredGroups.slice((page - 1) * GROUPS_PER_PAGE, page * GROUPS_PER_PAGE);
  const totalAssets = groups.reduce((sum, group) => sum + group.assets.length, 0);
  const scannedAssets = groups.reduce((sum, group) => sum + group.scanned, 0);
  const error = yearsError || assetsError || scanError;

  const retry = () => {
    void reloadYears();
    void reloadAssets();
    void reloadScans();
  };

  return (
    <section className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-8">
      <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#197a58]">Inventarisasi</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[#111111]">Rekap Scan</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Pantau jumlah aset yang sudah discan dan lihat status setiap barang berdasarkan kode barang.
          </p>
        </div>
        <label className="w-full text-sm font-semibold text-slate-700 sm:w-60">
          Tahun inventaris
          <select
            value={yearId}
            onChange={(event) => {
              setYearId(event.target.value);
              setExpandedCode(null);
              setPage(1);
            }}
            disabled={yearsLoading || !years?.length}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal disabled:cursor-not-allowed disabled:bg-slate-50"
          >
            {years?.length ? years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.tahun}{year.is_locked ? " · Terkunci" : " · Terbuka"}
              </option>
            )) : <option value="">Belum ada tahun inventarisasi</option>}
          </select>
        </label>
      </header>

      {error && (
        <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>Data rekap tidak dapat dimuat. Periksa koneksi dan izin akses.</span>
          <button type="button" onClick={retry} className="rounded-lg border border-red-200 bg-white px-3 py-2 font-semibold text-red-700 hover:bg-red-100">
            Coba lagi
          </button>
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Total barang" value={isLoading ? "—" : formatCount(totalAssets)} detail="Dari master aset" />
        <SummaryCard label="Sudah discan" value={isLoading ? "—" : formatCount(scannedAssets)} detail={yearId ? "Pada tahun terpilih" : "Belum ada tahun scan"} tone="green" />
        <SummaryCard label="Belum discan" value={isLoading ? "—" : formatCount(Math.max(0, totalAssets - scannedAssets))} detail="Perlu ditindaklanjuti" tone="amber" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Rekap per kode barang</h2>
            <p className="mt-1 text-xs text-slate-500">{formatCount(filteredGroups.length)} kelompok kode barang</p>
          </div>
          <label className="w-full sm:max-w-xs">
            <span className="sr-only">Cari kode atau nama barang</span>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
                setExpandedCode(null);
              }}
              placeholder="Cari kode atau nama barang..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-[#197a58] focus:ring-2 focus:ring-emerald-100"
            />
          </label>
        </div>

        {isLoading ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500" role="status">Memuat rekap scan...</div>
        ) : !visibleGroups.length ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">
            {search ? "Tidak ada kode atau nama barang yang cocok." : "Belum ada data aset."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <caption className="sr-only">Rekap hasil scan barang berdasarkan kode barang</caption>
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th scope="col" className="w-16 px-5 py-4">No</th>
                    <th scope="col" className="px-5 py-4">Kode Barang</th>
                    <th scope="col" className="px-5 py-4">Nama Barang</th>
                    <th scope="col" className="px-5 py-4">Scanned (x/total)</th>
                    <th scope="col" className="px-5 py-4 text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleGroups.map((group, index) => {
                    const isExpanded = expandedCode === group.key;
                    const detailId = `recap-detail-${(page - 1) * GROUPS_PER_PAGE + index}`;
                    return (
                      <FragmentRows
                        key={group.key}
                        group={group}
                        rowNumber={(page - 1) * GROUPS_PER_PAGE + index + 1}
                        isExpanded={isExpanded}
                        detailId={detailId}
                        onToggle={() => setExpandedCode(isExpanded ? null : group.key)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <span>Halaman {page} dari {totalPages}</span>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50">Sebelumnya</button>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50">Berikutnya</button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  tone = "slate",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "slate" | "green" | "amber";
}) {
  const valueColor = tone === "green"
    ? "text-[#176e4f]"
    : tone === "amber"
      ? "text-amber-700"
      : "text-slate-900";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-black tracking-tight ${valueColor}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </div>
  );
}

function FragmentRows({
  group,
  rowNumber,
  isExpanded,
  detailId,
  onToggle,
}: {
  group: RecapGroup;
  rowNumber: number;
  isExpanded: boolean;
  detailId: string;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="align-middle hover:bg-emerald-50/40">
        <td className="px-5 py-4 text-slate-500">{rowNumber}</td>
        <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-700">{group.kodeBarang}</td>
        <td className="px-5 py-4 font-semibold text-slate-800">{group.namaBarang}</td>
        <td className="px-5 py-4">
          <span className="font-bold text-slate-900">{formatCount(group.scanned)}</span>
          <span className="text-slate-500"> / {formatCount(group.assets.length)}</span>
        </td>
        <td className="px-5 py-4 text-right">
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={detailId}
            onClick={onToggle}
            className="rounded-lg px-3 py-2 text-xs font-bold text-[#176e4f] transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            {isExpanded ? "Tutup detail" : "Lihat detail"}
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr id={detailId}>
          <td colSpan={5} className="bg-slate-50/70 px-3 py-4 sm:px-5">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-bold text-slate-800">Daftar barang · {group.kodeBarang}</h3>
                <p className="mt-1 text-xs text-slate-500">Lokasi barang yang belum discan belum tercatat di master aset.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <caption className="sr-only">Detail scan untuk kode barang {group.kodeBarang}</caption>
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">Nama Barang</th>
                      <th scope="col" className="px-4 py-3">Identitas</th>
                      <th scope="col" className="px-4 py-3">Status</th>
                      <th scope="col" className="px-4 py-3">Nama Ruangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.assets.map((asset) => (
                      <tr key={asset.id}>
                        <td className="px-4 py-3 font-medium text-slate-800">{asset.nama_barang?.trim() || "Belum ada nama"}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">NUP {asset.nup?.trim() || "—"}<br />{asset.kode_register?.trim() || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${asset.scanned ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                            {asset.scanned ? "Scanned" : "Not scanned"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{asset.namaRuang}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
