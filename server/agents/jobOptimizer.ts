import { callGemini } from '../gemini';
import type { JobOptimizationResult, ResumeData, JobListing } from '../../src/types';

export async function optimizeResumeForJob(
  resume: ResumeData,
  job: Partial<JobListing> | string,
  userPrompt?: string,
  useHighThinking = true
): Promise<JobOptimizationResult> {
  const jobDescription = typeof job === 'string' ? job : `${job.title || ''} at ${job.company || ''}\n${job.snippet || ''}\nSkills required: ${(job.skills || []).join(', ')}`;
  const targetJobTitle = typeof job === 'string' ? 'Target Position' : job.title || 'Target Position';
  const targetCompany = typeof job === 'string' ? undefined : job.company;

  const systemInstruction = `You are a Technical Hiring Manager and Executive Resume Strategist.
Your goal is to optimize the candidate's existing resume for the specified job posting.

CRITICAL NON-FABRICATION CONSTRAINTS:
1. NEVER invent any company, degree, metric, or skill the user does not possess.
2. If the job requires a skill the user lacks, place it in "missingSkills" honestly.
3. Tailor the candidate's existing experience and projects by emphasizing relevant aspects, reframing bullet points using strong action verbs (Google XYZ formula: Accomplished [X] as measured by [Y] by doing [Z]), and aligning terminology with the target job posting.
4. Provide a full tailoredResume with updated summary, tailored bullet points, and highlight ordering.

Return a JSON response matching:
{
  "targetJobTitle": "${targetJobTitle}",
  "targetCompany": "${targetCompany || ''}",
  "matchScore": 84, // 0-100 realistic alignment percentage
  "matchingSkills": ["..."],
  "missingSkills": ["..."],
  "relevantExperienceHighlights": ["..."],
  "relevantProjectHighlights": ["..."],
  "suggestedImprovements": ["..."],
  "tailoredSummary": "High-impact summary tailored to this position without false claims",
  "tailoredBulletPoints": [
    {
      "original": "Original bullet point from candidate experience",
      "improved": "Tailored, quantified, high-impact bullet point",
      "reason": "Why this aligns better with the job requirements"
    }
  ],
  "tailoredResume": {
    // Full copy of the resume with updated summary and tailored experience/projects
  },
  "reviewNotes": [
    "Advice on how to address missing requirements during interviews",
    "Key keywords emphasized for ATS screening"
  ]
}`;

  const promptData = {
    jobDescription,
    targetJobTitle,
    targetCompany,
    candidateResume: resume,
    userInstructions: userPrompt || 'Optimize my resume for this specific position',
  };

  const responseText = await callGemini(JSON.stringify(promptData), {
    systemInstruction,
    responseMimeType: 'application/json',
    useHighThinking,
  });

  const result: JobOptimizationResult = JSON.parse(responseText);

  // Ensure tailoredResume keeps original personal info if not returned
  if (result.tailoredResume) {
    result.tailoredResume = {
      ...resume,
      ...result.tailoredResume,
      name: resume.name,
      email: resume.email,
      phone: resume.phone,
      location: resume.location,
      lastUpdated: new Date().toISOString(),
    };
  }

  return result;
}
