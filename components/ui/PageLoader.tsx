"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

export function setPageLoading(isLoading: boolean) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("dbr:page-loading", { detail: isLoading }));
  }
}

export function PageLoader() {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleLoading = (event: Event) => {
      setIsLoading((event as CustomEvent<boolean>).detail);
    };
    window.addEventListener("dbr:page-loading", handleLoading);
    return () => window.removeEventListener("dbr:page-loading", handleLoading);
  }, []);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#f8f9f8]/85 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="status"
          aria-live="polite"
          aria-label="Memuat halaman"
        >
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-emerald-100 bg-white/95 px-8 py-7 shadow-[0_18px_50px_rgba(22,101,70,0.14)]">
            <div className="relative flex size-14 items-center justify-center">
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-emerald-100 border-t-[#197a58]"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
              />
              <motion.span
                className="text-2xl text-[#197a58]"
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                aria-hidden="true"
              >
                ▱
              </motion.span>
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-800">Menyiapkan Data</p>
              <p className="mt-1 text-xs text-slate-400">Mohon Tunggu Sebentar</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
