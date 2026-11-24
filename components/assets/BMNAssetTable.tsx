import type { MasterAset } from "@/lib/supabase";

type BMNAssetTableProps = {
  assets: MasterAset[];
  selectedIds: Set<string>;
  onToggle: (assetId: string) => void;
};

export function BMNAssetTable({ assets, selectedIds, onToggle }: BMNAssetTableProps) {
  if (assets.length === 0) {
    return (
      <div className="px-5 py-14 text-center">
        <p className="font-semibold text-slate-800">Tidak ada aset yang cocok</p>
        <p className="mt-1 text-sm text-slate-500">Ubah kata kunci atau filter untuk melihat hasil lain.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
          <tr>
            <th scope="col" className="w-12 px-4 py-3"><span className="sr-only">Pilih aset</span></th>
            <th scope="col" className="px-4 py-3">Nama Barang</th>
            <th scope="col" className="px-4 py-3">Kode Register</th>
            <th scope="col" className="px-4 py-3">Kode Barang</th>
            <th scope="col" className="px-4 py-3">NUP</th>
            <th scope="col" className="px-4 py-3">Jenis BMN</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {assets.map((asset) => {
            const hasRegister = asset.kode_register !== null && asset.kode_register !== "";
            const isSelected = selectedIds.has(asset.id);
            return (
              <tr key={asset.id} className={isSelected ? "bg-amber-50/60" : "hover:bg-slate-50"}>
                <td className="px-4 py-3 align-top">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={!hasRegister}
                    aria-label={`Pilih ${asset.nama_barang || "aset tanpa nama"}`}
                    title={hasRegister ? undefined : "Kode register belum diisi; aset tidak dapat dibuatkan QR."}
                    onChange={() => onToggle(asset.id)}
                    className="mt-0.5 size-4 rounded border-slate-300 accent-[#176e4f] disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </td>
                <td className="max-w-64 px-4 py-3 align-top">
                  <p className="font-semibold text-slate-900">{asset.nama_barang || "Nama barang belum diisi"}</p>
                  {(asset.merk || asset.tipe) && (
                    <p className="mt-0.5 truncate text-xs text-slate-500" title={[asset.merk, asset.tipe].filter(Boolean).join(" ")}>
                      {[asset.merk, asset.tipe].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </td>
                <td className="max-w-48 px-4 py-3 align-top font-mono text-xs text-slate-700">
                  {hasRegister ? <span className="break-all">{asset.kode_register}</span> : <span className="text-rose-600">Belum diisi</span>}
                </td>
                <td className="px-4 py-3 align-top text-slate-600">{asset.kode_barang || "-"}</td>
                <td className="px-4 py-3 align-top text-slate-600">{asset.nup || "-"}</td>
                <td className="px-4 py-3 align-top text-slate-600">{asset.jenis_bmn || "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
