import { callGemini } from '../gemini';
import type { CareerMatch, ResumeData, CareerProfile } from '../../src/types';

export interface CareerMatchResult {
  match: CareerMatch;
  formattedText: string;
}

export async function matchCareerDomains(
  resume?: ResumeData,
  profile?: CareerProfile,
  userMessage?: string,
  useHighThinking = true,
  rawResumeText?: string
): Promise<CareerMatchResult> {
  const systemInstruction = `You are an elite Career Strategist and Talent Intelligence Advisor.
Your objective is to evaluate the candidate's real profile and dynamically determine their best career matches.

CRITICAL NON-FABRICATION RULES:
- Never assume skills, qualifications, or experience not present in the user profile/resume.
- DO NOT use hardcoded mappings (e.g. Python -> AI Engineer).
- Ground your analysis in the specific intersections of their education, actual tech stack, demonstrated projects, and career aspirations.

Output schema (JSON only):
{
  "primaryDomain": {
    "title": "Primary Career/Domain (e.g. Full-Stack Distributed Systems Engineer)",
    "fitReason": "Detailed explanation of why their specific background makes them a fit",
    "salaryRange": "Typical industry band (e.g. $110k - $140k)",
    "growthOutlook": "e.g. High demand across Cloud & AI sectors"
  },
  "alternativeDomains": [
    {
      "title": "Alternative Domain (e.g. Developer Platform Engineer)",
      "fitReason": "Why their skills translate well into this adjacent field",
      "transitionEase": "High | Moderate | Challenging"
    }
  ],
  "currentStrengths": ["...", "..."],
  "skillGaps": ["...", "..."],
  "skillsToLearn": [
    {
      "skill": "Specific high-leverage skill or tool",
      "importance": "high" | "medium" | "low",
      "learningResource": "Recommended topic or certification"
    }
  ],
  "recommendedNextSteps": [
    "Concrete actionable steps to target these roles"
  ]
}`;

  const contextData = {
    userMessage: userMessage || 'Analyze my best career domain fits',
    candidateName: resume?.name || profile?.name || 'Candidate',
    education: resume?.education || profile?.education,
    skills: resume?.skills || profile?.skills,
    experience: resume?.experience || profile?.experienceSummary,
    projects: resume?.projects || profile?.projectsSummary,
    certifications: resume?.certifications || profile?.certifications,
    targetRolePreference: resume?.targetRole || profile?.targetRole,
    targetDomainPreference: profile?.targetDomain,
    rawResumeExcerpt: rawResumeText ? rawResumeText.slice(0, 2500) : undefined,
  };

  const responseText = await callGemini(JSON.stringify(contextData), {
    systemInstruction,
    responseMimeType: 'application/json',
    useHighThinking, // Career matching benefits greatly from high reasoning
  });

  const match: CareerMatch = JSON.parse(responseText);

  const formattedText = `### Career & Domain Fit Analysis

#### Primary Domain: **${match.primaryDomain.title}**
${match.primaryDomain.fitReason}
${match.primaryDomain.growthOutlook ? `*Industry Outlook:* ${match.primaryDomain.growthOutlook}` : ''}

#### Alternative Career Pathways
${match.alternativeDomains
  .map((alt) => `- **${alt.title}** (${alt.transitionEase} transition): ${alt.fitReason}`)
  .join('\n')}

#### Your Core Competitive Strengths
${match.currentStrengths.map((s) => `- ${s}`).join('\n')}

#### Skill Gaps & High-Impact Learning
${match.skillsToLearn
  .map(
    (item) =>
      `- **${item.skill}** [${item.importance.toUpperCase()} priority]${
        item.learningResource ? `: focus on ${item.learningResource}` : ''
      }`
  )
  .join('\n')}

#### Recommended Next Actions
${match.recommendedNextSteps.map((step, idx) => `${idx + 1}. ${step}`).join('\n')}
`;

  return {
    match,
    formattedText,
  };
}
