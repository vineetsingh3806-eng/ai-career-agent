import type {
  Conversation,
  ChatMessage,
  Attachment,
  ResumeData,
  CareerProfile,
  SavedJob,
  AppSettings,
  TemplateId,
  JobListing,
  ApplicationStatus,
} from '../types';

export interface GuestStatus {
  isGuest: boolean;
  usageCount: number;
  limit: number;
  remaining: number;
  limitReached: boolean;
}

export function getGuestId(): string {
  try {
    let id = localStorage.getItem('career_agent_guest_id');
    if (!id) {
      id = 'gst_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('career_agent_guest_id', id);
    }
    return id;
  } catch {
    return 'gst_default';
  }
}

type TokenGetter = () => Promise<string | null>;
let currentTokenGetter: TokenGetter | null = null;

export function setAuthTokenGetter(getter: TokenGetter | null) {
  currentTokenGetter = getter;
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'x-guest-id': getGuestId(),
  };

  let token: string | null = null;

  // 1. Primary: Use registered token getter from AuthContext
  if (currentTokenGetter) {
    try {
      token = await currentTokenGetter();
    } catch {
      token = null;
    }
  }

  // 2. Secondary: Fallback to global window.Clerk instance if getter was not ready
  if ((!token || typeof token !== 'string' || !token.trim()) && typeof window !== 'undefined') {
    try {
      const clerk = (window as any).Clerk;
      if (clerk) {
        if (clerk.session) {
          token = await clerk.session.getToken();
        } else if (!clerk.loaded && typeof clerk.load === 'function') {
          // Await brief session initialization if Clerk is still bootstrapping
          await Promise.race([
            clerk.load(),
            new Promise((resolve) => setTimeout(resolve, 1500)),
          ]);
          if (clerk.session) {
            token = await clerk.session.getToken();
          }
        }
      }
    } catch {
      // Ignore fallback error
    }
  }

  // Strictly attach Authorization header only when token is a non-empty, non-literal string
  if (
    token &&
    typeof token === 'string' &&
    token.trim() &&
    token !== 'undefined' &&
    token !== 'null' &&
    token !== '[object Object]'
  ) {
    headers['Authorization'] = `Bearer ${token.trim()}`;
  }

  return headers;
}

export interface PublicAppConfig {
  clerkPublishableKey: string;
}

export async function getPublicAppConfig(): Promise<PublicAppConfig> {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error('Failed to fetch app configuration');
    return await res.json();
  } catch (err) {
    console.warn('[API] Could not load public app config:', err);
    return {
      clerkPublishableKey: '',
    };
  }
}

export async function getGuestStatus(): Promise<GuestStatus> {
  const res = await fetch('/api/guest/status', {
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to get guest status');
  return res.json();
}

export async function sendChatMessage(params: {
  conversationId?: string;
  message: string;
  attachments?: Attachment[];
  useHighThinking?: boolean;
}): Promise<{ message: ChatMessage; conversation: Conversation; guestStatus?: GuestStatus }> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    if (errorData.error === 'GUEST_LIMIT_REACHED' || errorData.limitReached) {
      const err = new Error(errorData.message || "You've used your 3 free guest uses for today.");
      (err as any).isGuestLimit = true;
      (err as any).limitReached = true;
      throw err;
    }
    throw new Error(errorData.error || `Server returned ${res.status}`);
  }
  return res.json();
}

export async function uploadFile(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const authHeaders = await getAuthHeaders();
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type || 'text/plain',
            base64Data: base64,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Upload failed');
        }
        const attachment = await res.json();
        resolve(attachment);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export async function getConversations(): Promise<Conversation[]> {
  const res = await fetch('/api/conversations', {
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load conversations');
  return res.json();
}

export async function createConversation(): Promise<Conversation> {
  const res = await fetch('/api/conversations', {
    method: 'POST',
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to create conversation');
  return res.json();
}

export async function getConversation(id: string): Promise<Conversation> {
  const res = await fetch(`/api/conversations/${id}`, {
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load conversation');
  return res.json();
}

export async function deleteConversation(id: string): Promise<void> {
  const res = await fetch(`/api/conversations/${id}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete conversation');
}

export async function renameConversation(id: string, title: string): Promise<Conversation> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`/api/conversations/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error('Failed to rename conversation');
  return res.json();
}

export async function getResumes(): Promise<ResumeData[]> {
  const res = await fetch('/api/resumes', {
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load resumes');
  return res.json();
}

export async function saveResume(resume: ResumeData): Promise<ResumeData> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch('/api/resumes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(resume),
  });
  if (!res.ok) throw new Error('Failed to save resume');
  return res.json();
}

export async function deleteResume(id: string): Promise<void> {
  const res = await fetch(`/api/resumes/${id}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete resume');
}

export async function getLatexCode(
  resume: ResumeData,
  template: TemplateId = 'modern'
): Promise<string> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch('/api/resumes/latex', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({ resume, template }),
  });
  if (!res.ok) throw new Error('Failed to generate LaTeX');
  const data = await res.json();
  return data.latex;
}

export interface CompileResumeResponse {
  success: boolean;
  resume: ResumeData;
  pdfUrl: string;
  pdfFileId: string;
  size?: number;
  latexCode: string;
}

export async function compileResumePdf(
  resume: ResumeData,
  template: TemplateId = 'modern',
  latexCode?: string
): Promise<CompileResumeResponse> {
  const authHeaders = await getAuthHeaders();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  try {
    const res = await fetch('/api/resumes/compile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ resume, template, latexCode }),
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = new Error(data.message || 'LaTeX compilation failed') as any;
      err.errorCode = data.error || 'COMPILATION_FAILED';
      err.log = data.log;
      err.latexCode = data.latexCode || latexCode;
      throw err;
    }

    return data;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('LaTeX compilation timed out. The server took too long to compile the document.') as any;
      timeoutErr.errorCode = 'TIMEOUT';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetches an authenticated file (e.g. compiled resume PDF) from the protected server endpoint
 * using the current user session credentials (Clerk Bearer token or guest headers).
 * Returns the raw binary Blob, preventing unauthorized direct iframe requests.
 */
export async function fetchAuthenticatedPdfBlob(pdfUrl: string): Promise<Blob> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(pdfUrl, {
    method: 'GET',
    headers: authHeaders,
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('Authentication required to access resume PDF. Please refresh your session.');
    }
    throw new Error(`Failed to retrieve resume PDF (HTTP ${res.status} ${res.statusText})`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.message || 'Server returned invalid PDF format');
  }

  return res.blob();
}

export async function getCareerProfile(): Promise<CareerProfile> {
  const res = await fetch('/api/profile', {
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load profile');
  return res.json();
}

export async function updateCareerProfile(profile: Partial<CareerProfile>): Promise<CareerProfile> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch('/api/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error('Failed to update profile');
  return res.json();
}

export async function getSavedJobs(): Promise<SavedJob[]> {
  const res = await fetch('/api/jobs/saved', {
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load saved jobs');
  return res.json();
}

export async function saveJob(jobOrSavedJob: JobListing | SavedJob): Promise<SavedJob> {
  let payload: SavedJob;
  if ('savedAt' in jobOrSavedJob && 'status' in jobOrSavedJob) {
    payload = jobOrSavedJob as SavedJob;
  } else {
    const j = jobOrSavedJob as JobListing;
    payload = {
      id: 'save_' + j.id,
      job: j,
      savedAt: new Date().toISOString(),
      status: 'saved',
    };
  }

  const authHeaders = await getAuthHeaders();
  const res = await fetch('/api/jobs/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to save job');
  return res.json();
}

export async function updateSavedJobStatus(
  id: string,
  status: ApplicationStatus
): Promise<SavedJob> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`/api/jobs/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Failed to update job status');
  return res.json();
}

export async function deleteSavedJob(id: string): Promise<void> {
  const res = await fetch(`/api/jobs/${id}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete saved job');
}

export async function removeSavedJob(id: string): Promise<void> {
  return deleteSavedJob(id);
}

export async function getSettings(): Promise<AppSettings> {
  const res = await fetch('/api/settings', {
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load settings');
  return res.json();
}

export async function updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}

export async function checkHealth(): Promise<{ status: string; hasGeminiKey: boolean }> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}
