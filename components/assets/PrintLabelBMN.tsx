"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { BMNAssetTable } from "@/components/assets/BMNAssetTable";
import { BMNLabelPreviewDialog } from "@/components/assets/BMNLabelPreviewDialog";
import { ErrorState, LoadingSpinner, useToast } from "@/components/ui/feedback";
import { TablePagination } from "@/components/ui/data-table";
import {
  createBMNLabelPdf,
  getLabelDimensions,
  MAX_LABELS_PER_PDF,
  type BMNLabelSettings,
  type PdfGenerationProgress,
} from "@/lib/bmn-label-pdf";
import { supabase, type MasterAset } from "@/lib/supabase";

const ASSET_SELECT =
  "id,jenis_bmn,kode_barang,nup,nama_barang,merk,tipe,kondisi,status,kode_register,created_at,updated_at";
const FETCH_BATCH_SIZE = 500;
const LABEL_COLOR_CATEGORIES = [
  { color: "#2563EB", name: "Teknologi Informasi dan Komunikasi" },
  { color: "#F97316", name: "Furnitur dan Perlengkapan Kantor" },
  { color: "#16A34A", name: "Peralatan Rumah Tangga" },
  { color: "#DC2626", name: "Keamanan dan Keselamatan" },
  { color: "#9333EA", name: "Mesin dan Utilitas" },
  { color: "#EAB308", name: "Alat Ukur, Kesehatan dan Olahraga" },
  { color: "#0891B2", name: "Perlengkapan Institusi dan Multimedia" },
  { color: "#475569", name: "Bangunan dan Infrastruktur" },
  { color: "#598FBF", name: "Monografi" },
] as const;
const DEFAULT_SETTINGS: BMNLabelSettings = {
  columns: 2,
  rows: 10,
  marginMm: 10,
  gapMm: 3,
  copies: 1,
  headerColor: "#F97316",
};

async function loadMasterAset(): Promise<MasterAset[]> {
  const firstPage = await supabase
    .from("master_aset")
    .select(ASSET_SELECT, { count: "exact" })
    .order("id", { ascending: true })
    .range(0, FETCH_BATCH_SIZE - 1);

  if (firstPage.error) throw firstPage.error;
  const firstRows = (firstPage.data ?? []) as MasterAset[];
  const totalRows = firstPage.count ?? firstRows.length;
  const pageCount = Math.ceil(totalRows / FETCH_BATCH_SIZE);
  if (pageCount <= 1) return firstRows;

  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) => {
      const start = (index + 1) * FETCH_BATCH_SIZE;
      return supabase
        .from("master_aset")
        .select(ASSET_SELECT)
        .order("id", { ascending: true })
        .range(start, start + FETCH_BATCH_SIZE - 1);
    }),
  );

  const rows = [...firstRows];
  for (const page of remainingPages) {
    if (page.error) throw page.error;
    rows.push(...((page.data ?? []) as MasterAset[]));
  }
  return rows;
}

function uniqueValues(assets: MasterAset[], field: "jenis_bmn" | "kondisi" | "status") {
  return Array.from(
    new Set(assets.map((asset) => asset[field]).filter((value): value is string => Boolean(value))),
  ).sort((first, second) => first.localeCompare(second, "id"));
}

function formatCount(value: number): string {
  return value.toLocaleString("id-ID");
}

function describeProgress(progress: PdfGenerationProgress): string {
  if (progress.phase === "qr") {
    return `Membuat QR kode ${formatCount(progress.current)} dari ${formatCount(progress.total)}...`;
  }
  return `Menyusun PDF ${formatCount(progress.current)} dari ${formatCount(progress.total)} label...`;
}

export default function PrintLabelBMN() {
  const { data: assets, error, isLoading, mutate } = useSWR<MasterAset[]>(
    "master-aset-cetak-label-bmn",
    loadMasterAset,
    { revalidateOnFocus: false },
  );
  const { tampilkanToast } = useToast();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [settings, setSettings] = useState<BMNLabelSettings>(DEFAULT_SETTINGS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!pdfUrl) return;
    return () => URL.revokeObjectURL(pdfUrl);
  }, [pdfUrl]);

  const allAssets = assets ?? [];
  const kinds = useMemo(() => uniqueValues(allAssets, "jenis_bmn"), [allAssets]);
  const conditions = useMemo(() => uniqueValues(allAssets, "kondisi"), [allAssets]);
  const statuses = useMemo(() => uniqueValues(allAssets, "status"), [allAssets]);

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    return allAssets.filter((asset) => {
      const searchable = [
        asset.nama_barang,
        asset.kode_barang,
        asset.nup,
        asset.kode_register,
        asset.merk,
        asset.tipe,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("id-ID");
      return (
        (!query || searchable.includes(query)) &&
        (kindFilter === "all" || asset.jenis_bmn === kindFilter) &&
        (conditionFilter === "all" || asset.kondisi === conditionFilter) &&
        (statusFilter === "all" || asset.status === statusFilter)
      );
    });
  }, [allAssets, search, kindFilter, conditionFilter, statusFilter]);

  const printableFilteredAssets = useMemo(
    () => filteredAssets.filter((asset) => asset.kode_register !== null && asset.kode_register !== ""),
    [filteredAssets],
  );
  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleAssets = filteredAssets.slice((safePage - 1) * pageSize, safePage * pageSize);
  const visiblePrintableAssets = visibleAssets.filter(
    (asset) => asset.kode_register !== null && asset.kode_register !== "",
  );
  const selectedAssets = useMemo(
    () => allAssets.filter((asset) => selectedIds.has(asset.id) && asset.kode_register !== null && asset.kode_register !== ""),
    [allAssets, selectedIds],
  );
  const allResultsSelected =
    printableFilteredAssets.length > 0 &&
    printableFilteredAssets.every((asset) => selectedIds.has(asset.id));
  const allVisibleSelected =
    visiblePrintableAssets.length > 0 && visiblePrintableAssets.every((asset) => selectedIds.has(asset.id));
  const selectedLabelCount = selectedAssets.length * settings.copies;
  const labelDimensions = getLabelDimensions(settings);
  const missingRegisterCount = filteredAssets.length - printableFilteredAssets.length;

  const duplicateRegisterIds = useMemo(() => {
    const registerCounts = new Map<string, number>();
    allAssets.forEach((asset) => {
      if (asset.kode_register === null || asset.kode_register === "") return;
      registerCounts.set(asset.kode_register, (registerCounts.get(asset.kode_register) ?? 0) + 1);
    });
    return new Set(
      selectedAssets
        .filter((asset) => (registerCounts.get(asset.kode_register ?? "") ?? 0) > 1)
        .map((asset) => asset.id),
    );
  }, [allAssets, selectedAssets]);

  const layoutError =
    settings.columns < 1 || settings.rows < 1
      ? "Kolom dan baris harus minimal 1."
      : settings.marginMm < 0 || settings.gapMm < 0
        ? "Margin dan jarak tidak boleh negatif."
        : labelDimensions.width < 42 || labelDimensions.height < 22
          ? "Label terlalu kecil untuk teks yang terbaca dan QR yang mudah dipindai. Kurangi kolom/baris atau margin/jarak."
          : "";
  const outputLimitError = selectedLabelCount > MAX_LABELS_PER_PDF;
  const downloadName = `label-bmn-${new Date().toISOString().slice(0, 10)}.pdf`;

  const updateSettings = <K extends keyof BMNLabelSettings>(key: K, value: BMNLabelSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const toggleAsset = (assetId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };

  const toggleResults = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      printableFilteredAssets.forEach((asset) => {
        if (allResultsSelected) next.delete(asset.id);
        else next.add(asset.id);
      });
      return next;
    });
  };

  const toggleVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      visiblePrintableAssets.forEach((asset) => {
        if (allVisibleSelected) next.delete(asset.id);
        else next.add(asset.id);
      });
      return next;
    });
  };

  const handlePreview = async () => {
    if (!selectedAssets.length || layoutError || outputLimitError) return;
    setIsGenerating(true);
    setGenerationStatus("Menyiapkan logo dan QR...");
    try {
      const blob = await createBMNLabelPdf(selectedAssets, settings, (progress) => {
        setGenerationStatus(describeProgress(progress));
      });
      const nextUrl = URL.createObjectURL(blob);
      setPdfUrl(nextUrl);
      setPreviewOpen(true);
    } catch (generationError) {
      tampilkanToast(
        "galat",
        generationError instanceof Error ? generationError.message : "PDF label gagal dibuat.",
      );
    } finally {
      setIsGenerating(false);
      setGenerationStatus("");
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("about:blank", "_blank");
    if (!printWindow) {
      tampilkanToast("peringatan", "Izinkan pop-up untuk membuka PDF dan mencetaknya.");
      return;
    }
    printWindow.addEventListener(
      "load",
      () => {
        printWindow.focus();
        printWindow.print();
      },
      { once: true },
    );
    printWindow.location.href = pdfUrl;
  };

  if (isLoading) return <LoadingSpinner label="Memuat master aset BMN..." />;
  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-8">
        <ErrorState
          pesan={`Data master_aset belum dapat dimuat: ${error.message}`}
          cobaLagi={() => void mutate()}
        />
      </div>
    );
  }

  return (
    <section className="min-h-full bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto max-w-[1380px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Inventaris Barang Milik Negara</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Cetak Label BMN</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Pilih aset dari master, atur tata letak label F4, lalu tinjau PDF yang sama untuk diunduh atau dicetak.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-2">Kertas F4 portrait</span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-2">Logo BPK RI</span>
          </div>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Master aset" value={formatCount(allAssets.length)} detail="Data aktual dari master_aset" />
          <SummaryCard label="Hasil pencarian" value={formatCount(filteredAssets.length)} detail="Sesuai kata kunci dan filter" />
          <SummaryCard label="Label dipilih" value={formatCount(selectedLabelCount)} detail={`${formatCount(selectedAssets.length)} aset · ${settings.copies} salinan`} />
        </div>

        <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Pilih aset untuk label">
            <div className="border-b border-slate-200 p-4 sm:p-5">
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                <div>
                  <h2 className="font-bold text-slate-900">Daftar aset</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatCount(printableFilteredAssets.length)} aset dapat dicetak
                    {missingRegisterCount > 0 && ` · ${formatCount(missingRegisterCount)} tanpa kode register`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={toggleResults}
                    disabled={!printableFilteredAssets.length}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-[#176e4f] transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {allResultsSelected ? "Batalkan pilihan hasil" : `Pilih semua ${formatCount(printableFilteredAssets.length)} hasil`}
                  </button>
                  <button
                    type="button"
                    onClick={toggleVisible}
                    disabled={!visiblePrintableAssets.length}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {allVisibleSelected ? "Batalkan pilihan halaman" : "Pilih halaman"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    disabled={!selectedIds.size}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Hapus pilihan
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <label className="sm:col-span-2 xl:col-span-1">
                  <span className="sr-only">Cari aset</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Cari nama, kode, NUP, register..."
                    aria-label="Cari aset berdasarkan nama, kode barang, NUP, merk, tipe, atau kode register"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <FilterSelect label="Jenis BMN" value={kindFilter} values={kinds} onChange={(value) => { setKindFilter(value); setPage(1); }} />
                <FilterSelect label="Kondisi" value={conditionFilter} values={conditions} onChange={(value) => { setConditionFilter(value); setPage(1); }} />
                <FilterSelect label="Status" value={statusFilter} values={statuses} onChange={(value) => { setStatusFilter(value); setPage(1); }} />
              </div>
            </div>

            <BMNAssetTable assets={visibleAssets} selectedIds={selectedIds} onToggle={toggleAsset} />
            {filteredAssets.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2 text-xs text-slate-500">
                  Baris per halaman
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setPage(1);
                    }}
                    aria-label="Baris per halaman"
                    className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
                  >
                    {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </label>
                <TablePagination halaman={safePage} totalHalaman={totalPages} saatUbah={setPage} />
              </div>
            )}
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Pengaturan label BMN">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Pengaturan cetak</p>
                <h2 className="mt-1 text-lg font-bold">Atur lembar label</h2>
              </div>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">F4 · 210 × 330 mm</span>
            </div>

            <fieldset className="mt-5">
              <legend className="text-sm font-semibold text-slate-700">Kategori warna header</legend>
              <div className="mt-2 grid gap-2">
                {LABEL_COLOR_CATEGORIES.map((category) => {
                  const isSelected = settings.headerColor.toUpperCase() === category.color;
                  return (
                    <button
                      key={category.color}
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={`${category.name}, ${category.color}${isSelected ? ", dipilih" : ""}`}
                      onClick={() => updateSettings("headerColor", category.color)}
                      className={`flex min-h-10 items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${
                        isSelected
                          ? "border-slate-900 bg-slate-50 font-semibold text-slate-900"
                          : "border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="relative size-5 shrink-0 rounded-sm border border-black/15"
                        style={{ backgroundColor: category.color }}
                      >
                        {isSelected && (
                          <svg
                            viewBox="0 0 16 16"
                            className="absolute inset-0 size-full p-0.5 text-white drop-shadow"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path d="m3 8 3.2 3.2L13 4.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">{category.name}</span>
                      <span className="font-mono text-[10px] uppercase text-slate-500">{category.color}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-500">Warna terpilih berlaku untuk semua label yang dibuat.</p>
            </fieldset>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <NumberField label="Kolom" value={settings.columns} min={1} max={10} onChange={(value) => updateSettings("columns", value)} />
              <NumberField label="Baris" value={settings.rows} min={1} max={30} onChange={(value) => updateSettings("rows", value)} />
              <NumberField label="Margin (mm)" value={settings.marginMm} min={0} max={50} onChange={(value) => updateSettings("marginMm", value)} />
              <NumberField label="Jarak (mm)" value={settings.gapMm} min={0} max={20} onChange={(value) => updateSettings("gapMm", value)} />
              <NumberField label="Salinan per aset" value={settings.copies} min={1} max={99} onChange={(value) => updateSettings("copies", value)} />
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <div className="flex items-center justify-between gap-3">
                <span>Ukuran tiap label</span>
                <strong className="text-slate-900">{labelDimensions.width.toFixed(1)} × {labelDimensions.height.toFixed(1)} mm</strong>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span>Label dalam satu lembar</span>
                <strong className="text-slate-900">{formatCount(settings.columns * settings.rows)}</strong>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span>Total label pada PDF</span>
                <strong className="text-slate-900">{formatCount(selectedLabelCount)}</strong>
              </div>
            </div>

            {layoutError && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800" role="alert">{layoutError}</p>}
            {outputLimitError && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800" role="alert">Jumlah label melebihi batas {formatCount(MAX_LABELS_PER_PDF)} dalam satu PDF. Kurangi pilihan atau salinan.</p>}
            {duplicateRegisterIds.size > 0 && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800" role="status">
                {formatCount(duplicateRegisterIds.size)} aset terpilih memiliki kode register yang sama dengan aset lain di master. QR tetap memakai string persis; pastikan data duplikat memang benar.
              </p>
            )}
            {generationStatus && <p className="mt-3 text-xs text-slate-500" role="status" aria-live="polite">{generationStatus}</p>}

            <button
              type="button"
              onClick={() => void handlePreview()}
              disabled={!selectedAssets.length || Boolean(layoutError) || outputLimitError || isGenerating}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#176e4f] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#11523c] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isGenerating ? "Membuat PDF..." : "Pratinjau PDF"}
            </button>
            <p className="mt-2 text-center text-[11px] leading-5 text-slate-400">
              QR dibuat lokal dari kode register; cetak pada skala 100%.
            </p>
          </aside>
        </div>
      </div>

      <BMNLabelPreviewDialog
        open={previewOpen}
        pdfUrl={pdfUrl}
        downloadName={downloadName}
        onClose={() => setPreviewOpen(false)}
        onPrint={handlePrint}
      />
    </section>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-[11px] text-slate-400">{detail}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="sr-only">Filter {label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={`Filter ${label}`}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      >
        <option value="all">Semua {label}</option>
        {values.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const id = `bmn-label-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <label htmlFor={id} className="block text-xs font-semibold text-slate-600">
      {label}
      <input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        step={1}
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          if (Number.isFinite(nextValue)) onChange(Math.min(max, Math.max(min, Math.floor(nextValue))));
        }}
        className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}
