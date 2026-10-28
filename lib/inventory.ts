import { supabase, type MasterAset, type MasterRuangan } from "./supabase";

export type InventoryYear = {
  id: string;
  tahun: number;
  is_locked: boolean;
  created_at: string;
  locked_at: string | null;
};
export type InventoryAsset = {
  id: string;
  inventarisasi_tahun_id: string;
  master_aset_id: string;
  master_ruangan_id: string;
  jumlah_scan: number;
  last_scanned_at: string;
  master_aset?: MasterAset;
  master_ruangan?: MasterRuangan;
};
export type ScanLog = {
  id: string;
  inventarisasi_aset_id: string;
  master_ruangan_id: string;
  image_path: string;
  scanned_at: string;
  created_at: string;
};

export async function getInventoryYears() {
  return supabase
    .from("inventarisasi_tahun")
    .select("*")
    .order("tahun", { ascending: false });
}
export async function getInventoryRooms() {
  return supabase.from("master_ruangan").select("*").order("nama_ruang");
}
export async function getInventoryAssets(yearId: string) {
  return supabase
    .from("inventarisasi_aset")
    .select("*, master_aset(*), master_ruangan(*)")
    .eq("inventarisasi_tahun_id", yearId)
    .order("last_scanned_at", { ascending: false });
}
export async function resolveAsset(code: string) {
  return supabase
    .from("master_aset")
    .select("*")
    .or(`kode_register.eq.${code},kode_barang.eq.${code}`)
    .limit(2);
}
export async function recordScan(
  yearId: string,
  assetId: string,
  roomId: string,
  imagePath: string,
) {
  return supabase.rpc("record_inventarisasi_scan", {
    p_tahun_id: yearId,
    p_aset_id: assetId,
    p_ruangan_id: roomId,
    p_image_path: imagePath,
  });
}
