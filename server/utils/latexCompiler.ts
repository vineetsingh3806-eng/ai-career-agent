import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile, execSync } from 'child_process';
import { db } from '../database.ts';
import { validateAndRepairLatex, repairLatex } from './latexValidator.ts';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');
const ASSETS_LATEX_DIR = path.join(process.cwd(), 'server', 'assets', 'latex');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch (err) {
    console.error('[LaTeXCompiler] Could not create upload directory:', err);
  }
}

export interface CompileResult {
  success: boolean;
  pdfUrl?: string;
  pdfFileId?: string;
  size?: number;
  finalLatex?: string;
  repairsMade?: string[];
  error?: 'MISSING_COMPILER' | 'EMPTY_LATEX' | 'INVALID_SYNTAX' | 'COMPILATION_FAILED' | 'TIMEOUT' | 'STORAGE_FAILED';
  message?: string;
  log?: string;
}

// Check whether pdflatex or tectonic is available
export function checkCompilerAvailable(): { available: boolean; binary: string | null } {
  try {
    execSync('which pdflatex', { stdio: 'pipe' });
    return { available: true, binary: 'pdflatex' };
  } catch {
    try {
      execSync('which tectonic', { stdio: 'pipe' });
      return { available: true, binary: 'tectonic' };
    } catch {
      return { available: false, binary: null };
    }
  }
}

/**
 * Validates LaTeX syntax for basic structure and security.
 */
export function validateLatexInput(latexCode: string): { valid: boolean; error?: string } {
  if (!latexCode || typeof latexCode !== 'string' || !latexCode.trim()) {
    return { valid: false, error: 'LaTeX code is empty.' };
  }

  const trimmed = latexCode.trim();
  if (!trimmed.includes('\\documentclass')) {
    return { valid: false, error: 'Invalid LaTeX document: missing \\documentclass declaration.' };
  }
  if (!trimmed.includes('\\begin{document}') || !trimmed.includes('\\end{document}')) {
    return { valid: false, error: 'Invalid LaTeX document: missing \\begin{document} or \\end{document}.' };
  }

  // Security checks: Disallow dangerous shell escape commands
  const dangerousPatterns = [
    /\\write18\b/,
    /\\immediate\\write18\b/,
    /\\openin\b/,
    /\\openout\b/,
    /\\sys_shell_now\b/,
    /\\input\{[/\\]/,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: 'LaTeX source contains disallowed or insecure primitives.' };
    }
  }

  return { valid: true };
}

/**
 * Parses LaTeX log output to extract the most descriptive error lines.
 */
function extractLatexError(log: string, stdout: string, stderr: string): string {
  const combined = `${log}\n${stdout}\n${stderr}`;
  const lines = combined.split('\n');

  // Look for standard LaTeX errors starting with '!'
  const errorLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('!')) {
      errorLines.push(line);
      // Grab the next 2 lines for context if available
      if (lines[i + 1] && lines[i + 1].trim()) errorLines.push(lines[i + 1].trim());
      if (lines[i + 2] && lines[i + 2].trim()) errorLines.push(lines[i + 2].trim());
      break;
    }
  }

  if (errorLines.length > 0) {
    return errorLines.join(' ');
  }

  // Look for "Fatal error occurred" or "Emergency stop"
  const fatalLine = lines.find((l) => l.includes('Fatal error') || l.includes('Emergency stop') || l.includes('Error:'));
  if (fatalLine) return fatalLine.trim();

  // Return last non-empty line of output
  const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);
  return nonEmpty.slice(-3).join(' ') || 'LaTeX compilation failed with unspecified error.';
}

/**
 * Executes the compiler binary in an isolated temporary directory.
 */
async function runCompilerProcess(
  binary: string,
  code: string,
  timeoutMs: number
): Promise<{ success: boolean; pdfBuffer?: Buffer; error?: any; log?: string }> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'latex_build_'));
  const inputTexPath = path.join(tempDir, 'resume.tex');
  const outputPdfPath = path.join(tempDir, 'resume.pdf');
  const logPath = path.join(tempDir, 'resume.log');

  try {
    fs.writeFileSync(inputTexPath, code, 'utf-8');

    // If local latex styles exist (enumitem.sty, titlesec.sty), copy them into tempDir
    if (fs.existsSync(ASSETS_LATEX_DIR)) {
      const styles = fs.readdirSync(ASSETS_LATEX_DIR);
      for (const styleFile of styles) {
        fs.copyFileSync(
          path.join(ASSETS_LATEX_DIR, styleFile),
          path.join(tempDir, styleFile)
        );
      }
    }

    let args: string[] = [];
    if (binary === 'pdflatex') {
      args = [
        '-interaction=nonstopmode',
        '-no-shell-escape',
        '-halt-on-error',
        `-output-directory=${tempDir}`,
        inputTexPath,
      ];
    } else {
      args = ['-o', tempDir, inputTexPath];
    }

    await new Promise<void>((resolve, reject) => {
      execFile(
        binary,
        args,
        {
          cwd: tempDir,
          timeout: timeoutMs,
          env: {
            ...process.env,
            TEXINPUTS: `.:${tempDir}:${ASSETS_LATEX_DIR}:`,
          },
        },
        (err, stdout, stderr) => {
          if (err) {
            let logContent = '';
            if (fs.existsSync(logPath)) {
              try {
                logContent = fs.readFileSync(logPath, 'utf-8');
              } catch {
                // ignore
              }
            }
            const friendlyErr = extractLatexError(logContent, stdout || '', stderr || '');
            const isTimeout = (err as any).killed || err.signal === 'SIGTERM';
            reject({
              error: isTimeout ? 'TIMEOUT' : 'COMPILATION_FAILED',
              message: isTimeout
                ? `LaTeX compilation timed out after ${timeoutMs / 1000}s.`
                : friendlyErr,
              log: logContent || `${stdout}\n${stderr}`,
            });
          } else {
            resolve();
          }
        }
      );
    });

    if (!fs.existsSync(outputPdfPath)) {
      let logContent = '';
      if (fs.existsSync(logPath)) {
        try {
          logContent = fs.readFileSync(logPath, 'utf-8');
        } catch {
          // ignore
        }
      }
      return {
        success: false,
        error: {
          error: 'COMPILATION_FAILED',
          message: 'Compilation completed without producing an output PDF file.',
          log: logContent,
        },
      };
    }

    const pdfBuffer = fs.readFileSync(outputPdfPath);
    return { success: true, pdfBuffer };
  } catch (err: any) {
    let logContent = err.log || '';
    if (!logContent && fs.existsSync(logPath)) {
      try {
        logContent = fs.readFileSync(logPath, 'utf-8');
      } catch {
        // ignore
      }
    }
    return {
      success: false,
      error: {
        error: err.error || 'COMPILATION_FAILED',
        message: err.message || 'LaTeX compilation failed.',
        log: logContent,
      },
    };
  } finally {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupErr) {
      console.warn('[LaTeXCompiler] Failed to clean temp dir:', cleanupErr);
    }
  }
}

/**
 * Compiles a LaTeX document into a PDF with automatic validation and safe auto-repair.
 */
export async function compileLatexToPdf(
  latexCode: string,
  options: {
    userId?: string;
    guestId?: string;
    filename?: string;
    timeoutMs?: number;
  } = {}
): Promise<CompileResult> {
  // 1. Initial validation and auto-repair of structural issues
  const { valid, repairedLatex, errors, repairsMade } = validateAndRepairLatex(latexCode);
  if (!valid && errors.length > 0) {
    return {
      success: false,
      error: 'INVALID_SYNTAX',
      message: errors.join('; '),
      finalLatex: repairedLatex || latexCode,
    };
  }

  // 2. Check compiler availability
  const compiler = checkCompilerAvailable();
  if (!compiler.available || !compiler.binary) {
    return {
      success: false,
      error: 'MISSING_COMPILER',
      message: 'LaTeX compiler (pdflatex) is not installed or available on this server.',
      finalLatex: repairedLatex,
    };
  }

  const timeoutMs = options.timeoutMs || 20000;
  let activeLatex = repairedLatex;
  const allRepairs = [...repairsMade];

  // 3. First compilation attempt
  let compileRes = await runCompilerProcess(compiler.binary, activeLatex, timeoutMs);

  // 4. If compilation failed with recoverable error (e.g. "perhaps a missing \item"), attempt targeted repair
  if (!compileRes.success && compileRes.error) {
    const errorMsg = String(compileRes.error.message || '');
    if (errorMsg.includes("perhaps a missing \\item") || errorMsg.includes("missing \\item")) {
      // Aggressive repair: strip any remaining list environment that contains no items
      let emergencyLatex = activeLatex.replace(
        /\\begin\{(itemize|enumerate|description)\}(\[[^\]]*\])?([\s\S]*?)\\end\{\1\}/g,
        (match, env, opts, content) => {
          if (!content.includes('\\item')) {
            return '';
          }
          return match;
        }
      );
      // Remove any newly emptied sections
      emergencyLatex = emergencyLatex.replace(
        /(\\section\*?\{[^\}]*\})\s*(\\vspace\{[^\}]*\})?\s*(?=(\\section\*?\{|\\end\{document\}|$))/g,
        ''
      );

      if (emergencyLatex !== activeLatex) {
        allRepairs.push('Removed malformed list environment triggering missing \\item error');
        activeLatex = emergencyLatex;
        // Retry compilation with repaired LaTeX
        compileRes = await runCompilerProcess(compiler.binary, activeLatex, timeoutMs);
      }
    }
  }

  // If still failed after repairs, return real error and the exact LaTeX source for inspection
  if (!compileRes.success || !compileRes.pdfBuffer) {
    const errObj = compileRes.error || {};
    return {
      success: false,
      error: errObj.error || 'COMPILATION_FAILED',
      message: errObj.message || 'LaTeX compilation failed.',
      log: errObj.log,
      finalLatex: activeLatex,
      repairsMade: allRepairs,
    };
  }

  const pdfBuffer = compileRes.pdfBuffer;
  if (pdfBuffer.length === 0) {
    return {
      success: false,
      error: 'COMPILATION_FAILED',
      message: 'The produced PDF file is empty.',
      finalLatex: activeLatex,
      repairsMade: allRepairs,
    };
  }

  // 5. Save to application storage
  const fileId = 'f_pdf_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const destFilename = `${fileId}.pdf`;
  const destFilePath = path.join(UPLOAD_DIR, destFilename);

  try {
    fs.writeFileSync(destFilePath, pdfBuffer);
  } catch (writeErr: any) {
    return {
      success: false,
      error: 'STORAGE_FAILED',
      message: `Failed to write generated PDF: ${writeErr.message}`,
      finalLatex: activeLatex,
    };
  }

  const safeFilename = options.filename
    ? options.filename.endsWith('.pdf')
      ? options.filename
      : `${options.filename}.pdf`
    : 'resume.pdf';

  db.saveUploadedFile({
    fileId,
    filename: safeFilename,
    mimeType: 'application/pdf',
    size: pdfBuffer.length,
    userId: options.userId,
    guestId: options.guestId,
    createdAt: new Date().toISOString(),
  });

  return {
    success: true,
    pdfUrl: `/api/files/${fileId}`,
    pdfFileId: fileId,
    size: pdfBuffer.length,
    finalLatex: activeLatex,
    repairsMade: allRepairs,
  };
}
