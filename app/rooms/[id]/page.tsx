import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export default async function RoomDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  );
  const { data: room } = await client
    .from("master_ruangan")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!room) notFound();
  return (
    <main className="min-h-screen bg-[#f6f8fb] p-6 text-slate-900">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
          SIMAN
        </p>
        <h1 className="mt-3 text-3xl font-bold">{room.name}</h1>
        <p className="mt-2 text-slate-500">{room.location}</p>
        <div className="mt-8 rounded-xl bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">
            ID Ruangan
          </p>
          <code className="mt-2 block break-all text-sm">{room.id}</code>
        </div>
        <a
          href="/"
          className="mt-6 inline-block text-sm font-semibold text-blue-600 hover:underline"
        >
          ← Kembali ke daftar ruangan
        </a>
      </div>
    </main>
  );
}
