import { callGemini } from '../gemini';
import type { IntentType, Conversation } from '../../src/types';

export interface IntentDecision {
  intents: IntentType[];
  reasoning: string;
  selectedJobIndex?: number;
  extractedJobText?: string;
  searchParams?: {
    role?: string;
    location?: string;
    keywords?: string[];
    remote?: boolean;
    mode?: 'personalized' | 'explore';
  };
}

export async function routeIntent(
  userMessage: string,
  conversation: Conversation,
  hasNewAttachment: boolean
): Promise<IntentDecision> {
  const recentMessages = conversation.messages.slice(-6).map((m) => ({
    role: m.role,
    content: m.content.slice(0, 300),
  }));

  const hasResume = Boolean(conversation.activeResumeData || conversation.resumeText);
  const hasJobs = Boolean(
    conversation.cachedJobResults && conversation.cachedJobResults.length > 0
  );

  const systemInstruction = `You are the Intent Router for AI Career Agent.
Your job is to determine the user's intent(s) based on:
1. Current user message (can be English, Hindi, Hinglish, etc.)
2. Conversation history
3. Presence of an active resume in context (${hasResume ? 'YES' : 'NO'})
4. Presence of previously displayed jobs (${hasJobs ? 'YES' : 'NO'})
5. Whether a new attachment was just uploaded (${hasNewAttachment ? 'YES' : 'NO'})

Allowed intents:
- 'general_chat': Normal greetings, casual questions, career guidance (e.g. "Mujhe AI Engineer banne ke liye kya seekhna chahiye?"), or acknowledging uploaded files.
  IMPORTANT RULE: If the user merely uploads a resume or says phrases like "Ye mera resume hai", "Here is my resume", "Resume attached" without explicitly asking to analyze it, route to 'general_chat' so the assistant acknowledges receipt and asks what they want to do next.
- 'resume_analysis': Explicit requests to analyze, evaluate, score, or find weaknesses in their resume (e.g., "Mera resume AI Engineer ke liye kaisa hai?", "Isko analyze karo", "Analyze my resume", "Evaluate my CV", "Score my resume").
- 'resume_builder': Requests to create, write, draft, or build a resume from scratch.
- 'resume_improvement': Requests to rewrite, strengthen, polish, or enhance specific sections or bullet points.
- 'career_matching': Career advice, career pathways, skills to learn, guidance (e.g. "Mujhe AI Engineer banne ke liye kya seekhna chahiye?", "Main kin domains me ja sakta hoon?", "What careers fit me?").
- 'job_search': Requests to find, search, or show jobs/openings (e.g. "Mere profile ke according Noida me AI Engineer jobs dhundo", "Find AI Engineer jobs in Noida", "Ab mere resume ke according jobs dhundho").
- 'job_match': Requests to evaluate the match breakdown for a specific job (e.g. "Second wali job ka match batao", "Tell me the match for the second job", "How well do I match job 1?").
- 'job_optimization': Requests to tailor or optimize the resume for a specific job (e.g. "Is job ke liye mera resume optimize karo", "Uske liye resume optimize karo", "Optimize my resume for the second job").
- 'cover_letter': Requests to write or generate a cover letter for a job (e.g. "Cover letter bhi bana do", "Generate a cover letter for this job", "Write cover letter").
- 'interview_prep': Requests to prepare for an interview (e.g. "Kal mera interview hai, prepare karao", "Prepare for interview", "Give me interview questions for this position").
- 'resume_review': Requests to conduct a final pre-submission audit, ATS compliance check, or grammar/claim audit.

Special Parameters Extraction:
- If user references a job by ordinal or number (e.g. "second wali job", "the second one", "the 2nd job", "job 1", "first job", "pehla", "dusra", "teesra"), extract selectedJobIndex as a 0-indexed number (e.g. "second" / "dusra" -> 1, "first" / "pehla" -> 0, "third" / "teesra" -> 2).
- For 'job_search', extract searchParams:
  - role: target title (e.g. "AI Engineer", "Software Engineer", "Backend Developer", or empty if broad exploration)
  - location: target city/country/worldwide from user message.
    CRITICAL RULES FOR LOCATION:
    - If user does NOT explicitly provide a location (e.g. "Find me backend developer jobs", "Search jobs", "Find jobs for my profile"): default location to "India".
    - If user explicitly provides a specific location (e.g. "Noida", "Bangalore", "Delhi", "Pune", "Mumbai", "Hyderabad", "Chennai", "Gurgaon", "Uttar Pradesh", "London", "Toronto", "Germany"): extract that exact specific location.
    - If user asks for worldwide / international / global / abroad (e.g. "Explore Worldwide", "global jobs"): extract "Worldwide".
    - If user asks for India / all India: extract "India".
    - NEVER use candidate resume's personal address or home city as the job search location!
  - keywords: key skills mentioned
  - remote: boolean if remote preference stated
  - mode: "explore" if asking for broad/global exploration (e.g. "explore worldwide", "all India jobs", "browse openings"), or "personalized" if asking based on their resume (e.g. "mere resume ke according", "jobs matching my CV", "jobs for my profile")

Return ONLY valid JSON matching this schema:
{
  "intents": ["general_chat" | "resume_analysis" | "resume_builder" | "resume_improvement" | "career_matching" | "job_search" | "job_match" | "job_optimization" | "cover_letter" | "interview_prep" | "resume_review"],
  "reasoning": "brief explanation",
  "selectedJobIndex": 0, // optional 0-indexed number
  "extractedJobText": "any job description provided", // optional
  "searchParams": {
    "role": "e.g. AI Engineer",
    "location": "e.g. India",
    "keywords": ["python", "genai"],
    "remote": false,
    "mode": "explore" | "personalized"
  }
}`;

  const prompt = JSON.stringify({
    currentMessage: userMessage,
    recentHistory: recentMessages,
    hasResumeInContext: hasResume,
    hasActiveJobListings: hasJobs,
    hasNewAttachment,
  });

  try {
    const rawResponse = await callGemini(prompt, {
      systemInstruction,
      responseMimeType: 'application/json',
    });

    const parsed = JSON.parse(rawResponse);
    const intents = Array.isArray(parsed.intents) && parsed.intents.length > 0
      ? parsed.intents.filter((i: any) =>
          [
            'general_chat',
            'resume_analysis',
            'resume_builder',
            'resume_improvement',
            'career_matching',
            'job_search',
            'job_match',
            'job_optimization',
            'cover_letter',
            'interview_prep',
            'resume_review',
          ].includes(i)
        )
      : ['general_chat'];

    return {
      intents: intents.length > 0 ? intents : ['general_chat'],
      reasoning: parsed.reasoning || '',
      selectedJobIndex:
        typeof parsed.selectedJobIndex === 'number' ? parsed.selectedJobIndex : undefined,
      extractedJobText: parsed.extractedJobText,
      searchParams: parsed.searchParams,
    };
  } catch (err) {
    console.warn('[IntentRouter] Gemini intent routing failed, falling back safely:', err);
    // Safe heuristic fallback if API is unreachable
    const lower = userMessage.toLowerCase();
    const intents: IntentType[] = [];
    let selectedJobIndex: number | undefined;
    const searchParams: any = {};

    // Ordinal matching for job selection ("second wali job", "2nd job", "job 1", "first")
    if (lower.includes('first') || lower.includes('1st') || lower.includes('job 1') || lower.includes('pehla') || lower.includes('pehli')) {
      selectedJobIndex = 0;
    } else if (lower.includes('second') || lower.includes('2nd') || lower.includes('job 2') || lower.includes('dusra') || lower.includes('dusri') || lower.includes('second wali')) {
      selectedJobIndex = 1;
    } else if (lower.includes('third') || lower.includes('3rd') || lower.includes('job 3') || lower.includes('teesra') || lower.includes('teesri')) {
      selectedJobIndex = 2;
    }

    // Role extraction in fallback
    if (lower.includes('ai engineer') || lower.includes('machine learning')) {
      searchParams.role = 'AI Engineer';
    } else if (lower.includes('data scientist') || lower.includes('data science')) {
      searchParams.role = 'Data Scientist';
    } else if (lower.includes('backend')) {
      searchParams.role = 'Backend Developer';
    } else if (lower.includes('frontend') || lower.includes('react')) {
      searchParams.role = 'React Developer';
    } else if (lower.includes('full stack') || lower.includes('fullstack')) {
      searchParams.role = 'Full Stack Developer';
    } else if (lower.includes('software engineer') || lower.includes('developer')) {
      searchParams.role = 'Software Developer';
    }

    // Location extraction in fallback
    if (lower.includes('all india') || lower.includes('in india') || lower.includes('india jobs') || lower.includes('bharat')) {
      searchParams.location = 'India';
    } else if (lower.includes('worldwide') || lower.includes('global') || lower.includes('outside india') || lower.includes('international') || lower.includes('abroad')) {
      searchParams.location = 'Worldwide';
    } else if (lower.includes('noida')) {
      searchParams.location = 'Noida';
    } else if (lower.includes('delhi')) {
      searchParams.location = 'Delhi';
    } else if (lower.includes('bangalore') || lower.includes('bengaluru')) {
      searchParams.location = 'Bangalore';
    } else if (lower.includes('pune')) {
      searchParams.location = 'Pune';
    } else if (lower.includes('mumbai')) {
      searchParams.location = 'Mumbai';
    } else if (lower.includes('hyderabad')) {
      searchParams.location = 'Hyderabad';
    } else if (lower.includes('chennai')) {
      searchParams.location = 'Chennai';
    } else if (lower.includes('gurgaon') || lower.includes('gurugram')) {
      searchParams.location = 'Gurgaon';
    } else if (lower.includes('kolkata')) {
      searchParams.location = 'Kolkata';
    } else if (lower.includes('uttar pradesh')) {
      searchParams.location = 'Uttar Pradesh';
    } else if (lower.includes('london')) {
      searchParams.location = 'London';
    } else if (lower.includes('toronto')) {
      searchParams.location = 'Toronto';
    } else if (lower.includes('berlin')) {
      searchParams.location = 'Berlin';
    } else if (lower.includes('germany')) {
      searchParams.location = 'Germany';
    } else if (lower.includes('remote') || lower.includes('wfh')) {
      searchParams.remote = true;
      searchParams.location = 'Remote';
    } else {
      // DEFAULT JOB LOCATION MUST BE INDIA
      searchParams.location = 'India';
    }

    if (lower.includes('explore') || lower.includes('all jobs') || lower.includes('browse') || lower.includes('worldwide') || lower.includes('global') || lower.includes('all india')) {
      searchParams.mode = 'explore';
    } else if (lower.includes('resume ke according') || lower.includes('for my resume') || lower.includes('match my profile') || lower.includes('for me')) {
      searchParams.mode = 'personalized';
    }

    const isResumeHandshake =
      hasNewAttachment &&
      (lower.includes('ye mera resume') ||
        lower.includes('here is my resume') ||
        lower.includes('attached my resume') ||
        lower.includes('this is my resume') ||
        lower.trim() === 'resume' ||
        lower.trim() === '');

    if (isResumeHandshake) {
      intents.push('general_chat');
    } else if (lower.includes('cover letter') || lower.includes('coverletter')) {
      intents.push('cover_letter');
    } else if (lower.includes('interview') || lower.includes('prepare karao') || lower.includes('interview prep')) {
      intents.push('interview_prep');
    } else if (lower.includes('match batao') || lower.includes('match score') || (lower.includes('match') && selectedJobIndex !== undefined)) {
      intents.push('job_match');
    } else if (
      lower.includes('optimize') ||
      lower.includes('tailor') ||
      (hasJobs && selectedJobIndex !== undefined && (lower.includes('optimize') || lower.includes('uske liye') || lower.includes('is job'))) ||
      (lower.includes('for this job') && hasResume)
    ) {
      intents.push('job_optimization');
    } else if (
      lower.includes('find job') ||
      lower.includes('search job') ||
      lower.includes('jobs dhundho') ||
      lower.includes('jobs dhundo') ||
      lower.includes('openings') ||
      lower.includes('vacanc') ||
      (lower.includes('job') && (lower.includes('find') || lower.includes('search') || lower.includes('according')))
    ) {
      intents.push('job_search');
    } else if (
      lower.includes('domain') ||
      lower.includes('suitable') ||
      lower.includes('career fit') ||
      lower.includes('career path') ||
      lower.includes('ja sakta') ||
      lower.includes('kya seekhna') ||
      lower.includes('which career')
    ) {
      intents.push('career_matching');
    } else if (
      lower.includes('analyze') ||
      lower.includes('score') ||
      lower.includes('evaluate') ||
      lower.includes('kaisa hai') ||
      lower.includes('review my resume') ||
      lower.includes('isko analyze')
    ) {
      intents.push('resume_analysis');
    } else {
      intents.push('general_chat');
    }

    return {
      intents,
      reasoning: 'Fallback heuristic routing',
      selectedJobIndex,
      searchParams: Object.keys(searchParams).length > 0 ? searchParams : undefined,
    };
  }
}
