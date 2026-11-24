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
  printYear: number,
): void {
  const column = indexOnPage % settings.columns;
  const row = Math.floor(indexOnPage / settings.columns);
  const x = settings.marginMm + column * (dimensions.width + settings.gapMm);
  const y = settings.marginMm + row * (dimensions.height + settings.gapMm);
  const [red, green, blue] = hexToRgb(settings.headerColor);
  const leftWidth = dimensions.width * 0.28;
  const rightX = x + leftWidth;
  const rightWidth = dimensions.width - leftWidth;
  const inset = Math.max(1, Math.min(2, dimensions.width * 0.02));
  const qrSize = Math.min(leftWidth - inset * 2, dimensions.height * 0.47, 18);
  const logoSize = Math.min(leftWidth * 0.55, dimensions.height * 0.34, 10);
  const rightInset = Math.max(1.2, Math.min(2.2, rightWidth * 0.035));
  const textX = rightX + rightInset;
  const textWidth = rightWidth - rightInset * 2;
  const institutionY = y + dimensions.height * 0.13;
  const codeY = y + dimensions.height * 0.23;
  const barY = y + dimensions.height * 0.29;
  const barHeight = Math.max(3.2, Math.min(4.6, dimensions.height * 0.16));
  const assetY = y + dimensions.height * 0.68;
  const typeY = y + dimensions.height * 0.87;

  document.setFillColor(255, 255, 255);
  document.rect(x, y, dimensions.width, dimensions.height, "F");
  document.setDrawColor(0, 0, 0);
  document.setLineWidth(0.2);
  document.rect(x, y, dimensions.width, dimensions.height, "S");
  document.line(rightX, y, rightX, y + dimensions.height);

  document.addImage(
    logoDataUrl,
    "PNG",
    x + (leftWidth - logoSize) / 2,
    y + inset,
    logoSize,
    logoSize,
  );
  document.addImage(
    qrDataUrl,
    "PNG",
    x + (leftWidth - qrSize) / 2,
    y + dimensions.height - qrSize - inset,
    qrSize,
    qrSize,
  );

  document.setTextColor(0, 0, 0);
  document.setFont("helvetica", "bold");
  document.setFontSize(5.2);
  document.text("BADAN PEMERIKSA KEUANGAN", rightX + rightWidth / 2, institutionY, {
    align: "center",
    maxWidth: textWidth,
  });
  document.setFontSize(4.2);
  document.text("004013500350009000KD", rightX + rightWidth / 2, codeY, {
    align: "center",
    maxWidth: textWidth,
  });

  document.setFillColor(red, green, blue);
  document.rect(textX, barY, textWidth, barHeight, "F");
  document.setTextColor(0, 0, 0);
  document.setFontSize(4.8);
  document.text(
    `Kode Barang: ${asset.kode_barang || "-"}  NUP: ${asset.nup || "-"}`,
    rightX + rightWidth / 2,
    barY + barHeight * 0.68,
    { align: "center", maxWidth: textWidth - 1 },
  );

  const name = asset.nama_barang?.trim() || "Nama barang belum diisi";
  document.setFontSize(6.1);
  fitLines(document, name, textWidth, 2).forEach((line, lineIndex) => {
    document.text(line, rightX + rightWidth / 2, assetY + lineIndex * 2.6, {
      align: "center",
      maxWidth: textWidth,
    });
  });

  const merkType = [asset.merk, asset.tipe].filter(Boolean).join(" / ") || "-";
  document.setFontSize(5.2);
  document.text(`Merk/Type: ${merkType}`, rightX + rightWidth / 2, typeY, {
    align: "center",
    maxWidth: textWidth,
  });

  document.setFont("helvetica", "normal");
  document.setFontSize(3.6);
  document.text(`Tahun: ${printYear}`, x + dimensions.width - 1.2, y + 2, {
    align: "right",
  });
}

export async function createBMNLabelPdf(
  assets: MasterAset[],
  settings: BMNLabelSettings,
  onProgress?: (progress: PdfGenerationProgress) => void,
): Promise<Blob> {
  const printYear = new Date().getFullYear();
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
      printYear,
    );
    if ((labelIndex + 1) % 250 === 0) {
      onProgress?.({ phase: "pdf", current: labelIndex + 1, total: totalLabels });
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    }
  }
  onProgress?.({ phase: "pdf", current: totalLabels, total: totalLabels });
  return document.output("blob");
}
