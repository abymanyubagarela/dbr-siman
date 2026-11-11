"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";

interface CameraBarcodeScannerProps {
  onDetected: (value: string) => void;
  disabled?: boolean;
}

export function CameraBarcodeScanner({ onDetected, disabled = false }: CameraBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const sessionRef = useRef(0);
  const detectedRef = useRef(onDetected);
  detectedRef.current = onDetected;
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState("Kamera belum aktif.");

  const releaseCamera = useCallback(() => {
    sessionRef.current += 1;
    controlsRef.current?.stop();
    controlsRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stopCamera = useCallback(() => {
    releaseCamera();
    setActive(false);
    setStarting(false);
  }, [releaseCamera]);

  useEffect(() => releaseCamera, [releaseCamera]);
  useEffect(() => { if (disabled) stopCamera(); }, [disabled, stopCamera]);
  useEffect(() => {
    const onHidden = () => { if (document.hidden) stopCamera(); };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [stopCamera]);

  const startCamera = async () => {
    if (disabled || active || starting) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("Kamera tidak tersedia. Buka halaman HTTPS ini di Safari atau Chrome, atau masukkan kode register secara manual.");
      return;
    }
    releaseCamera();
    const session = sessionRef.current;
    setStarting(true);
    setActive(true);
    setMessage("Menyiapkan kamera...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      if (session !== sessionRef.current || !videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      // JavaScript decoding works without the native BarcodeDetector API (e.g. iPhone).
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      if (session !== sessionRef.current || !videoRef.current) return;
      const reader = new BrowserMultiFormatReader(undefined, {
        delayBetweenScanAttempts: 200,
        delayBetweenScanSuccess: 500,
      });
      const controls = await reader.decodeFromStream(stream, videoRef.current, (result, _error, scanControls) => {
        if (session !== sessionRef.current) { scanControls.stop(); return; }
        if (!result?.getText()) return;
        scanControls.stop();
        stopCamera();
        setMessage("Kode berhasil dibaca. Periksa detail aset di bawah.");
        detectedRef.current(result.getText());
      });
      if (session !== sessionRef.current) { controls.stop(); return; }
      controlsRef.current = controls;
      setStarting(false);
      setMessage("Arahkan kamera ke barcode atau QR aset.");
    } catch (error) {
      if (session !== sessionRef.current) return;
      stopCamera();
      const name = error instanceof Error ? error.name : "";
      setMessage(name === "NotAllowedError"
        ? "Izin kamera ditolak. Izinkan kamera pada pengaturan situs di Safari/Chrome, lalu coba lagi."
        : name === "NotReadableError"
          ? "Kamera sedang digunakan. Tutup kamera di aplikasi atau tab lain, lalu coba lagi."
          : "Pemindai gagal dimulai. Coba lagi atau masukkan kode register secara manual.");
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-950">
        <video ref={videoRef} autoPlay muted playsInline className={`size-full object-cover ${active ? "" : "hidden"}`} aria-label="Preview kamera barcode" />
        {!active && <div className="flex size-full items-center justify-center px-6 text-center text-sm text-slate-400">{message}</div>}
        {active && <div className="pointer-events-none absolute inset-[15%] rounded-2xl border-2 border-emerald-300 shadow-[0_0_0_999px_rgba(2,44,34,0.25)]" />}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p role="status" className="text-xs text-slate-500">{message}</p>
        <button type="button" disabled={disabled} onClick={active ? stopCamera : () => void startCamera()} className="shrink-0 rounded-xl bg-[#197a58] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#11523c] disabled:opacity-50">
          {starting ? "Batalkan" : active ? "Matikan Kamera" : "Buka Kamera"}
        </button>
      </div>
    </div>
  );
}
