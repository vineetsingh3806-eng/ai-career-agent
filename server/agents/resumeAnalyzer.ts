import { callGemini } from '../gemini';
import type { ResumeAnalysis, ResumeData, Attachment } from '../../src/types';

export interface AnalysisResult {
  analysis: ResumeAnalysis;
  extractedResume: ResumeData;
  formattedText: string;
}

export async function analyzeResume(
  resumeText: string,
  attachments: Attachment[] = [],
  useHighThinking = false
): Promise<AnalysisResult> {
  const systemInstruction = `You are a Senior Technical Recruiter and Resume Evaluation Specialist.
You must analyze the candidate's resume objectively.

IMPORTANT MANDATES:
1. NEVER invent, fabricate, or assume any qualification, job title, company, university, metric, or skill not stated in the input.
2. The score must be strictly titled "AI Resume Quality Score" out of 100. DO NOT claim that this is an official ATS score.
3. Extract the candidate's real details into structured ResumeData accurately.
4. Provide actionable, constructive feedback.

Return a JSON object with this exact structure:
{
  "analysis": {
    "resumeQualityScore": 78, // number 0-100
    "scoreBreakdown": {
      "impact": 20, // max 25
      "brevity": 20, // max 25
      "structure": 20, // max 25
      "skillsRelevance": 18 // max 25
    },
    "summary": "High-level assessment summary",
    "strengths": ["...", "..."],
    "weaknesses": ["...", "..."],
    "missingSections": ["...", "..."],
    "identifiedSkills": ["...", "..."],
    "identifiedEducation": ["...", "..."],
    "identifiedExperience": ["...", "..."],
    "identifiedProjects": ["...", "..."],
    "identifiedCertifications": ["...", "..."],
    "atsSuggestions": ["...", "..."],
    "improvementRecommendations": ["...", "..."]
  },
  "extractedResume": {
    "name": "Candidate Name or Unknown",
    "email": "email or empty",
    "phone": "phone or empty",
    "location": "location or empty",
    "targetRole": "target role or derived from experience",
    "summary": "Professional summary or clean synthesis of existing background",
    "skills": {
      "technical": ["..."],
      "frameworks": ["..."],
      "tools": ["..."],
      "soft": ["..."]
    },
    "education": [
      {
        "institution": "...",
        "degree": "...",
        "fieldOfStudy": "...",
        "startDate": "...",
        "endDate": "..."
      }
    ],
    "experience": [
      {
        "company": "...",
        "role": "...",
        "location": "...",
        "startDate": "...",
        "endDate": "...",
        "bulletPoints": ["..."]
      }
    ],
    "projects": [
      {
        "name": "...",
        "technologies": ["..."],
        "bulletPoints": ["..."]
      }
    ],
    "certifications": [
      {
        "name": "...",
        "issuer": "...",
        "date": "..."
      }
    ]
  }
}`;

  // Prepare contents - support multimodal if attachment has image data
  const parts: any[] = [];
  for (const att of attachments) {
    if (att.dataUrl && att.type.startsWith('image/')) {
      const base64Data = att.dataUrl.split(',')[1] || att.dataUrl;
      parts.push({
        inlineData: {
          mimeType: att.type,
          data: base64Data,
        },
      });
    }
  }

  const promptText = `Analyze the following resume thoroughly without inventing any information:\n\n${resumeText || '[See attached document]'}`;
  parts.push({ text: promptText });

  const responseText = await callGemini(parts.length === 1 ? parts[0].text : parts, {
    systemInstruction,
    responseMimeType: 'application/json',
    useHighThinking,
  });

  const parsed = JSON.parse(responseText);

  const analysis: ResumeAnalysis = {
    ...parsed.analysis,
    analyzedAt: new Date().toISOString(),
  };

  const extractedResume: ResumeData = {
    ...parsed.extractedResume,
    lastUpdated: new Date().toISOString(),
  };

  // Build conversational formatted text
  const formattedText = `### AI Resume Quality Score: **${analysis.resumeQualityScore}/100**

${analysis.summary}

#### Strengths
${analysis.strengths.map((s) => `- ${s}`).join('\n')}

#### Areas for Improvement & Weaknesses
${analysis.weaknesses.map((w) => `- ${w}`).join('\n')}

${
  analysis.missingSections.length > 0
    ? `#### Missing or Incomplete Sections\n${analysis.missingSections.map((m) => `- ${m}`).join('\n')}\n`
    : ''
}

#### Identified Skills
${analysis.identifiedSkills.join(', ')}

#### ATS Optimization Recommendations
${analysis.atsSuggestions.map((a) => `- ${a}`).join('\n')}

*Note: The AI Resume Quality Score evaluates formatting, measurable metrics, section completeness, and skill clarity. It is not an official vendor ATS score.*`;

  return {
    analysis,
    extractedResume,
    formattedText,
  };
}
