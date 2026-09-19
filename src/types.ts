export type IntentType =
  | 'general_chat'
  | 'resume_analysis'
  | 'resume_builder'
  | 'resume_improvement'
  | 'career_matching'
  | 'job_search'
  | 'job_match'
  | 'job_optimization'
  | 'cover_letter'
  | 'interview_prep'
  | 'resume_review';

export type TemplateId =
  | 'ats_minimal'
  | 'modern'
  | 'ai_engineer'
  | 'fresher'
  | 'corporate';

export interface Attachment {
  id: string;
  name: string;
  type: string; // mime type
  size: number;
  dataUrl?: string; // base64 representation if image/document (optional/fallback)
  fileId?: string; // ID of file saved in server storage
  fileUrl?: string; // URL to fetch file content (/api/files/:id)
  textSnippet?: string; // extracted text content
  parsedContent?: string;
}

export interface EducationItem {
  id?: string;
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  grade?: string;
  highlights?: string[];
}

export interface ExperienceItem {
  id?: string;
  company: string;
  role: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  bulletPoints: string[];
}

export interface ProjectItem {
  id?: string;
  name: string;
  description?: string;
  technologies?: string[];
  link?: string;
  bulletPoints: string[];
}

export interface CertificationItem {
  id?: string;
  name: string;
  issuer: string;
  date?: string;
  link?: string;
}

export interface ResumeData {
  id?: string;
  title?: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  targetRole?: string;
  summary: string;
  skills: {
    technical: string[];
    frameworks?: string[];
    tools?: string[];
    soft?: string[];
  };
  education: EducationItem[];
  experience: ExperienceItem[];
  projects: ProjectItem[];
  certifications: CertificationItem[];
  achievements?: string[];
  lastUpdated?: string;
  templateId?: TemplateId;
  pdfFileId?: string;
  pdfUrl?: string;
  latexCode?: string;
}

export interface ResumeAnalysis {
  resumeQualityScore: number; // 0 - 100 ("AI Resume Quality Score")
  scoreBreakdown: {
    impact: number;
    brevity: number;
    structure: number;
    skillsRelevance: number;
  };
  summary: string;
  strengths: string[];
  weaknesses: string[];
  missingSections: string[];
  identifiedSkills: string[];
  identifiedEducation: string[];
  identifiedExperience: string[];
  identifiedProjects: string[];
  identifiedCertifications: string[];
  atsSuggestions: string[];
  improvementRecommendations: string[];
  analyzedAt: string;
}

export interface CareerMatch {
  primaryDomain: {
    title: string;
    fitReason: string;
    salaryRange?: string;
    growthOutlook?: string;
  };
  alternativeDomains: Array<{
    title: string;
    fitReason: string;
    transitionEase: string;
  }>;
  currentStrengths: string[];
  skillGaps: string[];
  skillsToLearn: Array<{
    skill: string;
    importance: 'high' | 'medium' | 'low';
    learningResource?: string;
  }>;
  recommendedNextSteps: string[];
}

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  employmentType?: string;
  experienceLevel?: string;
  salary?: string;
  skills: string[];
  matchScore?: number;
  whyMatches?: string[];
  matchingSkills?: string[];
  missingSkills?: string[];
  concerns?: string[];
  jobUrl: string;
  applyUrl: string;
  snippet?: string;
  postedAt?: string;
  provider: string;
}

export interface JobMatchDetail {
  jobId: string;
  jobTitle: string;
  company: string;
  matchScore: number;
  overallScore?: number;
  whyMatches: string[];
  matchingSkills: string[];
  missingSkills: string[];
  missingKeywords?: string[];
  experienceRelevance?: string;
  educationRelevance?: string;
  concerns: string[];
  recommendations: string[];
}

export interface CoverLetterResult {
  jobTitle: string;
  company: string;
  candidateName: string;
  coverLetterText: string;
  keyHighlights: string[];
  createdAt: string;
}

export interface InterviewPrepResult {
  jobTitle: string;
  company?: string;
  roleOverview: string;
  technicalQuestions: Array<{
    question: string;
    context: string;
    recommendedApproach: string;
  }>;
  behavioralQuestions: Array<{
    question: string;
    competency: string;
    starAdvice: string;
  }>;
  resumeSpecificQuestions: Array<{
    question: string;
    basedOn: string;
    tip: string;
  }>;
  preparationTopics: string[];
}

export interface JobOptimizationResult {
  targetJobTitle: string;
  targetCompany?: string;
  matchScore: number;
  matchingSkills: string[];
  missingSkills: string[];
  relevantExperienceHighlights: string[];
  relevantProjectHighlights: string[];
  suggestedImprovements: string[];
  tailoredSummary: string;
  tailoredBulletPoints: Array<{
    original: string;
    improved: string;
    reason: string;
  }>;
  tailoredResume?: ResumeData;
  reviewNotes: string[];
}

export interface MessageMeta {
  intents?: IntentType[];
  analysis?: ResumeAnalysis;
  careerMatch?: CareerMatch;
  jobResults?: {
    jobs: JobListing[];
    providerStatus: string;
    queryUsed?: string;
    isLive: boolean;
    page?: number;
    hasMore?: boolean;
    totalFound?: number;
    providersContributed?: string[];
    mode?: 'personalized' | 'explore';
    activeLocationScope?: string;
  };
  jobOptimization?: JobOptimizationResult;
  jobMatchDetail?: JobMatchDetail;
  jobMatch?: JobMatchDetail;
  coverLetter?: CoverLetterResult;
  interviewPrep?: InterviewPrepResult;
  resumeData?: ResumeData;
  latexCode?: string;
  reviewFeedback?: string[];
  selectedJobId?: string;
  usedThinkingMode?: boolean;
  isUnavailable?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  attachments?: Attachment[];
  meta?: MessageMeta;
}

export interface Conversation {
  id: string;
  userId?: string;
  title: string;
  isCustomTitle?: boolean;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  activeResumeId?: string;
  activeResumeData?: ResumeData;
  resumeText?: string;
  selectedJobId?: string;
  selectedJob?: JobListing;
  cachedAnalysis?: ResumeAnalysis;
  cachedCareerMatch?: CareerMatch;
  cachedJobResults?: JobListing[];
  activeJobLocationScope?: string;
}

export interface CareerProfile {
  userId?: string;
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  education?: string;
  skills?: string[];
  experienceSummary?: string;
  projectsSummary?: string;
  certifications?: string[];
  targetRole?: string;
  targetDomain?: string;
  preferredLocations?: string[];
  remotePreference?: 'remote' | 'hybrid' | 'onsite' | 'any' | boolean;
  experienceLevel?: 'student' | 'entry' | 'mid' | 'senior' | 'lead';
  updatedAt?: string;
}

export type ApplicationStatus = 'saved' | 'applied' | 'interview' | 'interviewing' | 'offer' | 'rejected';

export interface SavedJob {
  id: string;
  userId?: string;
  job: JobListing;
  savedAt: string;
  appliedAt?: string;
  notes?: string;
  status: ApplicationStatus;
}

export interface AppSettings {
  thinkingMode: boolean; // enables ThinkingLevel.HIGH with gemini-3.1-pro-preview
  defaultTemplate: TemplateId;
  preferredJobProvider: string;
  userRolePreference?: string;
}
