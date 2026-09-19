/**
 * LaTeX Validator and Safe Auto-Repair Utility
 *
 * Catches common structural issues (malformed/empty list environments,
 * unclosed environments, unbalanced braces, orphan section headers, unescaped characters)
 * and safely repairs them before passing to pdflatex.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface RepairResult {
  repairedLatex: string;
  repairsMade: string[];
}

/**
 * Validates LaTeX structure for syntax rules and security.
 */
export function validateLatexStructure(tex: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!tex || typeof tex !== 'string' || !tex.trim()) {
    errors.push('LaTeX document is empty.');
    return { valid: false, errors, warnings };
  }

  const trimmed = tex.trim();

  // Basic document structure
  if (!trimmed.includes('\\documentclass')) {
    errors.push('Missing \\documentclass declaration.');
  }
  if (!trimmed.includes('\\begin{document}')) {
    errors.push('Missing \\begin{document} environment.');
  }
  if (!trimmed.includes('\\end{document}')) {
    errors.push('Missing \\end{document} environment.');
  }

  // Check for dangerous shell escape commands
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
      errors.push('LaTeX source contains disallowed or insecure primitives.');
      break;
    }
  }

  // Detect empty list environments that trigger "perhaps a missing \item"
  const emptyListMatches = trimmed.match(
    /\\begin\{(itemize|enumerate|description)\}(\[[^\]]*\])?\s*\\end\{\1\}/g
  );
  if (emptyListMatches && emptyListMatches.length > 0) {
    warnings.push(
      `Detected ${emptyListMatches.length} empty list environment(s) without \\item entries.`
    );
  }

  // Check balanced braces (ignoring escaped \{ and \} and comments)
  const lines = trimmed.split('\n');
  let openBraces = 0;
  let closeBraces = 0;
  for (const line of lines) {
    const withoutComment = line.replace(/(^|[^\\])%.*$/, '$1');
    const withoutEscaped = withoutComment.replace(/\\([{}])/g, '');
    for (let i = 0; i < withoutEscaped.length; i++) {
      if (withoutEscaped[i] === '{') openBraces++;
      else if (withoutEscaped[i] === '}') closeBraces++;
    }
  }
  if (openBraces !== closeBraces) {
    warnings.push(`Unbalanced braces detected: ${openBraces} opening vs ${closeBraces} closing.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Safely repairs recoverable syntax issues in LaTeX code.
 */
export function repairLatex(tex: string): RepairResult {
  if (!tex || typeof tex !== 'string') {
    return { repairedLatex: '', repairsMade: [] };
  }

  let repaired = tex;
  const repairsMade: string[] = [];

  // 1. Normalize Unicode symbols that cause pdflatex inputenc utf8 failure
  const preUnicode = repaired;
  repaired = repaired
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013/g, '--')
    .replace(/\u2014/g, '---')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2022\u25E6\u2023\u25AA\u25AB]/g, ''); // strip raw bullet glyphs

  if (repaired !== preUnicode) {
    repairsMade.push('Normalized non-ASCII punctuation and bullet glyphs');
  }

  // 2. Fix empty list environments or list environments without \\item
  // Pattern: \begin{itemize}... \end{itemize}
  const preListFix = repaired;
  repaired = repaired.replace(
    /\\begin\{(itemize|enumerate|description)\}(\[[^\]]*\])?([\s\S]*?)\\end\{\1\}/g,
    (match, env, opts, content) => {
      const trimmed = content.trim();

      // Check if it has at least one \item command
      if (!content.includes('\\item')) {
        // Look for text lines that might be intended items
        const rawLines = trimmed
          .split('\n')
          .map((l: string) => l.trim())
          .filter((l: string) => l && !l.startsWith('%') && !l.startsWith('\\vspace'));

        if (rawLines.length > 0) {
          // Wrap content in \item
          const items = rawLines.map((l: string) => `  \\item ${l}`).join('\n');
          return `\\begin{${env}}${opts || ''}\n${items}\n\\end{${env}}`;
        }

        // Entirely empty or only whitespace/comments -> remove completely
        return '';
      }

      // If it HAS \item, check whether there is non-comment text before the first \item
      // LaTeX forbids text directly after \begin{itemize} before the first \item
      const firstItemIdx = content.indexOf('\\item');
      const prefix = content.slice(0, firstItemIdx);
      const cleanedPrefix = prefix
        .split('\n')
        .map((l: string) => l.trim())
        .filter((l: string) => l && !l.startsWith('%') && !l.startsWith('\\vspace') && !l.startsWith('\\small') && !l.startsWith('\\footnotesize'))
        .join(' ');

      let fixedContent = content;
      if (cleanedPrefix) {
        // Prepend \item to the orphan prefix
        fixedContent = `  \\item ${cleanedPrefix}\n` + content.slice(firstItemIdx);
      }

      // Clean up empty \item commands (e.g. \item followed immediately by another \item or \end)
      fixedContent = fixedContent.replace(
        /\\item\s*(?=(\\item|\\end\{(itemize|enumerate|description)\}))/g,
        ''
      );

      // If after cleaning no items remain, strip the environment
      if (!fixedContent.includes('\\item')) {
        return '';
      }

      return `\\begin{${env}}${opts || ''}${fixedContent}\\end{${env}}`;
    }
  );

  if (repaired !== preListFix) {
    repairsMade.push('Repaired malformed or empty list environments');
  }

  // 3. Remove orphan section headers (e.g. \section{Skills} followed immediately by another section or \end{document})
  const preSectionFix = repaired;
  // Match a section header followed only by whitespace, comments, or vspace, right before another section or end of document
  repaired = repaired.replace(
    /(\\section\*?\{[^\}]*\})\s*(\\vspace\{[^\}]*\})?\s*(?=(\\section\*?\{|\\end\{document\}|$))/g,
    ''
  );
  if (repaired !== preSectionFix) {
    repairsMade.push('Removed empty section headers without content');
  }

  // 4. Balance environments before \end{document}
  const docEndIdx = repaired.indexOf('\\end{document}');
  if (docEndIdx !== -1) {
    const preDoc = repaired.slice(0, docEndIdx);
    const postDoc = repaired.slice(docEndIdx);

    const envRegex = /\\(begin|end)\{([a-zA-Z*]+)\}/g;
    const stack: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = envRegex.exec(preDoc)) !== null) {
      const type = match[1];
      const name = match[2];
      if (name === 'document') continue;
      if (type === 'begin') {
        stack.push(name);
      } else if (type === 'end') {
        if (stack.length > 0 && stack[stack.length - 1] === name) {
          stack.pop();
        }
      }
    }

    if (stack.length > 0) {
      let closings = '';
      while (stack.length > 0) {
        const envToClose = stack.pop()!;
        closings += `\n\\end{${envToClose}}`;
      }
      repaired = preDoc + closings + '\n' + postDoc;
      repairsMade.push('Closed unclosed LaTeX environments before \\end{document}');
    }
  }

  // 5. Balance unescaped braces before \end{document} if safe
  const lines = repaired.split('\n');
  let openBraces = 0;
  let closeBraces = 0;
  for (const line of lines) {
    const noComment = line.replace(/(^|[^\\])%.*$/, '$1');
    const noEscaped = noComment.replace(/\\([{}])/g, '');
    for (let i = 0; i < noEscaped.length; i++) {
      if (noEscaped[i] === '{') openBraces++;
      else if (noEscaped[i] === '}') closeBraces++;
    }
  }

  if (openBraces > closeBraces) {
    const missing = openBraces - closeBraces;
    const closingStr = '}'.repeat(missing);
    const lastDocIdx = repaired.lastIndexOf('\\end{document}');
    if (lastDocIdx !== -1) {
      repaired = repaired.slice(0, lastDocIdx) + closingStr + '\n' + repaired.slice(lastDocIdx);
      repairsMade.push(`Appended ${missing} missing closing brace(s)`);
    }
  }

  // 6. Clean up excessive consecutive blank lines
  repaired = repaired.replace(/\n{3,}/g, '\n\n');

  return {
    repairedLatex: repaired,
    repairsMade,
  };
}

/**
 * Combined validation and repair pipeline.
 */
export function validateAndRepairLatex(latexCode: string): {
  valid: boolean;
  repairedLatex: string;
  errors: string[];
  repairsMade: string[];
} {
  // First pass: validation of raw input
  const initial = validateLatexStructure(latexCode);

  // Auto-repair recoverable syntax problems
  const { repairedLatex, repairsMade } = repairLatex(latexCode);

  // Second pass: validate after repair
  const postValidation = validateLatexStructure(repairedLatex);

  return {
    valid: postValidation.valid,
    repairedLatex,
    errors: postValidation.errors,
    repairsMade,
  };
}
