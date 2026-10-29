"use client";

import { useEffect, useRef, useState } from "react";

interface CameraBarcodeScannerProps {
  onDetected: (value: string) => void;
  disabled?: boolean;
}

export function CameraBarcodeScanner({ onDetected, disabled = false }: CameraBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("Kamera belum aktif.");

  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const stopCamera = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActive(false);
  };

  const startCamera = async () => {
    if (!("BarcodeDetector" in window)) {
      setMessage("Browser ini belum mendukung pemindaian barcode kamera.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setActive(true);
      setMessage("Arahkan kamera ke barcode atau QR aset.");
      const detector = new window.BarcodeDetector({ formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8"] });
      const scan = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          frameRef.current = requestAnimationFrame(scan);
          return;
        }
        const codes = await detector.detect(videoRef.current);
        if (codes[0]?.rawValue) {
          onDetected(codes[0].rawValue);
          stopCamera();
          return;
        }
        frameRef.current = requestAnimationFrame(scan);
      };
      frameRef.current = requestAnimationFrame(scan);
    } catch {
      setMessage("Kamera tidak dapat diakses. Periksa izin kamera browser.");
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-950">
        <video ref={videoRef} muted playsInline className={`size-full object-cover ${active ? "" : "hidden"}`} aria-label="Preview kamera barcode" />
        {!active && <div className="flex size-full items-center justify-center px-6 text-center text-sm text-slate-400">{message}</div>}
        {active && <div className="pointer-events-none absolute inset-[15%] rounded-2xl border-2 border-emerald-300 shadow-[0_0_0_999px_rgba(2,44,34,0.25)]" />}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">{active ? message : "Gunakan kamera perangkat untuk scan."}</p>
        <button type="button" disabled={disabled} onClick={active ? stopCamera : () => void startCamera()} className="shrink-0 rounded-xl bg-[#197a58] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#11523c] disabled:opacity-50">
          {active ? "Matikan Kamera" : "Buka Kamera"}
        </button>
      </div>
    </div>
  );
}

declare global {
  interface Window {
    BarcodeDetector: new (options?: { formats?: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> };
  }
}
