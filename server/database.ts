import fs from 'fs';
import path from 'path';
import type {
  Conversation,
  ResumeData,
  CareerProfile,
  SavedJob,
  AppSettings,
} from '../src/types';

export interface UploadedFileRecord {
  fileId: string;
  filename: string;
  mimeType: string;
  size: number;
  userId?: string;
  guestId?: string;
  createdAt: string;
}

interface DatabaseSchema {
  conversations: Record<string, Conversation>;
  resumes: Record<string, ResumeData>;
  careerProfiles?: Record<string, CareerProfile>;
  careerProfile?: CareerProfile;
  savedJobs: Record<string, SavedJob>;
  userSettings?: Record<string, AppSettings>;
  settings: AppSettings;
  guestUsage?: Record<string, { date: string; count: number }>;
  uploadedFiles?: Record<string, UploadedFileRecord>;
}

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'career_agent_db.json');

const defaultDatabase: DatabaseSchema = {
  conversations: {},
  resumes: {},
  careerProfiles: {},
  careerProfile: {
    skills: [],
    preferredLocations: [],
  },
  savedJobs: {},
  guestUsage: {},
  userSettings: {},
  uploadedFiles: {},
  settings: {
    thinkingMode: false,
    defaultTemplate: 'modern',
    preferredJobProvider: 'automatic',
  },
};

class Database {
  private data: DatabaseSchema;
  private writeTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          ...defaultDatabase,
          ...parsed,
          userSettings: parsed.userSettings || {},
          careerProfiles: parsed.careerProfiles || {},
          uploadedFiles: parsed.uploadedFiles || {},
          settings: { ...defaultDatabase.settings, ...(parsed.settings || {}) },
          careerProfile: { ...defaultDatabase.careerProfile, ...(parsed.careerProfile || {}) },
        };
      }
    } catch (err) {
      console.error('[DB] Failed to load database, initializing with default', err);
    }
    return JSON.parse(JSON.stringify(defaultDatabase));
  }

  private persist() {
    if (this.writeTimeout) {
      clearTimeout(this.writeTimeout);
    }
    this.writeTimeout = setTimeout(() => {
      try {
        if (!fs.existsSync(DB_DIR)) {
          fs.mkdirSync(DB_DIR, { recursive: true });
        }
        const tempPath = `${DB_FILE}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
        fs.renameSync(tempPath, DB_FILE);
      } catch (err) {
        console.error('[DB] Error writing to disk:', err);
      }
    }, 50);
  }

  // Ownership helper
  private verifyOwnership(
    resource: { userId?: string; guestId?: string },
    userId?: string,
    guestId?: string
  ): boolean {
    if (userId) {
      return resource.userId === userId;
    }
    if (guestId) {
      return !resource.userId && resource.guestId === guestId;
    }
    return false;
  }

  // Conversations
  public getConversations(userId?: string, guestId?: string): Conversation[] {
    let list = Object.values(this.data.conversations);
    if (userId) {
      list = list.filter((c) => c.userId === userId);
    } else if (guestId) {
      list = list.filter((c) => !c.userId && (c as any).guestId === guestId);
    } else {
      return [];
    }
    return list.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  public getConversation(id: string): Conversation | undefined {
    return this.data.conversations[id];
  }

  public renameConversation(
    id: string,
    title: string,
    userId?: string,
    guestId?: string
  ): Conversation | undefined {
    const conv = this.data.conversations[id];
    if (!conv) return undefined;
    if (!this.verifyOwnership(conv as any, userId, guestId)) return undefined;

    conv.title = title.trim() || 'Untitled Chat';
    conv.isCustomTitle = true;
    conv.updatedAt = new Date().toISOString();
    this.persist();
    return conv;
  }

  public saveConversation(
    conversation: Conversation,
    userId?: string,
    guestId?: string
  ): Conversation {
    const existing = this.data.conversations[conversation.id];
    if (existing && !this.verifyOwnership(existing as any, userId, guestId)) {
      throw new Error('Access denied: You do not own this conversation');
    }

    if (userId) {
      conversation.userId = userId;
      delete (conversation as any).guestId;
    } else if (guestId && !conversation.userId) {
      (conversation as any).guestId = guestId;
    }

    conversation.updatedAt = new Date().toISOString();
    this.data.conversations[conversation.id] = conversation;
    this.persist();
    return conversation;
  }

  public deleteConversation(id: string, userId?: string, guestId?: string): boolean {
    const conv = this.data.conversations[id];
    if (conv) {
      if (!this.verifyOwnership(conv as any, userId, guestId)) return false;
      delete this.data.conversations[id];
      this.persist();
      return true;
    }
    return false;
  }

  // Resumes
  public getResumes(userId?: string, guestId?: string): ResumeData[] {
    let list = Object.values(this.data.resumes);
    if (userId) {
      list = list.filter((r) => (r as any).userId === userId);
    } else if (guestId) {
      list = list.filter((r) => !(r as any).userId && (r as any).guestId === guestId);
    } else {
      return [];
    }
    return list.sort(
      (a, b) =>
        new Date(b.lastUpdated || '').getTime() -
        new Date(a.lastUpdated || '').getTime()
    );
  }

  public getResume(id: string): ResumeData | undefined {
    return this.data.resumes[id];
  }

  public saveResume(resume: ResumeData, userId?: string, guestId?: string): ResumeData {
    if (!resume.id) {
      resume.id = 'res_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    }
    const existing = this.data.resumes[resume.id];
    if (existing && !this.verifyOwnership(existing as any, userId, guestId)) {
      throw new Error('Access denied: You do not own this resume');
    }

    if (userId) {
      (resume as any).userId = userId;
      delete (resume as any).guestId;
    } else if (guestId) {
      (resume as any).guestId = guestId;
      delete (resume as any).userId;
    }
    resume.lastUpdated = new Date().toISOString();
    this.data.resumes[resume.id] = resume;
    this.persist();
    return resume;
  }

  public deleteResume(id: string, userId?: string, guestId?: string): boolean {
    const resume = this.data.resumes[id];
    if (resume) {
      if (!this.verifyOwnership(resume as any, userId, guestId)) return false;
      delete this.data.resumes[id];
      this.persist();
      return true;
    }
    return false;
  }

  // Career Profile (Per-User)
  private getProfileKey(userId?: string, guestId?: string): string {
    if (userId) return `usr_${userId}`;
    if (guestId) return `gst_${guestId}`;
    return 'default';
  }

  public getCareerProfile(userId?: string, guestId?: string): CareerProfile {
    const key = this.getProfileKey(userId, guestId);
    if (this.data.careerProfiles && this.data.careerProfiles[key]) {
      return this.data.careerProfiles[key];
    }
    return {
      skills: [],
      preferredLocations: [],
      userId,
    };
  }

  public updateCareerProfile(
    profile: Partial<CareerProfile>,
    userId?: string,
    guestId?: string
  ): CareerProfile {
    const key = this.getProfileKey(userId, guestId);
    if (!this.data.careerProfiles) {
      this.data.careerProfiles = {};
    }
    const current = this.getCareerProfile(userId, guestId);
    const updated: CareerProfile = {
      ...current,
      ...profile,
      userId: userId || current.userId,
      updatedAt: new Date().toISOString(),
    };
    this.data.careerProfiles[key] = updated;
    this.persist();
    return updated;
  }

  // Saved Jobs & Application Tracker
  public getSavedJobs(userId?: string, guestId?: string): SavedJob[] {
    let list = Object.values(this.data.savedJobs);
    if (userId) {
      list = list.filter((sj) => sj.userId === userId);
    } else if (guestId) {
      list = list.filter((sj) => !sj.userId && (sj as any).guestId === guestId);
    } else {
      return [];
    }
    return list.sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    );
  }

  public getSavedJob(id: string): SavedJob | undefined {
    return this.data.savedJobs[id];
  }

  public saveJob(job: SavedJob, userId?: string, guestId?: string): SavedJob {
    const existing = this.data.savedJobs[job.id];
    if (existing && !this.verifyOwnership(existing as any, userId, guestId)) {
      throw new Error('Access denied: You do not own this saved job');
    }

    if (userId) {
      job.userId = userId;
      delete (job as any).guestId;
    } else if (guestId) {
      (job as any).guestId = guestId;
      delete job.userId;
    }
    this.data.savedJobs[job.id] = job;
    this.persist();
    return job;
  }

  public updateSavedJobStatus(
    id: string,
    status: any,
    userId?: string,
    guestId?: string
  ): SavedJob | undefined {
    const job = this.data.savedJobs[id];
    if (!job) return undefined;
    if (!this.verifyOwnership(job as any, userId, guestId)) return undefined;

    job.status = status;
    if (status === 'applied' && !job.appliedAt) {
      job.appliedAt = new Date().toISOString();
    }
    this.data.savedJobs[id] = job;
    this.persist();
    return job;
  }

  public removeSavedJob(id: string, userId?: string, guestId?: string): boolean {
    const job = this.data.savedJobs[id];
    if (job) {
      if (!this.verifyOwnership(job as any, userId, guestId)) return false;
      delete this.data.savedJobs[id];
      this.persist();
      return true;
    }
    return false;
  }

  // Settings (Per-User)
  private getSettingsKey(userId?: string, guestId?: string): string {
    if (userId) return `usr_${userId}`;
    if (guestId) return `gst_${guestId}`;
    return 'default';
  }

  public getSettings(userId?: string, guestId?: string): AppSettings {
    const key = this.getSettingsKey(userId, guestId);
    if (this.data.userSettings && this.data.userSettings[key]) {
      return {
        ...defaultDatabase.settings,
        ...this.data.userSettings[key],
      };
    }
    return {
      ...defaultDatabase.settings,
      ...(this.data.settings || {}),
    };
  }

  public updateSettings(
    settings: Partial<AppSettings>,
    userId?: string,
    guestId?: string
  ): AppSettings {
    const key = this.getSettingsKey(userId, guestId);
    if (!this.data.userSettings) {
      this.data.userSettings = {};
    }
    const current = this.getSettings(userId, guestId);
    const updated: AppSettings = {
      ...current,
      ...settings,
    };
    this.data.userSettings[key] = updated;
    this.persist();
    return updated;
  }

  // Guest Usage Tracking (Daily limit)
  public getGuestUsage(guestKey: string): { date: string; count: number } {
    const today = new Date().toISOString().split('T')[0];
    const record = this.data.guestUsage?.[guestKey];
    if (!record || record.date !== today) {
      return { date: today, count: 0 };
    }
    return { date: today, count: record.count };
  }

  public incrementGuestUsage(guestKey: string): { date: string; count: number } {
    const today = new Date().toISOString().split('T')[0];
    if (!this.data.guestUsage) {
      this.data.guestUsage = {};
    }
    const current = this.data.guestUsage[guestKey];
    let newCount = 1;
    if (current && current.date === today) {
      newCount = current.count + 1;
    }
    this.data.guestUsage[guestKey] = {
      date: today,
      count: newCount,
    };
    this.persist();
    return { date: today, count: newCount };
  }

  // Uploaded Files Management
  public saveUploadedFile(record: UploadedFileRecord): void {
    if (!this.data.uploadedFiles) {
      this.data.uploadedFiles = {};
    }
    this.data.uploadedFiles[record.fileId] = record;
    this.persist();
  }

  public getUploadedFile(fileId: string): UploadedFileRecord | undefined {
    if (this.data.uploadedFiles && this.data.uploadedFiles[fileId]) {
      return this.data.uploadedFiles[fileId];
    }
    // Search conversations as fallback if file was uploaded as part of a conversation
    for (const conv of Object.values(this.data.conversations)) {
      if (conv.messages) {
        for (const msg of conv.messages) {
          if (msg.attachments) {
            const att = msg.attachments.find((a) => a.fileId === fileId);
            if (att) {
              return {
                fileId,
                filename: att.name,
                mimeType: att.type,
                size: att.size,
                userId: conv.userId,
                guestId: (conv as any).guestId,
                createdAt: msg.timestamp || conv.createdAt,
              };
            }
          }
        }
      }
    }
    return undefined;
  }
}

export const db = new Database();
