type BMNLabelPreviewDialogProps = {
  open: boolean;
  pdfUrl: string;
  downloadName: string;
  onClose: () => void;
  onPrint: () => void;
};

export function BMNLabelPreviewDialog({
  open,
  pdfUrl,
  downloadName,
  onClose,
  onPrint,
}: BMNLabelPreviewDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-2 sm:p-5" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="bmn-label-preview-title"
        className="flex h-[min(94vh,980px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6">
          <div>
            <h2 id="bmn-label-preview-title" className="font-bold text-slate-900">Pratinjau PDF Label BMN</h2>
            <p className="mt-0.5 text-xs text-slate-500">Kertas F4 portrait · gunakan skala 100% saat mencetak</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={pdfUrl}
              download={downloadName}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Unduh PDF
            </a>
            <button
              type="button"
              onClick={onPrint}
              className="rounded-lg bg-[#176e4f] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#11523c]"
            >
              Cetak
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup pratinjau"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Tutup
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 bg-slate-100 p-2 sm:p-4">
          <iframe
            src={pdfUrl}
            title="Pratinjau PDF label BMN"
            className="size-full rounded-lg border border-slate-300 bg-white"
          />
        </div>
        <p className="sr-only">PDF pratinjau berisi label aset dan QR dari kode register masing-masing aset.</p>
      </section>
    </div>
  );
}
