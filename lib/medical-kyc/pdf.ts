import type { MedicalKyc } from "@/lib/medical-kyc/types";
import { buildMedicalSummarySections } from "@/lib/medical-kyc/summary";

type SummaryPdfOptions = {
  generatedAt?: Date;
};

type DrawableLine = {
  kind: "heading" | "body" | "spacer";
  text: string;
};

const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const MARGIN_X = 92;
const CONTENT_TOP = 255;
const CONTENT_BOTTOM = 120;
const BODY_LINE_HEIGHT = 37;

function kathmanduDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function medicalSummaryFilename(date = new Date()) {
  return `SaharaCare_Medical_Summary_${kathmanduDate(date)}.pdf`;
}

function canvasToPng(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The medical summary page could not be encoded."));
    }, "image/png");
  });
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/u);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function drawHeader(
  context: CanvasRenderingContext2D,
  patientName: string,
  generatedDate: string,
  pageNumber: number,
) {
  context.fillStyle = "#f8fafc";
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  context.fillStyle = "#1d4ed8";
  context.fillRect(0, 0, PAGE_WIDTH, 36);
  context.fillStyle = "#0f172a";
  context.font = "700 46px 'Noto Sans', 'Noto Sans Devanagari', sans-serif";
  context.fillText("SaharaCare Medical Summary", MARGIN_X, 108);
  context.font = "600 25px 'Noto Sans', 'Noto Sans Devanagari', sans-serif";
  context.fillStyle = "#475569";
  context.fillText(`Patient: ${patientName.trim() || "Not provided"}`, MARGIN_X, 158);
  context.fillText(`Version 1.0  |  Generated ${generatedDate}`, MARGIN_X, 198);
  context.textAlign = "right";
  context.fillText(`Page ${pageNumber}`, PAGE_WIDTH - MARGIN_X, 198);
  context.textAlign = "left";
  context.strokeStyle = "#cbd5e1";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(MARGIN_X, 221);
  context.lineTo(PAGE_WIDTH - MARGIN_X, 221);
  context.stroke();
}

function expandDrawableLines(context: CanvasRenderingContext2D, kyc: MedicalKyc) {
  const output: DrawableLine[] = [];
  for (const section of buildMedicalSummarySections(kyc)) {
    output.push({ kind: "heading", text: section.title });
    context.font = "500 25px 'Noto Sans', 'Noto Sans Devanagari', sans-serif";
    for (const line of section.lines) {
      for (const wrapped of wrapText(context, line, PAGE_WIDTH - (MARGIN_X * 2) - 20)) {
        output.push({ kind: "body", text: wrapped });
      }
    }
    output.push({ kind: "spacer", text: "" });
  }
  return output;
}

export async function generateMedicalSummaryPdf(
  kyc: MedicalKyc,
  options: SummaryPdfOptions = {},
) {
  if (typeof document === "undefined") {
    throw new Error("Medical summaries can only be generated in the browser.");
  }

  await document.fonts.ready;
  const generatedAt = options.generatedAt ?? new Date();
  const generatedDate = kathmanduDate(generatedAt);
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle("SaharaCare Medical Summary");
  pdf.setSubject("Patient-owned medical information summary");
  pdf.setAuthor("SaharaCare");
  pdf.setCreator("SaharaCare local PDF generator");
  pdf.setProducer("SaharaCare");
  pdf.setCreationDate(generatedAt);
  pdf.setModificationDate(generatedAt);

  const measuringCanvas = document.createElement("canvas");
  const measuringContext = measuringCanvas.getContext("2d");
  if (!measuringContext) throw new Error("PDF text layout is not available in this browser.");
  const drawableLines = expandDrawableLines(measuringContext, kyc);

  const pages: DrawableLine[][] = [];
  let currentPage: DrawableLine[] = [];
  let usedHeight = 0;
  const availableHeight = PAGE_HEIGHT - CONTENT_TOP - CONTENT_BOTTOM;

  for (const line of drawableLines) {
    const height = line.kind === "heading" ? 54 : line.kind === "spacer" ? 22 : BODY_LINE_HEIGHT;
    if (usedHeight + height > availableHeight && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      usedHeight = 0;
    }
    currentPage.push(line);
    usedHeight += height;
  }
  if (currentPage.length > 0) pages.push(currentPage);

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = PAGE_WIDTH;
    canvas.height = PAGE_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PDF page rendering is not available in this browser.");
    drawHeader(context, kyc.patientBasics.fullName, generatedDate, pageIndex + 1);
    let y = CONTENT_TOP;

    for (const line of pages[pageIndex]) {
      if (line.kind === "heading") {
        context.fillStyle = "#1e3a8a";
        context.font = "700 29px 'Noto Sans', 'Noto Sans Devanagari', sans-serif";
        context.fillText(line.text, MARGIN_X, y + 28);
        y += 54;
      } else if (line.kind === "spacer") {
        y += 22;
      } else {
        context.fillStyle = "#1e293b";
        context.font = "500 25px 'Noto Sans', 'Noto Sans Devanagari', sans-serif";
        context.fillText(line.text, MARGIN_X + 10, y + 26);
        y += BODY_LINE_HEIGHT;
      }
    }

    context.font = "500 21px 'Noto Sans', 'Noto Sans Devanagari', sans-serif";
    context.fillStyle = "#64748b";
    context.fillText("Private patient-owned document", MARGIN_X, PAGE_HEIGHT - 58);
    context.textAlign = "right";
    context.fillText("Share only with a healthcare professional you choose.", PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 58);
    const pngBytes = new Uint8Array(await (await canvasToPng(canvas)).arrayBuffer());
    const png = await pdf.embedPng(pngBytes);
    const page = pdf.addPage([595.28, 841.89]);
    page.drawImage(png, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }

  const bytes = await pdf.save({ useObjectStreams: false, addDefaultPage: false });
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  return new File([blob], medicalSummaryFilename(generatedAt), {
    type: "application/pdf",
    lastModified: generatedAt.getTime(),
  });
}
