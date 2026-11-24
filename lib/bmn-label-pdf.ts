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
  settings: Pick<
    BMNLabelSettings,
    "columns" | "rows" | "marginMm" | "gapMm"
  >,
): LabelDimensions {
  return {
    width: 90,
    height: 32.5,
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

  const x =
    settings.marginMm +
    column * (dimensions.width + settings.gapMm);

  const y =
    settings.marginMm +
    row * (dimensions.height + settings.gapMm);

  const w = dimensions.width;
  const h = dimensions.height;

  const [red, green, blue] = hexToRgb(settings.headerColor);

  // ==========================================
  // TABLE DIMENSIONS
  // ==========================================

  const leftWidth = w * 0.285;
  const rightWidth = w - leftWidth;
  const rightX = x + leftWidth;

  const headerHeight = h * 0.50;
  const barHeight = h * 0.15;
  const nameHeight = h * 0.12;
  const typeHeight =
    h - headerHeight - barHeight - nameHeight;

  const headerBottom = y + headerHeight;
  const barBottom = headerBottom + barHeight;
  const nameBottom = barBottom + nameHeight;

  const padding = 0.7;
  const textX = rightX + padding;
  const textWidth = rightWidth - padding * 2;

  const mmPerPt = 25.4 / 72;
  const scale = Math.min(w / 93.5, h / 28.3, 1.5);

  // Helper: fit single-line text without overflow.
  function drawSingleLine(
    value: string,
    centerY: number,
    fontSize: number,
    align: "left" | "center" = "left",
    maxWidth: number = textWidth,
  ) {
    document.setFontSize(fontSize);

    const actualWidth = document.getTextWidth(value);

    if (actualWidth > maxWidth) {
      document.setFontSize(
        fontSize * (maxWidth / actualWidth),
      );
    }

    document.text(
      value,
      align === "center"
        ? rightX + rightWidth / 2
        : textX,
      centerY,
      {
        align,
        baseline: "middle",
      },
    );
  }

  // ==========================================
  // WHITE BACKGROUND
  // ==========================================

  document.setFillColor(255, 255, 255);
  document.rect(x, y, w, h, "F");

  // ==========================================
  // COLORED ASSET CODE ROW
  // Full width without additional margins
  // ==========================================

  document.setFillColor(red, green, blue);

  document.rect(
    rightX,
    headerBottom,
    rightWidth,
    barHeight,
    "F",
  );

  // ==========================================
  // TABLE BORDERS
  // ==========================================

  document.setDrawColor(0, 0, 0);
  document.setLineWidth(0.2);

  // Outer border
  document.rect(x, y, w, h, "S");

  // Vertical divider: logo/QR and asset information
  document.line(
    rightX,
    y,
    rightX,
    y + h,
  );

  // Horizontal divider: header and lower section
  document.line(
    x,
    headerBottom,
    x + w,
    headerBottom,
  );

  // Divider below colored bar
  document.line(
    rightX,
    barBottom,
    x + w,
    barBottom,
  );

  // Divider below asset name
  document.line(
    rightX,
    nameBottom,
    x + w,
    nameBottom,
  );

  // ==========================================
  // BPK LOGO
  // Larger and centered in upper-left cell
  // ==========================================

  const logoProperties = document.getImageProperties(logoDataUrl);
  const logoRatio = logoProperties.width / logoProperties.height;

  const logoHeight = headerHeight * 1.5;
  const logoWidth = logoHeight * logoRatio;

  document.addImage(
    logoDataUrl,
    "PNG",
    x + (leftWidth - logoWidth) / 2,
    y + (headerHeight - logoHeight) / 2,
    logoWidth,
    logoHeight
  );

  // ==========================================
  // QR CODE
  // Centered in lower-left cell
  // ==========================================

  const qrCellHeight = h - headerHeight;

  const qrSize = Math.min(
    leftWidth - 1,
    qrCellHeight - 1,
  );

  document.addImage(
    qrDataUrl,
    "PNG",
    x + (leftWidth - qrSize) / 2,
    headerBottom + (qrCellHeight - qrSize) / 2,
    qrSize,
    qrSize,
  );

  // ==========================================
  // INSTITUTION HEADER
  // ==========================================

  document.setTextColor(0, 0, 0);
  document.setFont("helvetica", "bold");

  drawSingleLine(
    "BADAN PEMERIKSA KEUANGAN",
    y + headerHeight * 0.36,
    9 * scale,
    "center",
  );

  drawSingleLine(
    "004013500350009000KD",
    y + headerHeight * 0.65,
    8 * scale,
    "center",
  );

  // ==========================================
  // KODE BARANG AND NUP
  // ==========================================

  const luminance = (
    0.2126 * red +
    0.7152 * green +
    0.0722 * blue
  );

  // Automatically maintain readable contrast.
  if (luminance > 190) {
    document.setTextColor(0, 0, 0);
  } else {
    document.setTextColor(255, 255, 255);
  }

  document.setFont("helvetica", "bold");

  const assetCode =
    `${asset.kode_barang ?? "-"} NUP:${asset.nup ?? "-"}`;

  drawSingleLine(
    assetCode,
    headerBottom + barHeight / 2,
    10.0 * scale,
  );

  // ==========================================
  // NAMA BARANG
  // Left aligned
  // ==========================================

  document.setTextColor(0, 0, 0);
  document.setFont("helvetica", "bold");

  const assetName =
    (asset.nama_barang?.trim() || "-").toUpperCase();

  drawSingleLine(
    assetName,
    barBottom + nameHeight / 2,
    6.2 * scale,
  );

  // ==========================================
  // MERK / TYPE
  // Left aligned, maximum two lines
  // ==========================================

  const merkType =
    [asset.merk, asset.tipe]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(" / ") || "-";

  const yearHeight = Math.min(2.5 * scale, typeHeight * 0.30);

  const availableTypeHeight =
    typeHeight - yearHeight - padding * 2;

  let typeFontSize = 6.0 * scale;

  document.setFont("helvetica", "bold");
  document.setFontSize(typeFontSize);

  let typeLines = document.splitTextToSize(
    merkType,
    textWidth,
  ) as string[];

  // Reduce font size for long brand/type descriptions.
  while (
    (
      typeLines.length > 2 ||
      typeLines.length *
        typeFontSize *
        mmPerPt *
        1.10 > availableTypeHeight
    ) &&
    typeFontSize > 3.8 * scale
  ) {
    typeFontSize -= 0.2 * scale;

    document.setFontSize(typeFontSize);

    typeLines = document.splitTextToSize(
      merkType,
      textWidth,
    ) as string[];
  }

  // Prevent text from exceeding the label boundary.
  typeLines = fitLines(
    document,
    merkType,
    textWidth,
    2,
  );

  const lineHeight = Math.min(
    typeFontSize * mmPerPt * 1.10,
    availableTypeHeight / Math.max(1, typeLines.length),
  );

  typeLines.forEach((line, index) => {
    document.text(
      line,
      textX,
      nameBottom + padding + lineHeight * (index + 0.5),
      {
        align: "left",
        baseline: "middle",
      },
    );
  });

  // ==========================================
  // PRINT YEAR
  // Small text in bottom-right corner
  // ==========================================

  document.setTextColor(0, 0, 0);
  document.setFont("helvetica", "normal");
  document.setFontSize(4.0 * scale);

  document.text(
    `Tahun: ${printYear}`,
    x + w - padding,
    y + h - padding,
    {
      align: "right",
      baseline: "bottom",
    },
  );
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
          margin: 4,
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
