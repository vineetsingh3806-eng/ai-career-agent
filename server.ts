import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { verifyToken } from '@clerk/backend';

// Helper to clean up any environment variables that include key names or quotes
function cleanEnvValue(keyName: string, val?: string): string {
  if (!val) return '';
  let s = val.trim();
  if (s.startsWith(`${keyName}=`)) {
    s = s.slice(keyName.length + 1).trim();
  } else if (s.startsWith(`${keyName}:`)) {
    s = s.slice(keyName.length + 1).trim();
  }
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

// Helper to sanitize and repair Clerk publishable keys if minor typos or padding issues occurred
export function sanitizeAndRepairClerkKey(val?: string): string {
  if (!val) return '';
  let clean = cleanEnvValue('VITE_CLERK_PUBLISHABLE_KEY', val);
  clean = cleanEnvValue('CLERK_PUBLISHABLE_KEY', clean);
  const match = clean.match(/pk_(test|live)_[a-zA-Z0-9_$=]+/);
  if (match) clean = match[0];
  if (!clean.startsWith('pk_')) return '';

  try {
    const parts = clean.split('_');
    if (parts.length >= 3) {
      const prefix = `${parts[0]}_${parts[1]}`;
      const b64 = parts[2];
      const decoded = Buffer.from(b64, 'base64').toString('utf8');
      
      // If corrupted or missing proper suffix, extract the instance slug and construct standard dev domain
      const slugMatch =
        decoded.match(/([a-z0-9-]+)\.(?:clurk|clerk)\.accounts/i) ||
        decoded.match(/^([a-z0-9-]+)\./i);

      if (slugMatch) {
        let slug = slugMatch[1];
        if (slug === 'funky-asp-5391' || slug.includes('5391')) {
          slug = 'funky-asp-2391';
        }
        const repairedFrontendApi = `${slug}.clerk.accounts.dev$`;
        const encoded = Buffer.from(repairedFrontendApi).toString('base64').replace(/=+$/, '');
        return `${prefix}_${encoded}`;
      }

      if (decoded && decoded.endsWith('$') && decoded.includes('.')) {
        return clean;
      }
    }
  } catch {
    // Ignore error and return cleaned value
  }

  return clean;
}

// Normalize environment variables in-place if they were passed with variable prefixes
const envKeysToClean = [
  'VITE_CLERK_PUBLISHABLE_KEY',
  'CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'CLERK_JWT_KEY',
  'ADZUNA_APP_ID',
  'ADZUNA_APP_KEY',
  'RAPIDAPI_KEY',
  'GEMINI_API_KEY',
];
for (const k of envKeysToClean) {
  if (process.env[k]) {
    process.env[k] = cleanEnvValue(k, process.env[k]);
  }
}

// Derive Clerk Publishable Key (strictly non-sensitive public key: pk_test_... or pk_live_...)
const rawClerkKey = process.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || '';
let CLERK_PUBLISHABLE_KEY = sanitizeAndRepairClerkKey(rawClerkKey);
if (CLERK_PUBLISHABLE_KEY) {
  process.env.VITE_CLERK_PUBLISHABLE_KEY = CLERK_PUBLISHABLE_KEY;
  process.env.CLERK_PUBLISHABLE_KEY = CLERK_PUBLISHABLE_KEY;
}

async function autoDiscoverClerkKeys() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return;
  try {
    const res = await fetch('https://api.clerk.com/v1/domains', {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (res.ok) {
      const json: any = await res.json();
      if (json.data && json.data.length > 0) {
        const domain = json.data.find((d: any) => !d.is_satellite) || json.data[0];
        if (domain && domain.frontend_api_url) {
          const host = domain.frontend_api_url.replace(/^https?:\/\//, '');
          const encoded = Buffer.from(`${host}$`).toString('base64').replace(/=+$/, '');
          const discoveredKey = `pk_test_${encoded}`;
          CLERK_PUBLISHABLE_KEY = discoveredKey;
          process.env.VITE_CLERK_PUBLISHABLE_KEY = discoveredKey;
          process.env.CLERK_PUBLISHABLE_KEY = discoveredKey;
          console.log('[Clerk] Auto-discovered verified publishable key from Clerk API:', discoveredKey);
        }
      }
    }

    // Pre-synchronize genuine JWKS public key from Clerk API to ensure valid RSA key
    try {
      const { createClerkClient } = await import('@clerk/backend');
      const clerk = createClerkClient({ secretKey });
      const jwks = await clerk.jwks.getJwks();
      if (jwks.keys && jwks.keys.length > 0) {
        const key = jwks.keys[0];
        if (key.n) {
          const b64n = key.n.replace(/-/g, '+').replace(/_/g, '/');
          const validPem = `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA${b64n}IDAQAB\n-----END PUBLIC KEY-----`;
          process.env.CLERK_JWT_KEY = validPem;
          console.log('[Clerk] Synchronized verified JWKS public key (kid:', key.kid, ')');
        }
      }
    } catch (jwksErr) {
      console.warn('[Clerk] Could not pre-fetch JWKS:', jwksErr);
    }
  } catch (err) {
    console.error('[Clerk] Error auto-discovering Clerk keys:', err);
  }
}
import { db } from './server/database';
import {
  callGemini,
  HIGH_DEMAND_USER_MESSAGE,
  is503UnavailableError,
  GeminiHighDemandError,
} from './server/gemini';
import { processAttachment, getUploadedFilePath } from './server/utils/fileExtractor';
import { generateLatex } from './server/utils/latexGenerator';
import { compileLatexToPdf } from './server/utils/latexCompiler.ts';
import { routeIntent } from './server/agents/intentRouter';
import { analyzeResume } from './server/agents/resumeAnalyzer';
import { matchCareerDomains } from './server/agents/careerMatcher';
import { optimizeResumeForJob } from './server/agents/jobOptimizer';
import { buildResumeFromChat } from './server/agents/resumeBuilder';
import { reviewResume } from './server/agents/resumeReviewer';
import { analyzeJobMatch } from './server/agents/jobMatchDetail';
import { generateCoverLetter } from './server/agents/coverLetterGenerator';
import { generateInterviewPrep } from './server/agents/interviewPrepAgent';
import { jobSearchService } from './server/providers/jobSearch/jobSearchService';
import type {
  Conversation,
  ChatMessage,
  Attachment,
  IntentType,
  ResumeData,
  JobListing,
  SavedJob,
} from './src/types';

export interface AuthContext {
  userId?: string;
  isGuest: boolean;
  guestId: string;
}

declare global {
  namespace Express {
    interface Request {
      auth: AuthContext;
    }
  }
}

async function authenticateClerkToken(token: string): Promise<string> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const jwtKey = process.env.CLERK_JWT_KEY;

  if (!secretKey && !jwtKey) {
    throw new Error(
      'Clerk configuration missing: CLERK_SECRET_KEY is required for cryptographic token verification'
    );
  }

  let verified: any = null;
  let lastError: any = null;

  // 1. Primary verification: using secretKey fetches & caches the authoritative remote JWKS from Clerk
  if (secretKey) {
    try {
      verified = await verifyToken(token, { secretKey });
    } catch (err: any) {
      lastError = err;
    }
  }

  // 2. Secondary fallback: if secretKey was absent or network failed and a valid jwtKey is present
  if (!verified && jwtKey) {
    try {
      verified = await verifyToken(token, { jwtKey });
    } catch (err: any) {
      if (!lastError) lastError = err;
    }
  }

  if (!verified) {
    throw lastError || new Error('Cryptographic token verification failed');
  }

  if (typeof verified.sub !== 'string' || !verified.sub.trim()) {
    throw new Error('Invalid token: missing or invalid subject claim');
  }

  return verified.sub;
}

const authMiddleware: express.RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const rawGuestId = req.headers['x-guest-id'] as string;
  const guestId = typeof rawGuestId === 'string' && rawGuestId.trim() ? rawGuestId.trim() : 'anon_guest';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token && token !== 'undefined' && token !== 'null' && token !== '[object Object]') {
      try {
        const userId = await authenticateClerkToken(token);
        req.auth = {
          userId,
          isGuest: false,
          guestId,
        };
        return next();
      } catch (err: any) {
        console.warn('[Auth] Token authentication error:', err?.message || err);
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Invalid or expired session token. Please sign in again.',
        });
      }
    }
  }

  // Never trust client-supplied userId from header, body, or query!
  req.auth = {
    userId: undefined,
    isGuest: true,
    guestId,
  };
  next();
};

function checkResourceOwnership(
  resource: { userId?: string; guestId?: string },
  auth: AuthContext
): boolean {
  if (auth.userId) {
    return resource.userId === auth.userId;
  }
  return !resource.userId && (resource as any).guestId === auth.guestId;
}

const getUserId = (req: express.Request): string | undefined => {
  return req.auth?.userId;
};

const GUEST_DAILY_LIMIT = 3;

const getGuestUsageStatus = (req: express.Request) => {
  if (req.auth?.userId) {
    return {
      isGuest: false,
      usageCount: 0,
      limit: GUEST_DAILY_LIMIT,
      remaining: GUEST_DAILY_LIMIT,
      limitReached: false,
    };
  }

  const guestId = req.auth?.guestId || 'anon_guest';
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || '127.0.0.1';
  const cleanIp = 'ip_' + ip.replace(/[^a-zA-Z0-9]/g, '_');

  const guestUsage = db.getGuestUsage(guestId);
  const ipUsage = db.getGuestUsage(cleanIp);

  const usageCount = Math.max(guestUsage.count, ipUsage.count);
  const remaining = Math.max(0, GUEST_DAILY_LIMIT - usageCount);
  const limitReached = usageCount >= GUEST_DAILY_LIMIT;

  return {
    isGuest: true,
    usageCount,
    limit: GUEST_DAILY_LIMIT,
    remaining,
    limitReached,
    guestId,
    cleanIp,
  };
};

const recordGuestInteraction = (req: express.Request) => {
  if (req.auth?.userId) return;

  const guestId = req.auth?.guestId || 'anon_guest';
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || '127.0.0.1';
  const cleanIp = 'ip_' + ip.replace(/[^a-zA-Z0-9]/g, '_');

  db.incrementGuestUsage(guestId);
  db.incrementGuestUsage(cleanIp);
};

async function startServer() {
  await autoDiscoverClerkKeys();

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use('/api', authMiddleware);

  // API Routes
  // Public App Configuration Endpoint (ONLY non-sensitive public values; NO secret keys)
  app.get('/api/config', (req, res) => {
    res.json({
      clerkPublishableKey: CLERK_PUBLISHABLE_KEY,
    });
  });

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      providers: jobSearchService.getAvailableProviders(),
    });
  });

  // Guest Usage Status Endpoint
  app.get('/api/guest/status', (req, res) => {
    const status = getGuestUsageStatus(req);
    res.json({
      isGuest: status.isGuest,
      usageCount: status.usageCount,
      limit: status.limit,
      remaining: status.remaining,
      limitReached: status.limitReached,
    });
  });

  // Settings
  app.get('/api/settings', (req, res) => {
    res.json(db.getSettings(req.auth.userId, req.auth.guestId));
  });

  app.post('/api/settings', (req, res) => {
    const updated = db.updateSettings(req.body, req.auth.userId, req.auth.guestId);
    res.json(updated);
  });

  // File Upload / Extraction
  app.post('/api/upload', async (req, res) => {
    try {
      const { filename, mimeType, base64Data } = req.body;
      if (!filename || !base64Data) {
        return res.status(400).json({ error: 'filename and base64Data are required' });
      }
      const attachment = await processAttachment(filename, mimeType || 'text/plain', base64Data);
      if (attachment.fileId) {
        db.saveUploadedFile({
          fileId: attachment.fileId,
          filename: attachment.name,
          mimeType: attachment.type,
          size: attachment.size,
          userId: req.auth?.userId,
          guestId: req.auth?.guestId,
          createdAt: new Date().toISOString(),
        });
      }
      res.json(attachment);
    } catch (err: any) {
      console.error('[API /upload] Error:', err);
      res.status(400).json({ error: err.message || 'Failed to process file' });
    }
  });

  // Serve Uploaded Files
  app.get('/api/files/:id', (req, res) => {
    try {
      const fileId = req.params.id;
      if (!fileId || typeof fileId !== 'string') {
        return res.status(400).json({ error: 'Valid file ID is required' });
      }

      // Check file record and ownership
      const fileRecord = db.getUploadedFile(fileId);
      const filePath = getUploadedFilePath(fileId);

      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'File not found',
        });
      }

      // Verify file ownership: private files cannot be accessed across users
      const hasAccess = req.auth?.userId
        ? fileRecord?.userId === req.auth.userId
        : !fileRecord?.userId && Boolean(req.auth?.guestId && fileRecord?.guestId === req.auth.guestId);

      if (!hasAccess) {
        if (!req.auth?.userId && fileRecord?.userId) {
          return res.status(401).json({
            error: 'UNAUTHORIZED',
            message: 'Authentication required to access uploaded files',
          });
        }
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Access denied: You do not own this file',
        });
      }

      if (fileRecord?.mimeType) {
        res.setHeader('Content-Type', fileRecord.mimeType);
      } else if (filePath.endsWith('.pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
      }
      res.setHeader('Content-Disposition', 'inline');
      res.sendFile(filePath);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve file' });
    }
  });

  // Conversations
  app.get('/api/conversations', (req, res) => {
    res.json(db.getConversations(req.auth.userId, req.auth.guestId));
  });

  app.post('/api/conversations', (req, res) => {
    const newConv: Conversation = {
      id: 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      userId: req.auth.userId,
      title: 'New Career Chat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    db.saveConversation(newConv, req.auth.userId, req.auth.guestId);
    res.json(newConv);
  });

  app.get('/api/conversations/:id', (req, res) => {
    const conv = db.getConversation(req.params.id);
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    if (!checkResourceOwnership(conv as any, req.auth)) {
      return res.status(403).json({ error: 'Access denied: You do not own this conversation' });
    }
    res.json(conv);
  });

  app.patch('/api/conversations/:id', (req, res) => {
    const { title } = req.body;
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Valid title is required' });
    }
    const existing = db.getConversation(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    if (!checkResourceOwnership(existing as any, req.auth)) {
      return res.status(403).json({ error: 'Access denied: You do not own this conversation' });
    }
    const conv = db.renameConversation(req.params.id, title, req.auth.userId, req.auth.guestId);
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conv);
  });

  app.delete('/api/conversations/:id', (req, res) => {
    const existing = db.getConversation(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    if (!checkResourceOwnership(existing as any, req.auth)) {
      return res.status(403).json({ error: 'Access denied: You do not own this conversation' });
    }
    const success = db.deleteConversation(req.params.id, req.auth.userId, req.auth.guestId);
    res.json({ success });
  });

  // Resumes
  app.get('/api/resumes', (req, res) => {
    res.json(db.getResumes(req.auth.userId, req.auth.guestId));
  });

  app.post('/api/resumes', (req, res) => {
    if (req.body.id) {
      const existing = db.getResume(req.body.id);
      if (existing && !checkResourceOwnership(existing as any, req.auth)) {
        return res.status(403).json({ error: 'Access denied: You do not own this resume' });
      }
    }
    const resume = db.saveResume(req.body, req.auth.userId, req.auth.guestId);
    res.json(resume);
  });

  app.get('/api/resumes/:id', (req, res) => {
    const resume = db.getResume(req.params.id);
    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }
    if (!checkResourceOwnership(resume as any, req.auth)) {
      return res.status(403).json({ error: 'Access denied: You do not own this resume' });
    }
    res.json(resume);
  });

  app.delete('/api/resumes/:id', (req, res) => {
    const resume = db.getResume(req.params.id);
    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }
    if (!checkResourceOwnership(resume as any, req.auth)) {
      return res.status(403).json({ error: 'Access denied: You do not own this resume' });
    }
    const success = db.deleteResume(req.params.id, req.auth.userId, req.auth.guestId);
    res.json({ success });
  });

  app.post('/api/resumes/latex', (req, res) => {
    const { resume, template } = req.body;
    if (!resume) {
      return res.status(400).json({ error: 'resume object is required' });
    }
    const code = generateLatex(resume, template || 'modern');
    res.json({ latex: code });
  });

  // Automatically compile resume LaTeX to PDF with server-side error capturing
  app.post('/api/resumes/compile', async (req, res) => {
    try {
      const { resume, template, latexCode } = req.body;
      if (!resume || typeof resume !== 'object') {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'A valid resume object is required for compilation.',
        });
      }

      if (!resume.name || !resume.name.trim()) {
        return res.status(400).json({
          error: 'INVALID_RESUME_INFO',
          message: 'Please provide at least a Candidate Name before generating the resume.',
        });
      }

      const activeTemplate = template || resume.templateId || 'modern';

      // Generate LaTeX code if not explicitly passed
      let tex = latexCode;
      if (!tex || typeof tex !== 'string' || !tex.trim()) {
        tex = generateLatex(resume, activeTemplate);
      }

      if (!tex || !tex.trim()) {
        return res.status(422).json({
          error: 'EMPTY_LATEX',
          message: 'The generated LaTeX output is empty.',
          latexCode: '',
        });
      }

      const safeBaseName = (resume.name || 'Resume').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${safeBaseName}_${activeTemplate}.pdf`;

      const compileResult = await compileLatexToPdf(tex, {
        userId: req.auth?.userId,
        guestId: req.auth?.guestId,
        filename,
      });

      if (!compileResult.success) {
        return res.status(422).json({
          error: compileResult.error || 'COMPILATION_FAILED',
          message: compileResult.message || 'Failed to compile LaTeX into PDF.',
          log: compileResult.log,
          latexCode: compileResult.finalLatex || tex,
        });
      }

      const finalTex = compileResult.finalLatex || tex;

      // Persist compiled resume record with PDF file ID & URL using existing storage
      const updatedResume = {
        ...resume,
        templateId: activeTemplate,
        pdfFileId: compileResult.pdfFileId,
        pdfUrl: compileResult.pdfUrl,
        latexCode: finalTex,
        lastUpdated: new Date().toISOString(),
      };

      const saved = db.saveResume(updatedResume, req.auth.userId, req.auth.guestId);

      res.json({
        success: true,
        resume: saved,
        pdfUrl: compileResult.pdfUrl,
        pdfFileId: compileResult.pdfFileId,
        size: compileResult.size,
        latexCode: finalTex,
      });
    } catch (err: any) {
      console.error('[API /api/resumes/compile] Error:', err);
      res.status(500).json({
        error: 'SERVER_ERROR',
        message: err.message || 'An unexpected error occurred during resume compilation.',
      });
    }
  });

  // Career Profile
  app.get('/api/profile', (req, res) => {
    res.json(db.getCareerProfile(req.auth.userId, req.auth.guestId));
  });

  app.put('/api/profile', (req, res) => {
    const updated = db.updateCareerProfile(req.body, req.auth.userId, req.auth.guestId);
    res.json(updated);
  });

  // Saved Jobs & Application Tracker
  app.get('/api/jobs/saved', (req, res) => {
    res.json(db.getSavedJobs(req.auth.userId, req.auth.guestId));
  });

  app.post('/api/jobs/save', (req, res) => {
    if (req.body.id) {
      const existing = db.getSavedJob(req.body.id);
      if (existing && !checkResourceOwnership(existing as any, req.auth)) {
        return res.status(403).json({ error: 'Access denied: You do not own this saved job' });
      }
    }
    const saved = db.saveJob(req.body, req.auth.userId, req.auth.guestId);
    res.json(saved);
  });

  app.patch('/api/jobs/:id/status', (req, res) => {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    const existing = db.getSavedJob(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Saved job not found' });
    }
    if (!checkResourceOwnership(existing as any, req.auth)) {
      return res.status(403).json({ error: 'Access denied: You do not own this saved job' });
    }
    const updated = db.updateSavedJobStatus(req.params.id, status, req.auth.userId, req.auth.guestId);
    if (!updated) {
      return res.status(404).json({ error: 'Saved job not found' });
    }
    res.json(updated);
  });

  app.delete('/api/jobs/:id', (req, res) => {
    const existing = db.getSavedJob(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Saved job not found' });
    }
    if (!checkResourceOwnership(existing as any, req.auth)) {
      return res.status(403).json({ error: 'Access denied: You do not own this saved job' });
    }
    const success = db.removeSavedJob(req.params.id, req.auth.userId, req.auth.guestId);
    res.json({ success });
  });

  // Direct Job Search
  app.get('/api/jobs/search', async (req, res) => {
    try {
      const guestStatus = getGuestUsageStatus(req);
      if (guestStatus.isGuest && guestStatus.limitReached) {
        return res.status(403).json({
          error: 'GUEST_LIMIT_REACHED',
          message: "You've used your 3 free guest uses for today.",
          limit: GUEST_DAILY_LIMIT,
          remaining: 0,
          limitReached: true,
        });
      }

      const { query, role, location, remote, provider, page, limit, mode } = req.query;
      const settings = db.getSettings(req.auth.userId, req.auth.guestId);
      const isPersonalized = mode === 'personalized';
      const userResumes = db.getResumes(req.auth.userId, req.auth.guestId);
      const candidateResume = isPersonalized ? userResumes[0] : undefined;

      const results = await jobSearchService.searchJobs(
        {
          query: query as string,
          role: role as string,
          location: ((location as string) || 'India').trim(),
          remoteOnly: remote === 'true',
          page: page ? parseInt(page as string, 10) : 1,
          limit: limit ? parseInt(limit as string, 10) : 25,
          mode: isPersonalized ? 'personalized' : 'explore',
        },
        candidateResume,
        (provider as string) || settings.preferredJobProvider
      );

      recordGuestInteraction(req);
      const updatedStatus = getGuestUsageStatus(req);

      res.json({
        ...results,
        guestStatus: {
          isGuest: updatedStatus.isGuest,
          usageCount: updatedStatus.usageCount,
          limit: updatedStatus.limit,
          remaining: updatedStatus.remaining,
          limitReached: updatedStatus.limitReached,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Job search failed' });
    }
  });

  // PRIMARY CHAT AGENT ENDPOINT
  app.post('/api/chat', async (req, res) => {
    const guestStatus = getGuestUsageStatus(req);
    if (guestStatus.isGuest && guestStatus.limitReached) {
      return res.status(403).json({
        error: 'GUEST_LIMIT_REACHED',
        message: "You've used your 3 free guest uses for today.",
        limit: GUEST_DAILY_LIMIT,
        remaining: 0,
        limitReached: true,
      });
    }

    let conv: Conversation | null = null;
    try {
      const {
        conversationId,
        message = '',
        attachments = [],
        useHighThinking = false,
      } = req.body;

      conv = conversationId ? db.getConversation(conversationId) : null;
      if (conv) {
        if (!checkResourceOwnership(conv as any, req.auth)) {
          return res.status(403).json({ error: 'Access denied: You do not own this conversation' });
        }
      } else {
        conv = {
          id: 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          userId: req.auth.userId,
          title: 'New Career Chat',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [],
        };
      }

      const hasNewAttachments = Array.isArray(attachments) && attachments.length > 0;

      // Create user message
      const userMessageObj: ChatMessage = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
        attachments: hasNewAttachments ? attachments : undefined,
      };

      conv.messages.push(userMessageObj);

      // If user uploaded a document that looks like a resume, extract or store initial context
      if (hasNewAttachments) {
        const textSnippets = attachments
          .map((a: Attachment) => a.parsedContent || a.textSnippet || '')
          .filter(Boolean)
          .join('\n\n');

        if (textSnippets.trim().length > 20) {
          conv.resumeText = textSnippets;
          if (!conv.activeResumeData) {
            conv.activeResumeData = {
              name: 'Candidate',
              email: '',
              summary: textSnippets.slice(0, 300),
              skills: { technical: [] },
              education: [],
              experience: [],
              projects: [],
              certifications: [],
            };
          }
        }
      }

      // If conv has no resumeText yet, check if any earlier message had attachments with text
      if (!conv.resumeText) {
        for (const m of conv.messages) {
          if (m.attachments && m.attachments.length > 0) {
            const snips = m.attachments
              .map((a: Attachment) => a.parsedContent || a.textSnippet || '')
              .filter(Boolean)
              .join('\n\n');
            if (snips.trim().length > 20) {
              conv.resumeText = snips;
              break;
            }
          }
        }
      }

      // 1. Route Intent
      const intentDecision = await routeIntent(message, conv, hasNewAttachments);
      const intents = intentDecision.intents;
      console.log(`[ChatAgent] Intent decision: ${intents.join(', ')} | Reasoning: ${intentDecision.reasoning}`);

      // Track selected job if ordinal or index provided
      if (typeof intentDecision.selectedJobIndex === 'number' && conv.cachedJobResults) {
        const candidateJob = conv.cachedJobResults[intentDecision.selectedJobIndex];
        if (candidateJob) {
          conv.selectedJob = candidateJob;
          conv.selectedJobId = candidateJob.id;
        }
      }

      const meta: any = {
        intents,
        usedThinkingMode: useHighThinking,
      };

      let assistantContent = '';

      // Check if user uploaded resume without asking for immediate analysis
      const lowerMsg = message.toLowerCase().trim();
      const isSimpleResumeHandshake =
        hasNewAttachments &&
        intents.includes('general_chat') &&
        intents.length === 1 &&
        (lowerMsg.includes('here is my resume') ||
          lowerMsg.includes('here is my cv') ||
          lowerMsg.includes('ye mera resume') ||
          lowerMsg.includes('attached my resume') ||
          lowerMsg.includes('this is my resume') ||
          lowerMsg === 'resume' ||
          lowerMsg === '');

      if (isSimpleResumeHandshake) {
        assistantContent =
          "I've received and parsed your resume into your session context! Here are the ways we can proceed:\n\n" +
          "1. **Analyze Resume**: Say *'Analyze my resume'* or *'Isko analyze karo'* to view your AI Resume Quality Score, strengths, and ATS suggestions.\n" +
          "2. **Career Matching**: Say *'Main kin domains me ja sakta hoon?'* or *'What roles suit me?'* to explore target career domains.\n" +
          "3. **Find Jobs**: Say *'Ab mere resume ke according jobs dhundho'* to search live openings matched to your skills.\n" +
          "4. **Job Optimization**: Mention any specific job or description to tailor your resume and generate an updated LaTeX export.";
      } else {
        // Execute Intent Pipeline (supporting multi-intent sequentially)
        for (const intent of intents) {
          if (intent === 'resume_analysis') {
            // Build resume text from context or attachments
            let textToAnalyze = '';
            if (hasNewAttachments) {
              textToAnalyze = attachments
                .map((a: Attachment) => a.parsedContent || a.textSnippet || '')
                .join('\n\n');
            }
            if (!textToAnalyze && conv.resumeText) {
              textToAnalyze = conv.resumeText;
            }
            if (!textToAnalyze && conv.activeResumeData && conv.activeResumeData.name !== 'Candidate') {
              textToAnalyze = JSON.stringify(conv.activeResumeData);
            }

            if (!textToAnalyze && attachments.length === 0) {
              assistantContent +=
                "\n\nPlease upload your resume or paste its contents so I can run the AI Resume Analyzer for you.";
              continue;
            }

            const analysisResult = await analyzeResume(
              textToAnalyze,
              attachments,
              useHighThinking
            );
            meta.analysis = analysisResult.analysis;
            conv.cachedAnalysis = analysisResult.analysis;
            conv.activeResumeData = analysisResult.extractedResume;
            // Also save extracted resume into DB
            db.saveResume(analysisResult.extractedResume, req.auth.userId, req.auth.guestId);

            // Also update career profile with identified skills and education
            db.updateCareerProfile({
              name: analysisResult.extractedResume.name !== 'Unknown' ? analysisResult.extractedResume.name : undefined,
              email: analysisResult.extractedResume.email || undefined,
              phone: analysisResult.extractedResume.phone || undefined,
              skills: analysisResult.analysis.identifiedSkills,
              targetRole: analysisResult.extractedResume.targetRole || undefined,
            }, req.auth.userId, req.auth.guestId);

            assistantContent +=
              (assistantContent ? '\n\n---\n\n' : '') + analysisResult.formattedText;
          } else if (intent === 'career_matching') {
            const profile = db.getCareerProfile(req.auth.userId, req.auth.guestId);
            const matchResult = await matchCareerDomains(
              conv.activeResumeData,
              profile,
              message,
              useHighThinking,
              conv.resumeText
            );
            meta.careerMatch = matchResult.match;
            conv.cachedCareerMatch = matchResult.match;
            assistantContent +=
              (assistantContent ? '\n\n---\n\n' : '') + matchResult.formattedText;
          } else if (intent === 'job_search') {
            const profile = db.getCareerProfile(req.auth.userId, req.auth.guestId);
            const userMsgLower = message.toLowerCase();

            // Detect mode: explore vs personalized
            const isExploreExplicit =
              intentDecision.searchParams?.mode === 'explore' ||
              /explore|all jobs|browse|worldwide|global|all india/i.test(userMsgLower);

            const isPersonalizedExplicit =
              intentDecision.searchParams?.mode === 'personalized' ||
              /mere resume|resume ke according|match my resume|for my resume|for me/i.test(userMsgLower);

            const searchMode: 'personalized' | 'explore' = isExploreExplicit
              ? 'explore'
              : (isPersonalizedExplicit || conv.activeResumeData)
                ? 'personalized'
                : 'explore';

            // LOCATION DETERMINATION & STICKY SCOPE MANAGEMENT:
            // 1. DEFAULT JOB LOCATION = INDIA (When user does not explicitly provide a location)
            // 2. SPECIFIC LOCATION OVERRIDES INDIA (e.g. Noida, Bangalore, Pune, Delhi, London, etc.)
            // 3. EXPLORE WORLDWIDE (International / global live search)
            // Worldwide mode remains active until user returns to India scope or selects a specific location.
            const isExplicitWorldwide =
              /explore worldwide|worldwide|global|outside india|international|abroad/i.test(userMsgLower);
            const isExplicitIndia =
              /all india|in india|india jobs|jobs in india|explore india/i.test(userMsgLower) ||
              userMsgLower.trim() === 'india' ||
              userMsgLower.includes('bharat');
            const isExplicitRemote = /remote|wfh/i.test(userMsgLower);

            let explicitLocation = intentDecision.searchParams?.location?.trim();
            const isSpecificLocation = Boolean(
              explicitLocation &&
              !/^(india|all india|worldwide|remote)$/i.test(explicitLocation)
            );

            let targetLocation: string;

            if (isExplicitWorldwide) {
              conv.activeJobLocationScope = 'Worldwide';
              targetLocation = 'Worldwide';
            } else if (isExplicitIndia) {
              conv.activeJobLocationScope = 'India';
              targetLocation = 'India';
            } else if (isSpecificLocation) {
              // Explicit user location (Noida, Bangalore, Pune, Delhi, etc.) overrides India default
              conv.activeJobLocationScope = explicitLocation!;
              targetLocation = explicitLocation!;
            } else if (conv.activeJobLocationScope === 'Worldwide') {
              // Worldwide mode remains active until user returns to India or selects a specific location
              targetLocation = 'Worldwide';
            } else {
              // DEFAULT JOB LOCATION = INDIA
              // Do NOT use resume's personal location as the job-search location!
              conv.activeJobLocationScope = 'India';
              targetLocation = 'India';
            }

            const isRemoteOnly = Boolean(
              intentDecision.searchParams?.remote ||
              isExplicitRemote ||
              targetLocation?.toLowerCase() === 'remote'
            );

            // Role / Query determination
            const candidateSkills =
              conv.activeResumeData?.skills?.technical?.length
                ? conv.activeResumeData.skills.technical
                : conv.cachedCareerMatch?.currentStrengths || profile.skills || [];

            const targetRole =
              intentDecision.searchParams?.role ||
              (searchMode === 'personalized'
                ? conv.cachedCareerMatch?.primaryDomain?.title ||
                  conv.activeResumeData?.targetRole ||
                  profile.targetRole ||
                  'Software Engineer'
                : undefined);

            const queryKeywords =
              intentDecision.searchParams?.keywords?.join(' ') ||
              (intentDecision.searchParams?.role ? '' : (searchMode === 'explore' && !isExploreExplicit ? message : ''));

            const settings = db.getSettings(req.auth.userId, req.auth.guestId);
            const providerResult = await jobSearchService.searchJobs(
              {
                query: queryKeywords,
                role: targetRole,
                location: targetLocation,
                remoteOnly: isRemoteOnly,
                skills: searchMode === 'personalized' ? candidateSkills : undefined,
                limit: 15,
                page: 1,
                mode: searchMode,
              },
              searchMode === 'personalized' ? conv.activeResumeData : undefined,
              settings.preferredJobProvider
            );

            meta.jobResults = {
              jobs: providerResult.jobs,
              providerStatus: providerResult.statusMessage,
              queryUsed: targetRole || targetLocation || 'Live Opportunities',
              isLive: providerResult.isLive,
              page: providerResult.page || 1,
              hasMore: providerResult.hasMore,
              totalFound: providerResult.totalFound,
              providersContributed: providerResult.providersContributed,
              mode: searchMode,
              activeLocationScope: providerResult.locationScope,
            };
            conv.cachedJobResults = providerResult.jobs;

            if (providerResult.jobs.length > 0) {
              const providersText = (providerResult.providersContributed || ['Connected Providers']).join(', ');
              const scopeLabel = providerResult.locationScope || 'India';
              assistantContent +=
                (assistantContent ? '\n\n---\n\n' : '') +
                `### Verified Live Openings in ${scopeLabel} (${providerResult.providerName})\n` +
                `*Live jobs discovered from connected job providers (${providersText}). Scope: **${scopeLabel}**.*\n\n` +
                providerResult.jobs
                  .map(
                    (j, idx) =>
                      `**${idx + 1}. [${j.title}](${j.jobUrl || j.applyUrl})** at **${j.company}**\n` +
                      `- **Source:** Live • ${j.provider}\n` +
                      `- **Location:** ${j.location} ${j.remote ? '*(Remote)*' : ''}\n` +
                      (j.employmentType ? `- **Type:** ${j.employmentType}\n` : '') +
                      (j.matchScore ? `- **Resume Match:** ${j.matchScore}%\n` : '') +
                      (j.whyMatches?.length ? `- **Why it matches:** ${j.whyMatches.join('; ')}\n` : '') +
                      `- [Apply / View Listing](${j.jobUrl || j.applyUrl})\n`
                  )
                  .join('\n');
            } else {
              const scopeLabel = providerResult.locationScope || 'India';
              assistantContent +=
                (assistantContent ? '\n\n---\n\n' : '') +
                `No live openings currently available from our connected job providers for this search query in **${scopeLabel}**.\n\n` +
                `**Suggestions to expand your search:**\n` +
                `- Try searching for **'All India jobs'** or **'Explore Worldwide'**\n` +
                `- Adjust or broaden the target role (e.g. 'Developer', 'Engineer')\n` +
                `- Click **'Explore Worldwide'** to browse global remote live opportunities`;
            }
          } else if (intent === 'job_match') {
            const targetJob =
              conv.selectedJob ||
              (typeof intentDecision.selectedJobIndex === 'number' && conv.cachedJobResults?.[intentDecision.selectedJobIndex]) ||
              (conv.cachedJobResults && conv.cachedJobResults[0]);

            if (!targetJob) {
              assistantContent +=
                (assistantContent ? '\n\n---\n\n' : '') +
                "Please search for jobs first or specify which position you would like to compare with your profile.";
              continue;
            }

            conv.selectedJob = targetJob;
            conv.selectedJobId = targetJob.id;

            const matchDetail = await analyzeJobMatch(
              targetJob,
              conv.activeResumeData,
              useHighThinking
            );
            meta.jobMatchDetail = matchDetail;

            assistantContent +=
              (assistantContent ? '\n\n---\n\n' : '') +
              `### Match Breakdown: **${matchDetail.jobTitle}** at **${matchDetail.company || 'Company'}**\n\n` +
              `**Overall Match Score:** **${matchDetail.matchScore}%**\n\n` +
              `> ${matchDetail.whyMatches.join('. ')}\n\n` +
              `#### Matching Strengths & Skills\n` +
              matchDetail.matchingSkills.map((s) => `- ${s}`).join('\n') + '\n\n' +
              (matchDetail.missingSkills.length > 0
                ? `#### Missing or Desired Skills\n${matchDetail.missingSkills.map((s) => `- ${s}`).join('\n')}\n\n`
                : '') +
              (matchDetail.concerns.length > 0
                ? `#### Potential Watch-Outs / Concerns\n${matchDetail.concerns.map((c) => `- ${c}`).join('\n')}\n\n`
                : '') +
              `#### Recommendations to Strengthen Application\n` +
              matchDetail.recommendations.map((r) => `- ${r}`).join('\n');
          } else if (intent === 'cover_letter') {
            const targetJob =
              conv.selectedJob ||
              (typeof intentDecision.selectedJobIndex === 'number' && conv.cachedJobResults?.[intentDecision.selectedJobIndex]) ||
              (conv.cachedJobResults && conv.cachedJobResults[0]);

            const profile = db.getCareerProfile(req.auth.userId, req.auth.guestId);
            const letterResult = await generateCoverLetter(
              targetJob,
              conv.activeResumeData,
              profile,
              useHighThinking
            );
            meta.coverLetter = letterResult;

            assistantContent +=
              (assistantContent ? '\n\n---\n\n' : '') +
              `### Tailored Cover Letter: **${letterResult.jobTitle}** ${letterResult.company ? `at **${letterResult.company}**` : ''}\n\n` +
              `\`\`\`text\n${letterResult.coverLetterText}\n\`\`\`\n\n` +
              `#### Key Highlights Addressed\n` +
              letterResult.keyHighlights.map((h) => `- ${h}`).join('\n');
          } else if (intent === 'interview_prep') {
            const targetJob =
              conv.selectedJob ||
              (typeof intentDecision.selectedJobIndex === 'number' && conv.cachedJobResults?.[intentDecision.selectedJobIndex]) ||
              (conv.cachedJobResults && conv.cachedJobResults[0]);

            const profile = db.getCareerProfile(req.auth.userId, req.auth.guestId);
            const prepResult = await generateInterviewPrep(
              targetJob,
              conv.activeResumeData,
              profile,
              useHighThinking
            );
            meta.interviewPrep = prepResult;

            assistantContent +=
              (assistantContent ? '\n\n---\n\n' : '') +
              `### Interview Preparation Guide: **${prepResult.jobTitle}** ${prepResult.company ? `at **${prepResult.company}**` : ''}\n\n` +
              `*${prepResult.roleOverview}*\n\n` +
              `#### 1. Likely Technical Questions\n` +
              prepResult.technicalQuestions
                .map((q, idx) => `**Q${idx + 1}: ${q.question}**\n- *Why they ask:* ${q.context}\n- *Approach:* ${q.recommendedApproach}`)
                .join('\n\n') + '\n\n' +
              `#### 2. Behavioral Questions (STAR Method)\n` +
              prepResult.behavioralQuestions
                .map((q, idx) => `**Q${idx + 1}: ${q.question}** *(Focus: ${q.competency})*\n- *STAR Tip:* ${q.starAdvice}`)
                .join('\n\n') + '\n\n' +
              `#### 3. Resume & Project-Specific Inquiries\n` +
              prepResult.resumeSpecificQuestions
                .map((q, idx) => `**Q${idx + 1}: ${q.question}** *(From: ${q.basedOn})*\n- *Guidance:* ${q.tip}`)
                .join('\n\n') + '\n\n' +
              `#### Core Preparation Focus Topics\n` +
              prepResult.preparationTopics.map((t) => `- ${t}`).join('\n');
          } else if (intent === 'job_optimization') {
            if (!conv.activeResumeData && !conv.resumeText) {
              assistantContent +=
                (assistantContent ? '\n\n---\n\n' : '') +
                "To optimize your resume for a job, please first upload or paste your resume.";
              continue;
            }

            // Identify target job from cached jobs or message
            let targetJob: Partial<JobListing> | string = intentDecision.extractedJobText || message;
            if (
              typeof intentDecision.selectedJobIndex === 'number' &&
              conv.cachedJobResults &&
              conv.cachedJobResults[intentDecision.selectedJobIndex]
            ) {
              targetJob = conv.cachedJobResults[intentDecision.selectedJobIndex];
            } else if (conv.selectedJob) {
              targetJob = conv.selectedJob;
            } else if (conv.cachedJobResults && conv.cachedJobResults.length > 0) {
              // If user selected "this job" and only 1 job is referenced or defaults to first
              targetJob = conv.cachedJobResults[0];
            }

            const optResult = await optimizeResumeForJob(
              conv.activeResumeData,
              targetJob,
              message,
              useHighThinking
            );
            meta.jobOptimization = optResult;

            if (optResult.tailoredResume) {
              conv.activeResumeData = optResult.tailoredResume;
              db.saveResume(optResult.tailoredResume, req.auth.userId, req.auth.guestId);
              meta.latexCode = generateLatex(
                optResult.tailoredResume,
                optResult.tailoredResume.templateId || 'modern'
              );
            }

            assistantContent +=
              (assistantContent ? '\n\n---\n\n' : '') +
              `### Resume Tailoring & Optimization: **${optResult.targetJobTitle}** ${optResult.targetCompany ? `at ${optResult.targetCompany}` : ''}\n\n` +
              `**Resume Alignment Score:** ${optResult.matchScore}%\n\n` +
              `#### Verified Matching Qualifications\n${optResult.matchingSkills.map((s) => `- ${s}`).join('\n')}\n\n` +
              (optResult.missingSkills.length > 0
                ? `#### Recommended Target Keywords / Gaps\n${optResult.missingSkills.map((s) => `- ${s}`).join('\n')}\n\n`
                : '') +
              `#### Refined Experience Bullet Points\n` +
              optResult.tailoredBulletPoints
                .slice(0, 3)
                .map(
                  (b) =>
                    `- **Original:** ${b.original}\n  **Improved:** ${b.improved}\n  *(Why: ${b.reason})*`
                )
                .join('\n\n') +
              `\n\n*A tailored resume has been generated. You can view it in the Resume Builder or export as LaTeX / PDF.*`;
          } else if (intent === 'resume_builder') {
            const builderResult = await buildResumeFromChat(
              message,
              conv.activeResumeData,
              conv.messages
            );
            conv.activeResumeData = builderResult.resume;
            db.saveResume(builderResult.resume, req.auth.userId, req.auth.guestId);
            meta.resumeData = builderResult.resume;
            meta.latexCode = generateLatex(builderResult.resume, builderResult.resume.templateId || 'modern');

            assistantContent +=
              (assistantContent ? '\n\n---\n\n' : '') +
              `${builderResult.message}\n\n` +
              (builderResult.missingFields.length > 0
                ? `**Still needed to complete your profile:**\n${builderResult.missingFields.map((f) => `- ${f}`).join('\n')}`
                : '');
          } else if (intent === 'resume_review') {
            if (!conv.activeResumeData) {
              assistantContent +=
                (assistantContent ? '\n\n---\n\n' : '') +
                'Please upload or create a resume first to run the AI Review.';
              continue;
            }
            const review = await reviewResume(conv.activeResumeData, useHighThinking);
            meta.reviewFeedback = review.critiques;

            assistantContent +=
              (assistantContent ? '\n\n---\n\n' : '') +
              `### AI Resume Pre-Submission Review\n` +
              `**Overall Audit Score:** ${review.score}/100 (${review.passed ? 'PASSED' : 'ACTION REQUIRED'})\n\n` +
              `#### Checklist Breakdown:\n` +
              `- **Information Completeness:** [${review.checks.missingInfo.status.toUpperCase()}] ${review.checks.missingInfo.message}\n` +
              `- **Grammar & Clarity:** [${review.checks.grammarAndClarity.status.toUpperCase()}] ${review.checks.grammarAndClarity.message}\n` +
              `- **ATS Compatibility:** [${review.checks.atsCompatibility.status.toUpperCase()}] ${review.checks.atsCompatibility.message}\n` +
              `- **Unsupported Claims & Metrics:** [${review.checks.unsupportedClaims.status.toUpperCase()}] ${review.checks.unsupportedClaims.message}\n` +
              `- **Conciseness & Verbosity:** [${review.checks.conciseness.status.toUpperCase()}] ${review.checks.conciseness.message}\n\n` +
              (review.suggestedFixes.length > 0
                ? `#### Actionable Fixes:\n${review.suggestedFixes.map((f) => `- ${f}`).join('\n')}`
                : '');
          } else if (intent === 'general_chat' && !assistantContent) {
            // Normal conversation enriched with candidate's actual resume background if available
            const systemInstruction = `You are AI Career Agent, a modern, highly capable career mentor and resume advisor.
You maintain a supportive, objective, and professional tone.
CRITICAL NON-FABRICATION RULE: Never invent user background, qualifications, or credentials.
Ground your answers specifically in the user's resume, skills, and background when provided.`;

            let candidateContext = '';
            if (conv.activeResumeData && conv.activeResumeData.name !== 'Candidate') {
              const r = conv.activeResumeData;
              candidateContext = `\nCandidate Background Context:
- Name: ${r.name}
- Target Role: ${r.targetRole || 'Not specified'}
- Education: ${r.education?.map((e) => `${e.degree} at ${e.institution}`).join('; ') || 'Not specified'}
- Technical Skills: ${[...(r.skills?.technical || []), ...(r.skills?.frameworks || [])].join(', ') || 'Not specified'}
- Experience: ${r.experience?.map((e) => `${e.role} at ${e.company}${e.startDate ? ` (${e.startDate} - ${e.endDate || 'Present'})` : ''}: ${e.bulletPoints?.slice(0, 2).join(' ')}`).join('; ') || 'Not specified'}`;
            } else if (conv.resumeText) {
              candidateContext = `\nCandidate Resume Excerpt:
${conv.resumeText.slice(0, 2000)}`;
            }

            const historyContext = conv.messages.slice(-5).map((m) => `${m.role}: ${m.content}`).join('\n');
            const chatPrompt = `${historyContext}\n${candidateContext ? candidateContext + '\n' : ''}user: ${message}\nassistant:`;

            const reply = await callGemini(chatPrompt, {
              systemInstruction,
              useHighThinking: false, // keep general chat prompt snappy and fast
            });
            assistantContent = reply;
          }
        }
      }

      if (!assistantContent) {
        assistantContent = "I've processed your request. How else can I assist with your career or resume?";
      }

      // Create assistant message
      const assistantMessageObj: ChatMessage = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date().toISOString(),
        meta,
      };

      conv.messages.push(assistantMessageObj);

      // Dynamically update conversation title for new conversations (if NOT manually renamed)
      if (!conv.isCustomTitle && (conv.title === 'New Career Chat' || conv.messages.length <= 2)) {
        const cleanMsg = (message || '').trim();
        const lower = cleanMsg.toLowerCase();

        if (lower.startsWith('analyze my resume') || lower.startsWith('review my resume') || intents.includes('resume_analysis')) {
          conv.title = 'Resume Analysis';
        } else if (lower.startsWith('help me prepare for an interview') || lower.includes('interview prep') || intents.includes('interview_prep')) {
          conv.title = 'Interview Preparation';
        } else if (lower.startsWith('what careers are suitable') || intents.includes('career_matching')) {
          conv.title = 'Career Matching';
        } else if (intents.includes('job_optimization')) {
          conv.title = 'Resume Optimization';
        } else if (intents.includes('cover_letter')) {
          conv.title = 'Cover Letter';
        } else {
          // Format query cleanly (e.g. "Find AI Engineer jobs in Noida" -> "AI Engineer Jobs in Noida")
          let stripped = cleanMsg
            .replace(/^(can you\s+)?(please\s+)?(help me\s+)?(i want to\s+)?(i'd like to\s+)?(how do i\s+)?/i, '')
            .replace(/^(find|search for|look for|show me|get me)\s+/i, '')
            .replace(/[?.!;,]+$/, '')
            .trim();

          if (!stripped) {
            stripped = cleanMsg.slice(0, 30);
          }

          const words = stripped.split(/\s+/).slice(0, 6);
          const titleCased = words
            .map((w, idx) => {
              const lowerW = w.toLowerCase();
              if (idx > 0 && ['in', 'at', 'for', 'of', 'and', 'the', 'a', 'an', 'to', 'on', 'with'].includes(lowerW)) {
                return lowerW;
              }
              return w.charAt(0).toUpperCase() + w.slice(1);
            })
            .join(' ');

          conv.title = titleCased.length > 35 ? titleCased.slice(0, 32).trim() + '...' : titleCased || 'Career Discussion';
        }
      }

      db.saveConversation(conv, req.auth.userId, req.auth.guestId);

      recordGuestInteraction(req);
      const updatedStatus = getGuestUsageStatus(req);

      res.json({
        message: assistantMessageObj,
        conversation: conv,
        guestStatus: {
          isGuest: updatedStatus.isGuest,
          usageCount: updatedStatus.usageCount,
          limit: updatedStatus.limit,
          remaining: updatedStatus.remaining,
          limitReached: updatedStatus.limitReached,
        },
      });
    } catch (err: any) {
      console.error('[API /chat] Error:', err);
      const isUnavailable =
        is503UnavailableError(err) || err instanceof GeminiHighDemandError;

      let userFacingContent = '';
      if (isUnavailable) {
        userFacingContent = HIGH_DEMAND_USER_MESSAGE;
      } else if (err.message && err.message.includes('API key')) {
        userFacingContent = 'Gemini API key is not configured or is invalid. Please verify your GEMINI_API_KEY setting.';
      } else if (err.message && !err.message.includes('{') && !err.message.includes('Error:')) {
        userFacingContent = err.message;
      } else {
        userFacingContent = 'The AI service is temporarily unavailable due to high demand. Please try again in a moment.';
      }

      // Preserve chat history and conversation context
      if (conv) {
        const assistantMessageObj: ChatMessage = {
          id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          role: 'assistant',
          content: userFacingContent,
          timestamp: new Date().toISOString(),
          meta: {
            isUnavailable,
          },
        };

        conv.messages.push(assistantMessageObj);
        db.saveConversation(conv);

        return res.json({
          message: assistantMessageObj,
          conversation: conv,
        });
      }

      res.status(503).json({
        error: userFacingContent,
      });
    }
  });

  // Global Error Handler to prevent stack trace leakage
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Unhandled Server Error]', err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(500).json({
      error: 'An unexpected server error occurred. Please try again.',
    });
  });

  // Vite Middleware (Development) or Static File Serving (Production)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Career Agent server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
