import path from "path";
import fs from "fs";

const SUPPORT_UPLOADS_DIR = path.join(process.cwd(), "public", "support-uploads");

type PdfParseFn = (dataBuffer: Buffer) => Promise<{ text?: string }>;

/**
 * Extract text from a PDF file. The url can be a full URL or path like /support-uploads/xxx.pdf.
 * Returns extracted text or empty string on failure.
 */
export async function extractPdfTextFromUrl(url: string): Promise<string> {
  let filePath: string | null = null;
  try {
    const filename = path.basename(url.split("?")[0]);
    if (filename.toLowerCase().endsWith(".pdf")) {
      filePath = path.join(SUPPORT_UPLOADS_DIR, filename);
      if (!fs.existsSync(filePath)) return "";
    }
  } catch {
    return "";
  }
  if (!filePath) return "";

  try {
    const pdfParse = await import("pdf-parse").catch(() => null);
    const parser = pdfParse?.default as PdfParseFn | undefined;
    if (!parser) return "";
    const dataBuffer = fs.readFileSync(filePath);
    const data = await parser(dataBuffer);
    return typeof data?.text === "string" ? data.text.trim().slice(0, 30000) : "";
  } catch {
    return "";
  }
}
