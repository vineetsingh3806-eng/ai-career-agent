import { jsPDF } from 'jspdf';
import type { ResumeData, TemplateId } from '../types';
import { fetchAuthenticatedPdfBlob } from './api';

export function exportResumePdf(resume: ResumeData, template: TemplateId = 'modern'): void {
  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  // Color Palette per Template
  const colors = {
    ats_minimal: { primary: [30, 30, 30], secondary: [80, 80, 80], line: [200, 200, 200] },
    modern: { primary: [37, 99, 235], secondary: [71, 85, 105], line: [226, 232, 240] },
    ai_engineer: { primary: [14, 116, 144], secondary: [51, 65, 85], line: [203, 213, 225] },
    fresher: { primary: [16, 149, 193], secondary: [75, 85, 99], line: [229, 231, 235] },
    corporate: { primary: [30, 58, 138], secondary: [71, 85, 105], line: [203, 213, 225] },
  }[template] || { primary: [37, 99, 235], secondary: [71, 85, 105], line: [226, 232, 240] };

  function checkPageBreak(requiredHeight: number) {
    if (cursorY + requiredHeight > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
    }
  }

  // 1. Candidate Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.text(resume.name || 'Candidate Name', margin, cursorY);
  cursorY += 24;

  if (resume.targetRole) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.text(resume.targetRole, margin, cursorY);
    cursorY += 16;
  }

  // Contact line
  const contactParts = [
    resume.email,
    resume.phone,
    resume.location,
    resume.linkedin ? 'LinkedIn' : '',
    resume.github ? 'GitHub' : '',
    resume.portfolio ? 'Portfolio' : '',
  ].filter(Boolean);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(contactParts.join('  •  '), margin, cursorY);
  cursorY += 14;

  // Header Divider
  doc.setDrawColor(colors.line[0], colors.line[1], colors.line[2]);
  doc.setLineWidth(1);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 16;

  function renderSectionHeader(title: string) {
    checkPageBreak(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.text(title.toUpperCase(), margin, cursorY);
    cursorY += 6;
    doc.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.setLineWidth(1);
    doc.line(margin, cursorY, margin + 40, cursorY);
    cursorY += 12;
  }

  // Summary
  if (resume.summary) {
    renderSectionHeader('Professional Summary');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    const splitSummary = doc.splitTextToSize(resume.summary, contentWidth);
    checkPageBreak(splitSummary.length * 13 + 10);
    doc.text(splitSummary, margin, cursorY);
    cursorY += splitSummary.length * 13 + 12;
  }

  // Skills
  const technicalSkills = (resume.skills?.technical || []).join(', ');
  const frameworks = (resume.skills?.frameworks || []).join(', ');
  const tools = (resume.skills?.tools || []).join(', ');
  const soft = (resume.skills?.soft || []).join(', ');

  if (technicalSkills || frameworks || tools || soft) {
    renderSectionHeader('Technical Competencies');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);

    const printSkillRow = (label: string, value: string) => {
      if (!value) return;
      doc.setFont('helvetica', 'bold');
      doc.text(`${label}: `, margin, cursorY);
      const labelW = doc.getTextWidth(`${label}: `);
      doc.setFont('helvetica', 'normal');
      const valLines = doc.splitTextToSize(value, contentWidth - labelW);
      doc.text(valLines, margin + labelW, cursorY);
      cursorY += valLines.length * 12 + 4;
    };

    if (technicalSkills) printSkillRow('Languages & Core', technicalSkills);
    if (frameworks) printSkillRow('Frameworks & Libs', frameworks);
    if (tools) printSkillRow('Tools & Cloud', tools);
    if (soft) printSkillRow('Key Competencies', soft);
    cursorY += 8;
  }

  // Experience
  if (resume.experience && resume.experience.length > 0) {
    renderSectionHeader('Experience');
    resume.experience.forEach((exp) => {
      checkPageBreak(40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text(exp.role, margin, cursorY);

      const dateStr = `${exp.startDate || ''} – ${exp.current ? 'Present' : exp.endDate || ''}`;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      const dateW = doc.getTextWidth(dateStr);
      doc.text(dateStr, pageWidth - margin - dateW, cursorY);
      cursorY += 13;

      doc.setFont('helvetica', 'italic');
      doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
      doc.text(`${exp.company}${exp.location ? ` | ${exp.location}` : ''}`, margin, cursorY);
      cursorY += 13;

      (exp.bulletPoints || []).forEach((bp) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        const bulletLines = doc.splitTextToSize(bp, contentWidth - 14);
        checkPageBreak(bulletLines.length * 12 + 4);
        doc.text('•', margin + 2, cursorY);
        doc.text(bulletLines, margin + 14, cursorY);
        cursorY += bulletLines.length * 12 + 3;
      });
      cursorY += 8;
    });
  }

  // Projects
  if (resume.projects && resume.projects.length > 0) {
    renderSectionHeader('Projects');
    resume.projects.forEach((proj) => {
      checkPageBreak(35);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text(proj.name, margin, cursorY);

      if (proj.technologies && proj.technologies.length > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        const techStr = `[${proj.technologies.join(', ')}]`;
        doc.text(techStr, margin + doc.getTextWidth(proj.name) + 8, cursorY);
      }
      cursorY += 13;

      (proj.bulletPoints || []).forEach((bp) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        const bulletLines = doc.splitTextToSize(bp, contentWidth - 14);
        checkPageBreak(bulletLines.length * 12 + 4);
        doc.text('•', margin + 2, cursorY);
        doc.text(bulletLines, margin + 14, cursorY);
        cursorY += bulletLines.length * 12 + 3;
      });
      cursorY += 6;
    });
  }

  // Education
  if (resume.education && resume.education.length > 0) {
    renderSectionHeader('Education');
    resume.education.forEach((edu) => {
      checkPageBreak(30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text(edu.institution, margin, cursorY);

      const dateStr = `${edu.startDate || ''} – ${edu.endDate || ''}`;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      const dateW = doc.getTextWidth(dateStr);
      doc.text(dateStr, pageWidth - margin - dateW, cursorY);
      cursorY += 13;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const degField = `${edu.degree}${edu.fieldOfStudy ? `, ${edu.fieldOfStudy}` : ''}${
        edu.grade ? ` (GPA: ${edu.grade})` : ''
      }`;
      doc.text(degField, margin, cursorY);
      cursorY += 14;
    });
  }

  // Certifications
  if (resume.certifications && resume.certifications.length > 0) {
    renderSectionHeader('Certifications');
    resume.certifications.forEach((cert) => {
      checkPageBreak(16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text(`•  ${cert.name}`, margin, cursorY);
      const nameW = doc.getTextWidth(`•  ${cert.name}`);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(` – ${cert.issuer} ${cert.date ? `(${cert.date})` : ''}`, margin + nameW, cursorY);
      cursorY += 13;
    });
  }

  const filename = `${(resume.name || 'Resume').replace(/\s+/g, '_')}_${template}.pdf`;
  doc.save(filename);
}

export function downloadLatexFile(latexCode: string, filename = 'resume.tex'): void {
  const blob = new Blob([latexCode], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadCompiledPdf(
  pdfUrl: string,
  filename = 'resume.pdf',
  existingBlobUrl?: string
): Promise<void> {
  const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

  try {
    // If an authenticated Blob URL already exists in memory (e.g. from preview), use it directly
    if (existingBlobUrl) {
      const a = document.createElement('a');
      a.href = existingBlobUrl;
      a.download = safeFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // Otherwise, perform an authenticated fetch with Clerk session credentials
    const blob = await fetchAuthenticatedPdfBlob(pdfUrl);
    const blobUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = safeFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } catch (err: any) {
    console.error('[PDF Export] Authenticated download error:', err);
    throw err;
  }
}
