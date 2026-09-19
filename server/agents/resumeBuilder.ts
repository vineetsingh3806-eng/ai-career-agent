import { callGemini } from '../gemini';
import type { ResumeData } from '../../src/types';

export async function buildResumeFromChat(
  userMessage: string,
  existingResume?: ResumeData,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<{ resume: ResumeData; message: string; missingFields: string[] }> {
  const systemInstruction = `You are an expert Resume Architect.
Your task is to build or refine a candidate's structured ResumeData based on their provided details.

NON-FABRICATION RULE:
- NEVER invent degrees, dates, schools, employers, achievements, or phone numbers.
- If the candidate has not provided critical fields (e.g. contact email, education details, target role), specify them in "missingFields" and ask politely for them.

Schema (JSON):
{
  "resume": {
    "name": "Candidate Name",
    "email": "email",
    "phone": "phone",
    "location": "location",
    "targetRole": "target role",
    "summary": "Professional summary",
    "skills": {
      "technical": ["..."],
      "frameworks": ["..."],
      "tools": ["..."],
      "soft": ["..."]
    },
    "education": [],
    "experience": [],
    "projects": [],
    "certifications": [],
    "achievements": []
  },
  "message": "Friendly response summarizing what has been captured and what was refined",
  "missingFields": ["e.g. Target Job Title", "Contact Information"]
}`;

  const inputPayload = {
    userMessage,
    currentResume: existingResume || null,
    recentHistory: conversationHistory?.slice(-4) || [],
  };

  const responseText = await callGemini(JSON.stringify(inputPayload), {
    systemInstruction,
    responseMimeType: 'application/json',
  });

  const parsed = JSON.parse(responseText);

  const mergedResume: ResumeData = {
    id: existingResume?.id || 'res_' + Date.now(),
    title: parsed.resume.targetRole ? `${parsed.resume.targetRole} Resume` : 'My Resume',
    name: parsed.resume.name || existingResume?.name || '',
    email: parsed.resume.email || existingResume?.email || '',
    phone: parsed.resume.phone || existingResume?.phone || '',
    location: parsed.resume.location || existingResume?.location || '',
    linkedin: parsed.resume.linkedin || existingResume?.linkedin || '',
    github: parsed.resume.github || existingResume?.github || '',
    portfolio: parsed.resume.portfolio || existingResume?.portfolio || '',
    targetRole: parsed.resume.targetRole || existingResume?.targetRole || '',
    summary: parsed.resume.summary || existingResume?.summary || '',
    skills: parsed.resume.skills || existingResume?.skills || { technical: [] },
    education: parsed.resume.education || existingResume?.education || [],
    experience: parsed.resume.experience || existingResume?.experience || [],
    projects: parsed.resume.projects || existingResume?.projects || [],
    certifications: parsed.resume.certifications || existingResume?.certifications || [],
    achievements: parsed.resume.achievements || existingResume?.achievements || [],
    lastUpdated: new Date().toISOString(),
    templateId: existingResume?.templateId || 'modern',
  };

  return {
    resume: mergedResume,
    message: parsed.message,
    missingFields: parsed.missingFields || [],
  };
}
