import { callGemini } from '../gemini';
import type { JobListing, ResumeData, JobMatchDetail } from '../../src/types';

export async function analyzeJobMatch(
  job: JobListing,
  resume?: ResumeData,
  useHighThinking = true
): Promise<JobMatchDetail> {
  if (!resume) {
    return {
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      matchScore: 70,
      whyMatches: ['Job aligns with general domain'],
      matchingSkills: job.skills.slice(0, 3),
      missingSkills: [],
      concerns: ['Upload or create a resume to get a tailored score and skill comparison'],
      recommendations: ['Add your resume to evaluate exact match and tailor your application'],
    };
  }

  const systemInstruction = `You are a Technical Hiring Specialist and Career Advisor.
Compare the candidate's actual resume against the target job posting.

CRITICAL NON-FABRICATION CONSTRAINTS:
1. NEVER invent any skills, degrees, or experience the candidate does not possess.
2. Accurately identify matching skills between the job requirements and candidate profile.
3. Identify missing skills or requirements the candidate lacks.
4. Note potential concerns (e.g., years of experience gap, missing specific tech stack).
5. Provide actionable recommendations on how the candidate can bridge gaps or position themselves.

Return a JSON object matching:
{
  "jobId": "${job.id}",
  "jobTitle": "${job.title}",
  "company": "${job.company}",
  "matchScore": 82, // realistic 0-100 percentage based on genuine overlap
  "whyMatches": [
    "Specific reason 1 supported by candidate's genuine background",
    "Specific reason 2"
  ],
  "matchingSkills": ["Skill A", "Skill B"],
  "missingSkills": ["Requirement C", "Requirement D"],
  "concerns": ["Years of experience requirement", "Specific framework not in resume"],
  "recommendations": [
    "Focus on project X during interviews to demonstrate transferable proficiency",
    "Emphasize experience with related tool Y"
  ]
}`;

  const prompt = {
    job: {
      title: job.title,
      company: job.company,
      location: job.location,
      snippet: job.snippet,
      skills: job.skills,
      remote: job.remote,
      salary: job.salary,
    },
    candidateResume: {
      title: resume.title,
      targetRole: resume.targetRole,
      summary: resume.summary,
      skills: resume.skills,
      experience: resume.experience?.map((e) => ({
        role: e.role,
        company: e.company,
        bulletPoints: e.bulletPoints,
      })),
      projects: resume.projects?.map((p) => ({
        name: p.name,
        technologies: p.technologies,
        description: p.description,
      })),
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
    console.warn('Gemini job match failed, fallback to heuristic matching:', err);
    // Heuristic fallback
    const userSkills = new Set<string>();
    (resume.skills?.technical || []).forEach((s) => userSkills.add(s.toLowerCase()));
    (resume.skills?.frameworks || []).forEach((s) => userSkills.add(s.toLowerCase()));
    (resume.skills?.tools || []).forEach((s) => userSkills.add(s.toLowerCase()));

    const matching: string[] = [];
    const missing: string[] = [];
    (job.skills || []).forEach((js) => {
      if (userSkills.has(js.toLowerCase())) {
        matching.push(js);
      } else {
        missing.push(js);
      }
    });

    const score = Math.min(95, Math.max(50, 60 + matching.length * 8 - missing.length * 4));

    return {
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      matchScore: score,
      whyMatches: [
        `Directly aligns with ${matching.slice(0, 3).join(', ') || 'software development'} experience`,
        resume.targetRole ? `Aligned with target role: ${resume.targetRole}` : 'Relevant career domain',
      ],
      matchingSkills: matching,
      missingSkills: missing,
      concerns: missing.length > 0 ? [`Job lists requirements for ${missing.slice(0, 3).join(', ')}`] : [],
      recommendations: [
        'Tailor your resume bullet points to highlight project applications of matching skills',
        'Address secondary requirements through enthusiasm and self-learning examples',
      ],
    };
  }
}
