import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import type { Attachment } from '../../src/types';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch (err) {
    console.error('[FileExtractor] Could not create upload directory:', err);
  }
}

// Max 10MB per file
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md', '.png', '.jpg', '.jpeg', '.webp'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/markdown',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
];

export function validateFile(filename: string, mimeType: string, byteSize: number): void {
  const ext = path.extname(filename).toLowerCase();

  const isAllowedExt = ALLOWED_EXTENSIONS.includes(ext);
  const isAllowedMime = ALLOWED_MIME_TYPES.includes(mimeType) || mimeType.startsWith('image/') || mimeType.startsWith('text/');

  if (!isAllowedExt && !isAllowedMime) {
    throw new Error(
      `Unsupported file format for "${filename}". Please upload a PDF, DOCX, TXT, or Image (PNG, JPG, WEBP).`
    );
  }

  if (byteSize > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File "${filename}" exceeds the 10MB size limit (received ${(byteSize / (1024 * 1024)).toFixed(1)}MB).`
    );
  }
}

// Safe dynamic loader for pdf-parse supporting both v1 (function) and v2 (class PDFParse)
async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    const pdfParseModule: any = await import('pdf-parse');
    // pdf-parse v2+ exports PDFParse class
    if (pdfParseModule && typeof pdfParseModule.PDFParse === 'function') {
      const parser = new pdfParseModule.PDFParse({ data: buffer });
      const res = await parser.getText();
      return typeof res === 'string' ? res : (res?.text || '');
    }
    // pdf-parse v1 exports default or root function
    const pdfParse = pdfParseModule.default || pdfParseModule;
    if (typeof pdfParse === 'function') {
      const data = await pdfParse(buffer);
      return data?.text || '';
    }
    return '';
  } catch (err: any) {
    console.error('[FileExtractor] PDF parsing error:', err);
    throw new Error(`Failed to parse PDF document: ${err.message || 'Unknown error'}`);
  }
}

async function parseDocx(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (err: any) {
    console.error('[FileExtractor] DOCX parsing error:', err);
    throw new Error(`Failed to parse DOCX document: ${err.message || 'Unknown error'}`);
  }
}

export function getUploadedFilePath(fileId: string): string | null {
  if (!fileId || typeof fileId !== 'string') return null;
  const cleanId = path.basename(fileId);
  if (!cleanId || cleanId !== fileId || !fs.existsSync(UPLOAD_DIR)) return null;
  const files = fs.readdirSync(UPLOAD_DIR);
  const matched = files.find((f) => f === cleanId || f.startsWith(`${cleanId}.`));
  return matched ? path.join(UPLOAD_DIR, matched) : null;
}

export function getFileBuffer(fileId: string): Buffer | null {
  const filePath = getUploadedFilePath(fileId);
  if (!filePath || !fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

export async function processAttachment(
  filename: string,
  mimeType: string,
  base64Data: string
): Promise<Attachment> {
  // Strip data: prefix if present
  let cleanBase64 = base64Data;
  if (base64Data.includes(',')) {
    cleanBase64 = base64Data.split(',')[1];
  }

  const buffer = Buffer.from(cleanBase64, 'base64');
  const size = buffer.length;

  // Validate file size and type
  validateFile(filename, mimeType, size);

  // Generate safe file identifier and persist to data/uploads
  const ext = path.extname(filename).toLowerCase() || '.bin';
  const fileId = 'f_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const storedFilename = `${fileId}${ext}`;
  const filePath = path.join(UPLOAD_DIR, storedFilename);

  try {
    fs.writeFileSync(filePath, buffer);
  } catch (err: any) {
    console.error('[FileExtractor] Error saving file to disk:', err);
  }

  let textSnippet = '';
  const lowerName = filename.toLowerCase();

  try {
    if (mimeType === 'application/pdf' || lowerName.endsWith('.pdf')) {
      textSnippet = await parsePdf(buffer);
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword' ||
      lowerName.endsWith('.docx')
    ) {
      textSnippet = await parseDocx(buffer);
    } else if (
      mimeType.startsWith('text/') ||
      lowerName.endsWith('.txt') ||
      lowerName.endsWith('.md')
    ) {
      textSnippet = buffer.toString('utf-8');
    } else if (
      mimeType.startsWith('image/') ||
      ['.png', '.jpg', '.jpeg', '.webp'].some((e) => lowerName.endsWith(e))
    ) {
      // Images are stored and passed to Gemini via inlineData when needed
      textSnippet = `[Image document: ${filename}]`;
    }
  } catch (err: any) {
    console.warn('[FileExtractor] Text extraction warning:', err.message);
    throw new Error('Unable to process this file. Please try again.');
  }

  // Sanitize textSnippet
  const sanitizedText = textSnippet.replace(/\u0000/g, '').trim();

  // Return attachment record: store fileId and fileUrl instead of duplicating large base64
  // If image, fileUrl allows frontend <img src="..."> preview
  const fileUrl = `/api/files/${fileId}`;

  return {
    id: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    name: filename,
    type: mimeType,
    size,
    fileId,
    fileUrl,
    // Keep dataUrl as fileUrl for preview, or if image < 64KB keep for instant render
    dataUrl: mimeType.startsWith('image/') && size < 65536 ? `data:${mimeType};base64,${cleanBase64}` : fileUrl,
    textSnippet: sanitizedText,
    parsedContent: sanitizedText,
  };
}
