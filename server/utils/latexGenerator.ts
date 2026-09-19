import type { ResumeData, TemplateId } from '../../src/types';

/**
 * Robust LaTeX text escaping that avoids double-escaping already escaped sequences.
 * Handles: &, %, $, #, _, {, }, ~, ^, \, and Unicode punctuation/bullets.
 */
export function escapeLatex(text?: string): string {
  if (!text) return '';
  let s = String(text);

  // Normalize troublesome Unicode characters for pdflatex
  s = s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013/g, '--')
    .replace(/\u2014/g, '---')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2022\u25E6\u2023\u25AA\u25AB]/g, ''); // strip raw bullet symbols

  // Step 1: Protect already-escaped sequences and safe LaTeX tags with placeholders
  const protectedItems: { token: string; value: string }[] = [];
  let tokenCounter = 0;
  const protect = (str: string): string => {
    const token = `@@LATEX_PROTECTED_${tokenCounter++}@@`;
    protectedItems.push({ token, value: str });
    return token;
  };

  // Protect known LaTeX commands / already-escaped symbols
  s = s.replace(/\\textbackslash\{\}/g, protect);
  s = s.replace(/\\textasciitilde\{\}/g, protect);
  s = s.replace(/\\textasciicircum\{\}/g, protect);
  s = s.replace(/\\([&%$#_{}])/g, (match) => protect(match));
  s = s.replace(/\\(textbf|textit|underline|href|url)\{[^}]*\}/g, (match) => protect(match));

  // Step 2: Escape raw backslashes that are not part of protected sequences
  s = s.replace(/\\/g, '\\textbackslash{}');

  // Step 3: Escape raw sensitive LaTeX characters
  s = s.replace(/([&%$#_{}])/g, '\\$1');
  s = s.replace(/~/g, '\\textasciitilde{}');
  s = s.replace(/\^/g, '\\textasciicircum{}');

  // Step 4: Restore protected items
  for (const item of protectedItems) {
    s = s.replace(item.token, item.value);
  }

  return s.trim();
}

/**
 * Formats a clean, safe URL for hyperref \href{url}{label}.
 */
function sanitizeUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

export function generateLatex(resume: ResumeData, template: TemplateId = 'modern'): string {
  const activeTemplate: TemplateId = template || resume.templateId || 'modern';

  // Contact Info
  const name = escapeLatex(resume.name || 'Candidate Name');
  const targetRole = escapeLatex(resume.targetRole || '');
  const email = (resume.email || '').trim();
  const phone = escapeLatex(resume.phone || '');
  const location = escapeLatex(resume.location || '');
  const linkedin = sanitizeUrl(resume.linkedin);
  const github = sanitizeUrl(resume.github);
  const portfolio = sanitizeUrl(resume.portfolio);
  const summary = escapeLatex(resume.summary || '');

  const contactItems: string[] = [];
  if (email) contactItems.push(`\\href{mailto:${email}}{${escapeLatex(email)}}`);
  if (phone) contactItems.push(phone);
  if (location) contactItems.push(location);
  if (linkedin) contactItems.push(`\\href{${linkedin}}{LinkedIn}`);
  if (github) contactItems.push(`\\href{${github}}{GitHub}`);
  if (portfolio) contactItems.push(`\\href{${portfolio}}{Portfolio}`);

  const contactLine = contactItems.join(' $|$ ');

  // Skills - only build non-empty categories
  const technicalSkills = (resume.skills?.technical || [])
    .map((s) => escapeLatex(s))
    .filter(Boolean)
    .join(', ');
  const frameworks = (resume.skills?.frameworks || [])
    .map((s) => escapeLatex(s))
    .filter(Boolean)
    .join(', ');
  const tools = (resume.skills?.tools || [])
    .map((s) => escapeLatex(s))
    .filter(Boolean)
    .join(', ');
  const soft = (resume.skills?.soft || [])
    .map((s) => escapeLatex(s))
    .filter(Boolean)
    .join(', ');

  const skillItems: string[] = [];
  if (technicalSkills) skillItems.push(`  \\item \\textbf{Technical Skills:} ${technicalSkills}`);
  if (frameworks) skillItems.push(`  \\item \\textbf{Frameworks \\& Libraries:} ${frameworks}`);
  if (tools) skillItems.push(`  \\item \\textbf{Tools \\& Platforms:} ${tools}`);
  if (soft) skillItems.push(`  \\item \\textbf{Key Competencies:} ${soft}`);

  const hasSkills = skillItems.length > 0;
  const skillsSection = hasSkills
    ? `% Skills
\\section{Skills}
\\begin{itemize}[noitemsep,topsep=0pt,leftmargin=1.2em]
${skillItems.join('\n')}
\\end{itemize}`
    : '';

  // Experience - ensure no empty items or empty itemize blocks
  const validExp = (resume.experience || []).filter(
    (exp) => exp && ((exp.company && exp.company.trim()) || (exp.role && exp.role.trim()))
  );

  const experienceBlocks = validExp
    .map((exp) => {
      const company = escapeLatex(exp.company || '');
      const role = escapeLatex(exp.role || '');
      const dates = escapeLatex(
        `${exp.startDate || ''} -- ${exp.current ? 'Present' : exp.endDate || ''}`
      );
      const loc = escapeLatex(exp.location || '');

      const validBullets = (exp.bulletPoints || [])
        .map((b) => (typeof b === 'string' ? b.trim() : ''))
        .filter(Boolean)
        .map((b) => `    \\item ${escapeLatex(b)}`);

      const bulletsList =
        validBullets.length > 0
          ? `\\begin{itemize}[noitemsep,topsep=0pt,leftmargin=1.2em]
${validBullets.join('\n')}
\\end{itemize}`
          : '';

      const header = `\\textbf{${role || 'Role'}} \\hfill {${dates}}\\\\
\\textit{${company || 'Company'}} ${loc ? `\\hfill \\textit{${loc}}` : ''}`;

      return bulletsList ? `${header}\n${bulletsList}\n\\vspace{4pt}` : `${header}\n\\vspace{4pt}`;
    })
    .join('\n\n');

  const experienceSection = experienceBlocks
    ? `% Experience
\\section{Experience}
${experienceBlocks}`
    : '';

  // Education
  const validEdu = (resume.education || []).filter(
    (edu) => edu && ((edu.institution && edu.institution.trim()) || (edu.degree && edu.degree.trim()))
  );

  const educationBlocks = validEdu
    .map((edu) => {
      const inst = escapeLatex(edu.institution || '');
      const deg = escapeLatex(edu.degree || '');
      const field = escapeLatex(edu.fieldOfStudy || '');
      const dates = escapeLatex(`${edu.startDate || ''} -- ${edu.endDate || ''}`);
      const grade = edu.grade ? ` $|$ GPA: ${escapeLatex(edu.grade)}` : '';
      return `\\textbf{${inst}} \\hfill {${dates}}\\\\
\\textit{${deg}${field ? ', ' + field : ''}${grade}}\\\\
\\vspace{4pt}`;
    })
    .join('\n');

  const educationSection = educationBlocks
    ? `% Education
\\section{Education}
${educationBlocks}`
    : '';

  // Projects
  const validProjects = (resume.projects || []).filter(
    (proj) => proj && proj.name && proj.name.trim()
  );

  const projectBlocks = validProjects
    .map((proj) => {
      const pName = escapeLatex(proj.name);
      const tech = proj.technologies?.length
        ? ` $|$ \\textit{${proj.technologies.map(escapeLatex).filter(Boolean).join(', ')}}`
        : '';
      const safeLink = sanitizeUrl(proj.link);
      const link = safeLink ? ` \\hfill \\href{${safeLink}}{[Link]}` : '';

      const validBullets = (proj.bulletPoints || [])
        .map((b) => (typeof b === 'string' ? b.trim() : ''))
        .filter(Boolean)
        .map((b) => `    \\item ${escapeLatex(b)}`);

      const bulletsList =
        validBullets.length > 0
          ? `\\begin{itemize}[noitemsep,topsep=0pt,leftmargin=1.2em]
${validBullets.join('\n')}
\\end{itemize}`
          : '';

      const header = `\\textbf{${pName}}${tech}${link}`;
      return bulletsList ? `${header}\n${bulletsList}\n\\vspace{4pt}` : `${header}\n\\vspace{4pt}`;
    })
    .join('\n\n');

  const projectsSection = projectBlocks
    ? `% Projects
\\section{Key Projects}
${projectBlocks}`
    : '';

  // Certifications
  const validCerts = (resume.certifications || []).filter(
    (cert) => cert && ((cert.name && cert.name.trim()) || (cert.issuer && cert.issuer.trim()))
  );

  const certItems = validCerts.map((cert) => {
    const cName = escapeLatex(cert.name || '');
    const issuer = escapeLatex(cert.issuer || '');
    const date = escapeLatex(cert.date || '');
    const safeUrl = sanitizeUrl(cert.link);
    const linkStr = safeUrl ? ` \\href{${safeUrl}}{[Verify]}` : '';
    return `  \\item \\textbf{${cName}}${issuer ? ` -- ${issuer}` : ''} ${date ? `(${date})` : ''}${linkStr}`;
  });

  const certsSection =
    certItems.length > 0
      ? `% Certifications
\\section{Certifications}
\\begin{itemize}[noitemsep,topsep=0pt,leftmargin=1.2em]
${certItems.join('\n')}
\\end{itemize}`
      : '';

  // Achievements
  const validAchievements = (resume.achievements || [])
    .map((a) => (typeof a === 'string' ? a.trim() : ''))
    .filter(Boolean);

  const achievementsSection =
    validAchievements.length > 0
      ? `% Achievements
\\section{Achievements}
\\begin{itemize}[noitemsep,topsep=0pt,leftmargin=1.2em]
${validAchievements.map((a) => `  \\item ${escapeLatex(a)}`).join('\n')}
\\end{itemize}`
      : '';

  // Publications (if present in custom resume data)
  const anyResume = resume as any;
  const validPublications = (anyResume.publications || [])
    .map((p: any) => (typeof p === 'string' ? p.trim() : typeof p?.title === 'string' ? p.title.trim() : ''))
    .filter(Boolean);

  const publicationsSection =
    validPublications.length > 0
      ? `% Publications
\\section{Publications}
\\begin{itemize}[noitemsep,topsep=0pt,leftmargin=1.2em]
${validPublications.map((p: string) => `  \\item ${escapeLatex(p)}`).join('\n')}
\\end{itemize}`
      : '';

  // Template-specific styling configurations
  let margin = '0.7in';
  let primaryColorDef = '\\definecolor{primary}{RGB}{30, 58, 138}'; // Navy
  let urlColor = 'blue!70!black';
  let fontPackage = '';
  let sectionRule = '\\titlerule';

  if (activeTemplate === 'ats_minimal') {
    margin = '0.75in';
    primaryColorDef = '\\definecolor{primary}{RGB}{15, 23, 42}'; // Monochrome Slate
    urlColor = 'primary';
    sectionRule = '\\titlerule';
  } else if (activeTemplate === 'ai_engineer') {
    margin = '0.65in';
    primaryColorDef = '\\definecolor{primary}{RGB}{13, 148, 136}'; // Modern Teal
    urlColor = 'primary';
    sectionRule = '{\\color{primary}\\titlerule}';
  } else if (activeTemplate === 'fresher') {
    margin = '0.7in';
    primaryColorDef = '\\definecolor{primary}{RGB}{67, 56, 202}'; // Indigo
    urlColor = 'primary';
    sectionRule = '{\\color{primary}\\titlerule}';
  } else if (activeTemplate === 'corporate') {
    margin = '0.75in';
    primaryColorDef = '\\definecolor{primary}{RGB}{30, 41, 59}'; // Slate
    urlColor = 'primary';
    fontPackage = '\\usepackage{mathptmx}'; // Standard Times-like Serif font
    sectionRule = '\\titlerule';
  } else {
    // modern
    margin = '0.7in';
    primaryColorDef = '\\definecolor{primary}{RGB}{29, 78, 216}'; // Classic Royal Blue
    urlColor = 'primary';
    sectionRule = '{\\color{primary}\\titlerule}';
  }

  // Section Ordering:
  // For 'fresher', order Education & Projects before Experience
  const bodySections: string[] = [];

  if (summary) {
    bodySections.push(`% Professional Summary
\\section{Professional Summary}
${summary}`);
  }

  if (activeTemplate === 'fresher') {
    if (skillsSection) bodySections.push(skillsSection);
    if (educationSection) bodySections.push(educationSection);
    if (projectsSection) bodySections.push(projectsSection);
    if (experienceSection) bodySections.push(experienceSection);
  } else {
    if (skillsSection) bodySections.push(skillsSection);
    if (experienceSection) bodySections.push(experienceSection);
    if (projectsSection) bodySections.push(projectsSection);
    if (educationSection) bodySections.push(educationSection);
  }

  if (certsSection) bodySections.push(certsSection);
  if (achievementsSection) bodySections.push(achievementsSection);
  if (publicationsSection) bodySections.push(publicationsSection);

  const documentBody = bodySections.join('\n\n');

  return `% =========================================================
% AI Career Agent - Resume Source
% Template: ${activeTemplate.toUpperCase()}
% Generated dynamically without fabricated information
% =========================================================

\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[margin=${margin}]{geometry}
\\usepackage{hyperref}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage{xcolor}
${fontPackage}

${primaryColorDef}

\\hypersetup{
    colorlinks=true,
    linkcolor=primary,
    filecolor=primary,
    urlcolor=${urlColor},
}

\\titleformat{\\section}{\\large\\bfseries\\scshape\\raggedright}{}{0em}{}[${sectionRule}]
\\titlespacing*{\\section}{0pt}{10pt}{6pt}
\\pagestyle{empty}

\\begin{document}

% Header
\\begin{center}
    {\\LARGE \\textbf{${name}}}\\\\
    ${targetRole ? `\\vspace{2pt}{\\large \\textit{${targetRole}}}\\\\` : ''}
    ${contactLine ? `\\vspace{4pt}{\\small ${contactLine}}` : ''}
\\end{center}

\\vspace{4pt}

${documentBody}

\\end{document}
`;
}
