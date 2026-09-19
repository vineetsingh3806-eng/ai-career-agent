import { callGemini } from '../gemini';
import type { JobListing, ResumeData, CareerProfile, CoverLetterResult } from '../../src/types';

export async function generateCoverLetter(
  job: JobListing,
  resume?: ResumeData,
  profile?: CareerProfile,
  useHighThinking = true
): Promise<CoverLetterResult> {
  const candidateName = resume?.name || profile?.name || 'Applicant';

  const systemInstruction = `You are a Professional Career Coach and Executive Copywriter.
Your task is to write a highly persuasive, tailored, and professional Cover Letter for the candidate applying to this specific job.

NON-NEGOTIABLE CONSTRAINTS:
1. Base the letter STRICTLY on the actual job description, company name, and job title.
2. Highlight only the candidate's GENUINE experience, skills, and projects found in their resume or career profile.
3. NEVER invent companies, degrees, dates, metrics, or technologies the candidate does not have.
4. If candidate lacks certain specific experience, focus warmly on transferable achievements and rapid learning agility.
5. Tone: Professional, confident, genuine, concise (3-4 paragraphs max).

Return a JSON object matching:
{
  "jobTitle": "${job.title}",
  "company": "${job.company}",
  "candidateName": "${candidateName}",
  "coverLetterText": "Dear Hiring Team at [Company],\\n\\n...",
  "keyHighlights": [
    "Highlight 1 emphasized in letter",
    "Highlight 2 emphasized in letter"
  ],
  "createdAt": "${new Date().toISOString()}"
}`;

  const prompt = {
    job: {
      title: job.title,
      company: job.company,
      location: job.location,
      snippet: job.snippet,
      skills: job.skills,
      remote: job.remote,
    },
    candidate: {
      name: candidateName,
      targetRole: resume?.targetRole || profile?.targetRole,
      summary: resume?.summary || profile?.experienceSummary,
      skills: resume?.skills || profile?.skills,
      experience: resume?.experience,
      projects: resume?.projects,
    },
  };

  try {
    const raw = await callGemini(JSON.stringify(prompt), {
      systemInstruction,
      responseMimeType: 'application/json',
      useHighThinking,
    });
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Gemini cover letter generation failed, generating fallback letter:', err);
    const topSkills = (resume?.skills?.technical || profile?.skills || []).slice(0, 4).join(', ');
    const fallbackText = `Dear Hiring Team at ${job.company},

I am writing to express my strong enthusiasm for the ${job.title} position. With my background in ${topSkills || 'software engineering and modern technology'}, I am eager to contribute to ${job.company}'s continued success.

Throughout my recent work and projects, I have focused on delivering scalable, reliable solutions and translating complex requirements into well-structured implementations. The requirements outlined in your job listing—particularly around ${job.skills?.slice(0, 3).join(', ') || 'technical excellence'}—resonate directly with the practical skills I have honed.

I would welcome the opportunity to discuss how my technical expertise and enthusiasm align with your team's goals. Thank you for your time and consideration.

Sincerely,
${candidateName}`;

    return {
      jobTitle: job.title,
      company: job.company,
      candidateName,
      coverLetterText: fallbackText,
      keyHighlights: [
        `Direct alignment with ${job.company}'s requirements for ${job.title}`,
        `Practical application of ${topSkills || 'core technical competencies'}`,
      ],
      createdAt: new Date().toISOString(),
    };
  }
}
