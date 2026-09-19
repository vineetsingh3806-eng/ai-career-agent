import { callGemini } from '../gemini';
import type { ResumeData } from '../../src/types';

export interface ResumeReviewResult {
  passed: boolean;
  score: number; // 0-100
  checks: {
    missingInfo: { status: 'pass' | 'warning' | 'fail'; message: string };
    grammarAndClarity: { status: 'pass' | 'warning' | 'fail'; message: string };
    atsCompatibility: { status: 'pass' | 'warning' | 'fail'; message: string };
    unsupportedClaims: { status: 'pass' | 'warning' | 'fail'; message: string };
    conciseness: { status: 'pass' | 'warning' | 'fail'; message: string };
  };
  critiques: string[];
  suggestedFixes: string[];
  improvedResume?: ResumeData;
}

export async function reviewResume(
  resume: ResumeData,
  useHighThinking = true
): Promise<ResumeReviewResult> {
  const systemInstruction = `You are a Strict Resume Quality & ATS Compliance Auditor.
Your job is to audit this resume for:
1. Missing information (e.g. lack of contact methods, missing graduation dates)
2. Grammar and clarity flaws
3. ATS readability (standard headers, clean hierarchy)
4. Unsupported claims or empty buzzwords (e.g. "world-class visionary")
5. Excessive verbosity / fluff

CRITICAL RULE:
- NEVER invent new achievements or metrics. If you improve a bullet point, tighten the phrasing and structure without adding fabricated claims.

Return a JSON matching:
{
  "passed": true,
  "score": 88,
  "checks": {
    "missingInfo": { "status": "pass", "message": "All essential sections present" },
    "grammarAndClarity": { "status": "pass", "message": "Active verbs used consistently" },
    "atsCompatibility": { "status": "pass", "message": "Compatible naming conventions" },
    "unsupportedClaims": { "status": "warning", "message": "Avoid vague claims without supporting tech" },
    "conciseness": { "status": "pass", "message": "Length is optimal" }
  },
  "critiques": ["...", "..."],
  "suggestedFixes": ["...", "..."]
}`;

  const responseText = await callGemini(JSON.stringify(resume), {
    systemInstruction,
    responseMimeType: 'application/json',
    useHighThinking,
  });

  const result: ResumeReviewResult = JSON.parse(responseText);
  return result;
}
