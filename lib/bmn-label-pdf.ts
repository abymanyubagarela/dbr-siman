import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { MasterAset } from "@/lib/supabase";

export const F4_WIDTH_MM = 210;
export const F4_HEIGHT_MM = 330;
export const MAX_LABELS_PER_PDF = 15_000;

export type BMNLabelSettings = {
  columns: number;
  rows: number;
  marginMm: number;
  gapMm: number;
  copies: number;
  headerColor: string;
};

export type LabelDimensions = {
  width: number;
  height: number;
};

export type PdfGenerationProgress = {
  phase: "qr" | "pdf";
  current: number;
  total: number;
};

export function getLabelDimensions(
  settings: Pick<BMNLabelSettings, "columns" | "rows" | "marginMm" | "gapMm">,
): LabelDimensions {
  return {
    width:
      (F4_WIDTH_MM - settings.marginMm * 2 - settings.gapMm * (settings.columns - 1)) /
      settings.columns,
    height:
      (F4_HEIGHT_MM - settings.marginMm * 2 - settings.gapMm * (settings.rows - 1)) /
      settings.rows,
  };
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Logo BPK tidak dapat dibaca."));
    };
    reader.onerror = () => reject(new Error("Logo BPK tidak dapat dibaca."));
    reader.readAsDataURL(blob);
  });
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function headerTextColor([red, green, blue]: [number, number, number]): [number, number, number] {
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return brightness > 155 ? [25, 35, 32] : [255, 255, 255];
}

function fitLines(
  document: jsPDF,
  value: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines = document.splitTextToSize(value || "-", maxWidth) as string[];
  if (lines.length <= maxLines) return lines;

  const visible = lines.slice(0, maxLines);
  let finalLine = visible[maxLines - 1] ?? "";
  while (finalLine.length > 1 && document.getTextWidth(`${finalLine}...`) > maxWidth) {
    finalLine = finalLine.slice(0, -1);
  }
  visible[maxLines - 1] = `${finalLine}...`;
  return visible;
}

function addLabel(
  document: jsPDF,
  asset: MasterAset,
  qrDataUrl: string,
  indexOnPage: number,
  settings: BMNLabelSettings,
  dimensions: LabelDimensions,
  logoDataUrl: string,
): void {
  const column = indexOnPage % settings.columns;
  const row = Math.floor(indexOnPage / settings.columns);
  const x = settings.marginMm + column * (dimensions.width + settings.gapMm);
  const y = settings.marginMm + row * (dimensions.height + settings.gapMm);
  const [red, green, blue] = hexToRgb(settings.headerColor);
  const qrSize = Math.min(18, dimensions.height - 8);
  const textX = x + 13;
  const textWidth = dimensions.width - 13 - qrSize - 7;

  document.setDrawColor(148, 163, 184);
  document.setLineWidth(0.22);
  document.roundedRect(x, y, dimensions.width, dimensions.height, 1.2, 1.2, "S");
  document.setFillColor(red, green, blue);
  document.roundedRect(x + 0.15, y + 0.15, dimensions.width - 0.3, 6.3, 1.1, 1.1, "F");
  document.setFont("helvetica", "bold");
  document.setFontSize(5.7);
  document.setTextColor(...headerTextColor([red, green, blue]));
  document.text(
    "BADAN PEMERIKSA KEUANGAN REPUBLIK INDONESIA",
    x + 2.5,
    y + 4.1,
    { maxWidth: dimensions.width - 5 },
  );

  const logoSize = Math.min(9.5, dimensions.height - 12);
  document.addImage(logoDataUrl, "PNG", x + 2.1, y + 11.1, logoSize, logoSize);
  document.addImage(
    qrDataUrl,
    "PNG",
    x + dimensions.width - qrSize - 2.4,
    y + dimensions.height - qrSize - 2.1,
    qrSize,
    qrSize,
  );

  const name = asset.nama_barang?.trim() || "Nama barang belum diisi";
  document.setTextColor(15, 23, 42);
  document.setFont("helvetica", "bold");
  document.setFontSize(7.3);
  fitLines(document, name, textWidth, 2).forEach((line, lineIndex) => {
    document.text(line, textX, y + 10.7 + lineIndex * 3.1);
  });

  document.setFont("helvetica", "normal");
  document.setFontSize(5.5);
  document.setTextColor(51, 65, 85);
  document.text(
    fitLines(document, `Kode Barang: ${asset.kode_barang || "-"}`, textWidth, 1),
    textX,
    y + 17.2,
  );
  document.text(
    fitLines(document, `NUP: ${asset.nup || "-"}`, textWidth, 1),
    textX,
    y + 19.6,
  );
  document.text(
    fitLines(
      document,
      `Merk/Tipe: ${[asset.merk, asset.tipe].filter(Boolean).join(" ") || "-"}`,
      textWidth,
      1,
    ),
    textX,
    y + 22,
  );
  document.setFontSize(5.2);
  document.text(
    fitLines(document, `Kode Register: ${asset.kode_register ?? ""}`, textWidth, 2),
    textX,
    y + 24.4,
  );
}

export async function createBMNLabelPdf(
  assets: MasterAset[],
  settings: BMNLabelSettings,
  onProgress?: (progress: PdfGenerationProgress) => void,
): Promise<Blob> {
  const totalLabels = assets.length * settings.copies;
  if (totalLabels === 0) throw new Error("Pilih minimal satu aset untuk dicetak.");
  if (totalLabels > MAX_LABELS_PER_PDF) {
    throw new Error(`Maksimal ${MAX_LABELS_PER_PDF.toLocaleString("id-ID")} label dalam satu PDF.`);
  }

  const dimensions = getLabelDimensions(settings);
  const response = await fetch("/client-bpk.png");
  if (!response.ok) throw new Error("Logo BPK tidak dapat dimuat.");
  const logoDataUrl = await readAsDataUrl(await response.blob());

  const registerCodes = Array.from(
    new Set(assets.map((asset) => asset.kode_register).filter((code): code is string => code !== null && code !== "")),
  );
  const qrByRegister = new Map<string, string>();
  const batchSize = 80;
  for (let start = 0; start < registerCodes.length; start += batchSize) {
    const batch = registerCodes.slice(start, start + batchSize);
    const generated = await Promise.all(
      batch.map(async (code) => [
        code,
        await QRCode.toDataURL(code, {
          errorCorrectionLevel: "M",
          margin: 3,
          width: 384,
        }),
      ] as const),
    );
    generated.forEach(([code, dataUrl]) => qrByRegister.set(code, dataUrl));
    onProgress?.({
      phase: "qr",
      current: Math.min(start + batch.length, registerCodes.length),
      total: registerCodes.length,
    });
  }

  const document = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [F4_WIDTH_MM, F4_HEIGHT_MM],
    compress: true,
  });
  document.setProperties({
    title: "Label BMN - Badan Pemeriksa Keuangan Republik Indonesia",
    subject: "Label aset dengan QR kode register",
    creator: "DBR Asset Management",
  });

  const labelsPerPage = settings.columns * settings.rows;
  for (let labelIndex = 0; labelIndex < totalLabels; labelIndex += 1) {
    if (labelIndex > 0 && labelIndex % labelsPerPage === 0) document.addPage();
    const asset = assets[Math.floor(labelIndex / settings.copies)];
    if (!asset || asset.kode_register === null || asset.kode_register === "") continue;
    const qrDataUrl = qrByRegister.get(asset.kode_register);
    if (!qrDataUrl) throw new Error(`QR kode register aset ${asset.id} tidak berhasil dibuat.`);
    addLabel(
      document,
      asset,
      qrDataUrl,
      labelIndex % labelsPerPage,
      settings,
      dimensions,
      logoDataUrl,
    );
    if ((labelIndex + 1) % 250 === 0) {
      onProgress?.({ phase: "pdf", current: labelIndex + 1, total: totalLabels });
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    }
  }
  onProgress?.({ phase: "pdf", current: totalLabels, total: totalLabels });
  return document.output("blob");
}
