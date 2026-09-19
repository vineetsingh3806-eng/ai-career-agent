import { callGemini } from '../gemini';
import type { JobListing, ResumeData, CareerProfile, InterviewPrepResult } from '../../src/types';

export async function generateInterviewPrep(
  job?: Partial<JobListing>,
  resume?: ResumeData,
  profile?: CareerProfile,
  useHighThinking = true
): Promise<InterviewPrepResult> {
  const roleName = job?.title || resume?.targetRole || profile?.targetRole || 'Software Professional';
  const companyName = job?.company || undefined;

  const systemInstruction = `You are a Principal Engineering Lead and Interview Bar Raiser.
Create a thorough, role-specific, and company-tailored interview preparation guide for the candidate.

NON-NEGOTIABLE CONSTRAINTS:
1. Ground the questions directly in the candidate's actual projects, experience, and the target job description.
2. DO NOT output generic questions like "Tell me about yourself" without tailoring it to this specific role and candidate story.
3. Categorize into:
   - Technical questions relevant to the job's tech stack and candidate's claimed skills
   - Behavioral questions using the STAR framework tailored to real situations
   - Resume-specific / Project-specific questions probing real bullet points in candidate's profile
   - Core technical preparation topics

Return a JSON object matching:
{
  "jobTitle": "${roleName}",
  "company": "${companyName || ''}",
  "roleOverview": "Succinct overview of what interviewers at ${companyName || 'this company'} will look for in a ${roleName}",
  "technicalQuestions": [
    {
      "question": "Specific deep-dive technical question...",
      "context": "Why interviewers ask this for this specific role/stack",
      "recommendedApproach": "Framework or key concepts candidate should articulate"
    }
  ],
  "behavioralQuestions": [
    {
      "question": "Behavioral question...",
      "competency": "Ownership / Conflict Resolution / Leadership",
      "starAdvice": "How to structure Situation, Task, Action, Result using candidate's genuine background"
    }
  ],
  "resumeSpecificQuestions": [
    {
      "question": "Question digging into a project or bullet from the candidate's resume...",
      "basedOn": "Project X or Experience Y in candidate resume",
      "tip": "How to highlight engineering decisions and metrics"
    }
  ],
  "preparationTopics": [
    "Core topic 1 (e.g. System Design for distributed data)",
    "Core topic 2"
  ]
}`;

  const prompt = {
    targetJob: job
      ? {
          title: job.title,
          company: job.company,
          location: job.location,
          skills: job.skills,
          snippet: job.snippet,
        }
      : undefined,
    candidate: {
      targetRole: roleName,
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
    console.warn('Gemini interview prep generation failed, using structured fallback:', err);
    return {
      jobTitle: roleName,
      company: companyName,
      roleOverview: `Interviewers for ${roleName} ${companyName ? `at ${companyName}` : ''} assess practical problem solving, technical depth, and architectural communication.`,
      technicalQuestions: [
        {
          question: `How would you architect a scalable service considering the technologies specified for ${roleName}?`,
          context: 'Tests systems intuition and ability to select right tradeoffs',
          recommendedApproach: 'Clarify constraints first, outline high-level components, then dive into bottlenecks.',
        },
        {
          question: `Can you walk through a challenging bug or performance optimization you resolved recently?`,
          context: 'Evaluates real-world debugging discipline and mastery of tools',
          recommendedApproach: 'State the symptom, your hypothesis, telemetry/profiler used, and the measurable outcome.',
        },
      ],
      behavioralQuestions: [
        {
          question: 'Tell me about a time you had a technical disagreement with a teammate. How did you reach alignment?',
          competency: 'Collaboration & Egoless Engineering',
          starAdvice: 'Focus on mutual goals, data-driven decisions, and maintaining positive team momentum.',
        },
      ],
      resumeSpecificQuestions: [
        {
          question: 'What was the most technically complex architectural decision in your recent project, and what were the alternatives?',
          basedOn: resume?.projects?.[0]?.name || 'Recent engineering project',
          tip: 'Explain why alternative architectures were discarded in favor of your final choice.',
        },
      ],
      preparationTopics: [
        `${job?.skills?.slice(0, 3).join(', ') || 'Core Stack'} Fundamentals`,
        'System Design & Data Modeling',
        'STAR Behavioral Stories with Quantified Outcomes',
      ],
    };
  }
}
