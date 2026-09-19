import React, { useState, useEffect, useRef } from 'react';
import {
  FileDown,
  FileCode,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  Eye,
  RefreshCw,
  Edit3,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Code2,
} from 'lucide-react';
import type { ResumeData, TemplateId, ExperienceItem, ProjectItem, EducationItem, CertificationItem } from '../../types';
import { downloadLatexFile, downloadCompiledPdf } from '../../services/pdfExport';
import { saveResume, getLatexCode, compileResumePdf, fetchAuthenticatedPdfBlob } from '../../services/api';

interface ResumeBuilderViewProps {
  initialResume?: ResumeData;
  onBackToChat: () => void;
  onRunAiReview?: (resume: ResumeData) => void;
}

const DEFAULT_RESUME: ResumeData = {
  name: '',
  email: '',
  phone: '',
  location: '',
  targetRole: '',
  summary: '',
  skills: {
    technical: [],
    frameworks: [],
    tools: [],
    soft: [],
  },
  education: [],
  experience: [],
  projects: [],
  certifications: [],
  templateId: 'modern',
};

type ViewMode = 'form' | 'preview' | 'latex';
type LoadingStep = 'idle' | 'generating' | 'compiling' | 'preparing';

export const ResumeBuilderView: React.FC<ResumeBuilderViewProps> = ({
  initialResume,
  onBackToChat,
  onRunAiReview,
}) => {
  const [resume, setResume] = useState<ResumeData>(initialResume || DEFAULT_RESUME);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>(
    initialResume?.templateId || 'modern'
  );
  
  // View mode: 'preview' is default when a compiled PDF exists, otherwise 'form'
  const [viewMode, setViewMode] = useState<ViewMode>(
    initialResume?.pdfUrl ? 'preview' : 'form'
  );

  const [pdfUrl, setPdfUrl] = useState<string>(initialResume?.pdfUrl || '');
  const [pdfFileId, setPdfFileId] = useState<string>(initialResume?.pdfFileId || '');
  const [latexCode, setLatexCode] = useState<string>(initialResume?.latexCode || '');

  // Generation & Compilation loading pipeline
  const [loadingStep, setLoadingStep] = useState<LoadingStep>('idle');
  const [compilationError, setCompilationError] = useState<{
    code: string;
    message: string;
    log?: string;
  } | null>(null);

  // General state
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedLatex, setCopiedLatex] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Skill input helper state
  const [techSkillInput, setTechSkillInput] = useState('');
  const [frameworkInput, setFrameworkInput] = useState('');
  const [toolInput, setToolInput] = useState('');
  const [softSkillInput, setSoftSkillInput] = useState('');

  // Authenticated PDF Blob state for iframe preview & direct download
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isLoadingBlob, setIsLoadingBlob] = useState<boolean>(false);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Authenticated Blob loader: fetches the protected PDF with Clerk Bearer token
  // and creates an in-memory Blob URL for the preview iframe and download.
  useEffect(() => {
    let isMounted = true;
    let createdBlobUrl: string | null = null;

    async function loadPdfBlob() {
      if (!pdfUrl) {
        setPdfBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        setIsLoadingBlob(false);
        setPdfLoadError(null);
        return;
      }

      setIsLoadingBlob(true);
      setPdfLoadError(null);

      try {
        const blob = await fetchAuthenticatedPdfBlob(pdfUrl);
        if (!isMounted) return;

        const newBlobUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        createdBlobUrl = newBlobUrl;
        setPdfBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return newBlobUrl;
        });
      } catch (err: any) {
        if (!isMounted) return;
        console.error('[ResumeBuilder] Failed to load authenticated PDF blob:', err);
        setPdfLoadError(
          err.message?.includes('Authentication')
            ? 'Unable to load your resume preview. Please refresh your session and try again.'
            : 'Unable to load your resume preview. Please try recompiling your resume.'
        );
      } finally {
        if (isMounted) {
          setIsLoadingBlob(false);
        }
      }
    }

    loadPdfBlob();

    return () => {
      isMounted = false;
      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [pdfUrl]);

  // Clean up blob URL on component unmount
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  useEffect(() => {
    if (initialResume) {
      setResume(initialResume);
      if (initialResume.templateId) setSelectedTemplate(initialResume.templateId);
      if (initialResume.pdfUrl) {
        setPdfUrl(initialResume.pdfUrl);
        setViewMode('preview');
      }
      if (initialResume.pdfFileId) setPdfFileId(initialResume.pdfFileId);
      if (initialResume.latexCode) setLatexCode(initialResume.latexCode);
    }
  }, [initialResume]);

  const isProcessing = loadingStep !== 'idle';

  // Validate basic resume completeness before generating
  const validateForm = (): boolean => {
    if (!resume.name || !resume.name.trim()) {
      setValidationError('Please enter your full name before generating a resume.');
      return false;
    }
    setValidationError(null);
    return true;
  };

  /**
   * Main Generation & Compilation Flow:
   * 1. Validates form data
   * 2. Step: Generating resume (prepares LaTeX source)
   * 3. Step: Compiling resume (server-side compilation to PDF)
   * 4. Step: Preparing preview (renders preview and transitions view)
   */
  const handleGenerateResume = async (customLatex?: string) => {
    if (isProcessing) return;

    if (!customLatex && !validateForm()) {
      return;
    }

    setCompilationError(null);
    setValidationError(null);

    try {
      // Step 1: Generating resume / LaTeX source
      setLoadingStep('generating');
      await new Promise((r) => setTimeout(r, 200)); // smooth visual feedback

      let sourceTex = customLatex;
      if (!sourceTex) {
        sourceTex = await getLatexCode(resume, selectedTemplate);
        setLatexCode(sourceTex);
      }

      // Step 2: Compiling resume on the backend
      setLoadingStep('compiling');
      const compileRes = await compileResumePdf(resume, selectedTemplate, sourceTex);

      // Step 3: Preparing preview
      setLoadingStep('preparing');
      await new Promise((r) => setTimeout(r, 150));

      setPdfUrl(compileRes.pdfUrl);
      setPdfFileId(compileRes.pdfFileId);
      setResume(compileRes.resume);
      setLatexCode(compileRes.latexCode);

      // Transition to preview view automatically
      setViewMode('preview');
    } catch (err: any) {
      console.error('[ResumeBuilder] Generation error:', err);
      // Preserve generated LaTeX if returned in error payload
      if (err.latexCode) {
        setLatexCode(err.latexCode);
      }
      setCompilationError({
        code: err.errorCode || 'COMPILATION_FAILED',
        message: err.message || 'LaTeX compilation failed. Please check the resume details.',
        log: err.log,
      });
    } finally {
      setLoadingStep('idle');
    }
  };

  // Manual save of draft
  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const saved = await saveResume({
        ...resume,
        templateId: selectedTemplate,
        pdfUrl: pdfUrl || undefined,
        pdfFileId: pdfFileId || undefined,
        latexCode: latexCode || undefined,
      });
      setResume(saved);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to save resume:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Download PDF action
  const handleDownloadPdf = async () => {
    if (!pdfUrl) {
      // If no compiled PDF exists yet, generate one first
      await handleGenerateResume();
      return;
    }
    const safeName = (resume.name || 'Resume').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    try {
      await downloadCompiledPdf(
        pdfUrl,
        `${safeName}_${selectedTemplate}.pdf`,
        pdfBlobUrl || undefined
      );
    } catch (err: any) {
      console.error('[ResumeBuilder] Download error:', err);
      setPdfLoadError(
        err.message?.includes('Authentication')
          ? 'Unable to download your resume. Please refresh your session and try again.'
          : 'Failed to download resume PDF. Please try recompiling.'
      );
    }
  };

  const handleCopyLatex = () => {
    if (!latexCode) return;
    navigator.clipboard.writeText(latexCode);
    setCopiedLatex(true);
    setTimeout(() => setCopiedLatex(false), 2000);
  };

  // Experience Handlers
  const addExperience = () => {
    const newItem: ExperienceItem = {
      id: 'exp_' + Date.now(),
      company: '',
      role: '',
      location: '',
      startDate: '',
      endDate: '',
      current: false,
      bulletPoints: [''],
    };
    setResume((prev) => ({ ...prev, experience: [...(prev.experience || []), newItem] }));
  };

  const updateExperience = (index: number, field: keyof ExperienceItem, value: any) => {
    setResume((prev) => {
      const updated = [...(prev.experience || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, experience: updated };
    });
  };

  const removeExperience = (index: number) => {
    setResume((prev) => ({
      ...prev,
      experience: (prev.experience || []).filter((_, i) => i !== index),
    }));
  };

  const addExperienceBullet = (expIndex: number) => {
    setResume((prev) => {
      const updated = [...(prev.experience || [])];
      updated[expIndex].bulletPoints = [...(updated[expIndex].bulletPoints || []), ''];
      return { ...prev, experience: updated };
    });
  };

  const updateExperienceBullet = (expIndex: number, bulletIndex: number, text: string) => {
    setResume((prev) => {
      const updated = [...(prev.experience || [])];
      const bullets = [...(updated[expIndex].bulletPoints || [])];
      bullets[bulletIndex] = text;
      updated[expIndex].bulletPoints = bullets;
      return { ...prev, experience: updated };
    });
  };

  const removeExperienceBullet = (expIndex: number, bulletIndex: number) => {
    setResume((prev) => {
      const updated = [...(prev.experience || [])];
      const bullets = (updated[expIndex].bulletPoints || []).filter((_, i) => i !== bulletIndex);
      updated[expIndex].bulletPoints = bullets;
      return { ...prev, experience: updated };
    });
  };

  // Project Handlers
  const addProject = () => {
    const newItem: ProjectItem = {
      id: 'proj_' + Date.now(),
      name: '',
      technologies: [],
      bulletPoints: [''],
    };
    setResume((prev) => ({ ...prev, projects: [...(prev.projects || []), newItem] }));
  };

  const removeProject = (index: number) => {
    setResume((prev) => ({
      ...prev,
      projects: (prev.projects || []).filter((_, i) => i !== index),
    }));
  };

  // Education Handlers
  const addEducation = () => {
    const newItem: EducationItem = {
      id: 'edu_' + Date.now(),
      institution: '',
      degree: '',
      fieldOfStudy: '',
      startDate: '',
      endDate: '',
    };
    setResume((prev) => ({ ...prev, education: [...(prev.education || []), newItem] }));
  };

  const removeEducation = (index: number) => {
    setResume((prev) => ({
      ...prev,
      education: (prev.education || []).filter((_, i) => i !== index),
    }));
  };

  // Certification Handlers
  const addCertification = () => {
    const newItem: CertificationItem = {
      name: '',
      issuer: '',
      date: '',
    };
    setResume((prev) => ({
      ...prev,
      certifications: [...(prev.certifications || []), newItem],
    }));
  };

  const removeCertification = (index: number) => {
    setResume((prev) => ({
      ...prev,
      certifications: (prev.certifications || []).filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="flex h-full flex-col bg-slate-50 overflow-hidden">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6 z-10 shadow-xs">
        {/* Left: Navigation and Title */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToChat}
            className="flex items-center space-x-1 rounded-md p-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            title="Return to Career Chat"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Chat</span>
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-slate-900">LaTeX Resume Builder</h2>
              {pdfUrl && (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                  Compiled PDF Ready
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Auto-generates LaTeX, compiles server-side, and previews live PDF.
            </p>
          </div>
        </div>

        {/* Right: Controls & Primary Actions */}
        <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
          {/* Template Picker */}
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="text-slate-500 font-medium">Template:</span>
            <select
              value={selectedTemplate}
              onChange={(e) => {
                const nextTemplate = e.target.value as TemplateId;
                setSelectedTemplate(nextTemplate);
              }}
              disabled={isProcessing}
              className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none disabled:opacity-60"
            >
              <option value="ats_minimal">ATS Minimal</option>
              <option value="modern">Modern Professional</option>
              <option value="ai_engineer">AI / Tech Engineer</option>
              <option value="fresher">Fresher / Graduate</option>
              <option value="corporate">Executive Corporate</option>
            </select>
          </div>

          {/* View Mode Switcher: Form vs Preview */}
          <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-100 text-xs font-medium">
            <button
              onClick={() => setViewMode('form')}
              className={`flex items-center space-x-1.5 rounded px-2.5 py-1 transition-colors ${
                viewMode === 'form'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Edit Form</span>
            </button>

            <button
              onClick={() => {
                if (!pdfUrl && !isProcessing) {
                  handleGenerateResume();
                } else {
                  setViewMode('preview');
                }
              }}
              className={`flex items-center space-x-1.5 rounded px-2.5 py-1 transition-colors ${
                viewMode === 'preview'
                  ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Preview Resume</span>
            </button>
          </div>

          {/* Primary Action: Generate / Regenerate */}
          <button
            onClick={() => handleGenerateResume()}
            disabled={isProcessing}
            className="flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 disabled:opacity-60 transition-colors"
            title="Generate LaTeX and automatically compile PDF"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Compiling...</span>
              </>
            ) : pdfUrl ? (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Regenerate</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>Generate Resume</span>
              </>
            )}
          </button>

          {/* Download PDF (Active whenever PDF is compiled) */}
          <button
            onClick={handleDownloadPdf}
            disabled={isProcessing}
            className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs disabled:opacity-60 transition-colors"
            title="Download compiled PDF file"
          >
            <FileDown className="h-3.5 w-3.5 text-blue-600" />
            <span>Download PDF</span>
          </button>

          {/* Optional Secondary Action: View LaTeX Source */}
          <button
            onClick={() => {
              if (!latexCode && !isProcessing) {
                getLatexCode(resume, selectedTemplate).then((code) => {
                  setLatexCode(code);
                  setViewMode('latex');
                });
              } else {
                setViewMode(viewMode === 'latex' ? (pdfUrl ? 'preview' : 'form') : 'latex');
              }
            }}
            disabled={isProcessing}
            className={`flex items-center space-x-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === 'latex'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
            title="Optional: View raw LaTeX source"
          >
            <Code2 className="h-3.5 w-3.5 text-slate-500" />
            <span>View LaTeX Source</span>
          </button>

          {/* Save Draft */}
          <button
            onClick={handleSaveDraft}
            disabled={isSaving || isProcessing}
            className="flex items-center space-x-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            title="Save draft to history"
          >
            {savedSuccess ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Save className="h-3.5 w-3.5 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* Progressive Step Loading Bar */}
      {isProcessing && (
        <div className="bg-blue-50/90 border-b border-blue-100 px-6 py-3 flex items-center justify-between text-xs text-blue-900 animate-fade-in">
          <div className="flex items-center space-x-3">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
            <div className="flex items-center space-x-2">
              <span className="font-semibold">
                {loadingStep === 'generating' && 'Step 1/3: Generating resume LaTeX source...'}
                {loadingStep === 'compiling' && 'Step 2/3: Compiling resume with LaTeX backend...'}
                {loadingStep === 'preparing' && 'Step 3/3: Preparing live PDF preview...'}
              </span>
              <span className="text-blue-500 text-[11px] hidden sm:inline">
                Please wait, compiling cleanly without manual effort.
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-[11px] font-medium text-blue-700">
            <span className={loadingStep === 'generating' ? 'font-bold underline' : ''}>Generating</span>
            <span>→</span>
            <span className={loadingStep === 'compiling' ? 'font-bold underline' : ''}>Compiling</span>
            <span>→</span>
            <span className={loadingStep === 'preparing' ? 'font-bold underline' : ''}>Preview</span>
          </div>
        </div>
      )}

      {/* Validation Warning Banner */}
      {validationError && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="font-medium">{validationError}</span>
          </div>
          <button
            onClick={() => setValidationError(null)}
            className="text-amber-700 hover:text-amber-900 font-bold px-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Compilation Error Banner */}
      {compilationError && (
        <div className="bg-rose-50 border-b border-rose-200 px-6 py-3 text-xs text-rose-900 space-y-1.5">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold">Resume Compilation Failed: </span>
                <span>{compilationError.message}</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('latex')}
                className="rounded bg-rose-100 px-2 py-0.5 font-semibold text-rose-800 hover:bg-rose-200"
              >
                View LaTeX Source
              </button>
              <button
                onClick={() => setCompilationError(null)}
                className="text-rose-600 hover:text-rose-900 font-bold px-1"
              >
                ×
              </button>
            </div>
          </div>
          {compilationError.log && (
            <details className="mt-1 text-[11px] text-rose-700 bg-white/60 p-2 rounded border border-rose-200">
              <summary className="cursor-pointer font-medium hover:underline">Compiler Log Details</summary>
              <pre className="mt-1.5 overflow-x-auto whitespace-pre font-mono text-[10px] leading-tight">
                {compilationError.log}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* =========================================================================
            VIEW 1: PDF PREVIEW (Primary Result when compiled)
        ========================================================================= */}
        {viewMode === 'preview' && (
          <div className="mx-auto max-w-5xl h-full flex flex-col space-y-4">
            {/* Quick Preview Toolbar */}
            <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-2.5 shadow-2xs">
              <div className="flex items-center space-x-2 text-xs">
                <span className="font-bold text-slate-800">
                  {resume.name ? `${resume.name}'s Resume` : 'Resume Preview'}
                </span>
                <span className="text-slate-400">•</span>
                <span className="capitalize text-slate-500 font-medium">
                  {selectedTemplate.replace('_', ' ')} Template
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setViewMode('form')}
                  className="flex items-center space-x-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
                >
                  <Edit3 className="h-3 w-3 text-slate-500" />
                  <span>Edit Details</span>
                </button>

                <button
                  onClick={handleDownloadPdf}
                  className="flex items-center space-x-1 rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 transition-colors"
                >
                  <FileDown className="h-3 w-3" />
                  <span>Download PDF</span>
                </button>

                <button
                  onClick={() => {
                    if (!latexCode && !isProcessing) {
                      getLatexCode(resume, selectedTemplate).then((code) => {
                        setLatexCode(code);
                        setViewMode('latex');
                      });
                    } else {
                      setViewMode('latex');
                    }
                  }}
                  className="flex items-center space-x-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
                  title="Optional: View LaTeX Source"
                >
                  <Code2 className="h-3 w-3 text-slate-500" />
                  <span>View LaTeX Source</span>
                </button>

                <button
                  onClick={() => handleGenerateResume()}
                  disabled={isProcessing}
                  className="flex items-center space-x-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
                  title="Re-compile resume"
                >
                  <RefreshCw className={`h-3 w-3 text-slate-500 ${isProcessing ? 'animate-spin' : ''}`} />
                  <span>Regenerate</span>
                </button>

                <a
                  href={pdfBlobUrl || pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-1 rounded-md p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  title="Open PDF in new tab"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {/* Embedded PDF Viewer */}
            <div className="flex-1 min-h-[680px] rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
              {isLoadingBlob ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                  <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mb-3" />
                  <h4 className="text-sm font-semibold text-slate-800">Loading PDF Preview...</h4>
                  <p className="text-xs text-slate-500 mt-1">Preparing your compiled resume preview</p>
                </div>
              ) : pdfLoadError ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-rose-50/40 rounded-xl">
                  <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center mb-3">
                    <AlertTriangle className="h-6 w-6 text-rose-600" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Preview Notice</h4>
                  <p className="text-xs text-slate-600 max-w-md mt-1 mb-5 leading-relaxed">
                    {pdfLoadError}
                  </p>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handleGenerateResume()}
                      disabled={isProcessing}
                      className="flex items-center space-x-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 transition-colors"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                      <span>Recompile Resume</span>
                    </button>
                    <button
                      onClick={() => setViewMode('latex')}
                      className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Code2 className="h-3.5 w-3.5 text-slate-500" />
                      <span>View LaTeX Source</span>
                    </button>
                  </div>
                </div>
              ) : pdfBlobUrl ? (
                <iframe
                  ref={iframeRef}
                  src={`${pdfBlobUrl}#toolbar=0&navpanes=0`}
                  title="Resume PDF Preview"
                  className="w-full h-full flex-1 border-0 rounded-xl bg-white"
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                  <Sparkles className="h-10 w-10 text-blue-500 mb-3" />
                  <h3 className="text-sm font-bold text-slate-800">Resume not compiled yet</h3>
                  <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
                    Click below to generate and compile this resume into a ready-to-download PDF.
                  </p>
                  <button
                    onClick={() => handleGenerateResume()}
                    disabled={isProcessing}
                    className="flex items-center space-x-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Generate & Compile Resume</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            VIEW 2: LATEX SOURCE VIEWER (Optional Secondary Action)
        ========================================================================= */}
        {viewMode === 'latex' && (
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-2xs">
              <div>
                <h3 className="text-xs font-bold text-slate-900">LaTeX Source Code</h3>
                <p className="text-[11px] text-slate-500">
                  Optional source inspection. You can copy the code or re-compile directly.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyLatex}
                  className="flex items-center space-x-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
                >
                  {copiedLatex ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-slate-500" />
                      <span>Copy LaTeX</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => downloadLatexFile(latexCode, `resume_${selectedTemplate}.tex`)}
                  className="flex items-center space-x-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
                  title="Download .tex file"
                >
                  <FileCode className="h-3.5 w-3.5 text-slate-500" />
                  <span>Download .tex</span>
                </button>

                <button
                  onClick={() => handleGenerateResume(latexCode)}
                  disabled={isProcessing}
                  className="flex items-center space-x-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Compile LaTeX to PDF</span>
                </button>

                <button
                  onClick={() => setViewMode(pdfUrl ? 'preview' : 'form')}
                  className="rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  {pdfUrl ? 'Back to Preview' : 'Back to Form'}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-slate-100 shadow-sm font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3 text-[11px] text-slate-400">
                <span>{selectedTemplate}.tex ({latexCode.length} characters)</span>
                <span>Editable LaTeX Source</span>
              </div>
              <textarea
                value={latexCode}
                onChange={(e) => setLatexCode(e.target.value)}
                rows={24}
                className="w-full bg-transparent text-slate-100 font-mono text-xs border-0 focus:outline-none resize-y leading-relaxed"
                spellCheck={false}
              />
            </div>
          </div>
        )}

        {/* =========================================================================
            VIEW 3: RESUME INFORMATION FORM (User fills structured details)
        ========================================================================= */}
        {viewMode === 'form' && (
          <div className="mx-auto max-w-3xl space-y-6">
            {/* Action Banner: Ready to Generate */}
            <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50/60 p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-blue-900">
                  Ready to compile your resume?
                </h3>
                <p className="text-[11px] text-blue-700/80 mt-0.5">
                  Select your template and click Generate Resume. The backend compiles LaTeX and opens your preview automatically.
                </p>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleGenerateResume()}
                  disabled={isProcessing}
                  className="flex items-center space-x-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Generate Resume</span>
                </button>
                {pdfUrl && (
                  <button
                    type="button"
                    onClick={() => setViewMode('preview')}
                    className="flex items-center space-x-1.5 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-50 shadow-2xs transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>View Current PDF</span>
                  </button>
                )}
              </div>
            </div>

            {/* Section 1: Personal & Contact Details */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Personal & Contact Details
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Full Name *</label>
                  <input
                    type="text"
                    value={resume.name || ''}
                    onChange={(e) => {
                      setResume({ ...resume, name: e.target.value });
                      if (validationError) setValidationError(null);
                    }}
                    placeholder="e.g. Alex Chen"
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Target Role</label>
                  <input
                    type="text"
                    value={resume.targetRole || ''}
                    onChange={(e) => setResume({ ...resume, targetRole: e.target.value })}
                    placeholder="e.g. AI Systems Engineer"
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Email Address</label>
                  <input
                    type="email"
                    value={resume.email || ''}
                    onChange={(e) => setResume({ ...resume, email: e.target.value })}
                    placeholder="alex@example.com"
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Phone</label>
                  <input
                    type="text"
                    value={resume.phone || ''}
                    onChange={(e) => setResume({ ...resume, phone: e.target.value })}
                    placeholder="+1 (555) 019-2834"
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Location</label>
                  <input
                    type="text"
                    value={resume.location || ''}
                    onChange={(e) => setResume({ ...resume, location: e.target.value })}
                    placeholder="San Francisco, CA or Remote"
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">LinkedIn URL</label>
                  <input
                    type="text"
                    value={resume.linkedin || ''}
                    onChange={(e) => setResume({ ...resume, linkedin: e.target.value })}
                    placeholder="linkedin.com/in/alexchen"
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">GitHub URL</label>
                  <input
                    type="text"
                    value={resume.github || ''}
                    onChange={(e) => setResume({ ...resume, github: e.target.value })}
                    placeholder="github.com/alexchen"
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Portfolio / Website</label>
                  <input
                    type="text"
                    value={resume.portfolio || ''}
                    onChange={(e) => setResume({ ...resume, portfolio: e.target.value })}
                    placeholder="alexchen.dev"
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Professional Summary */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Professional Summary
              </h3>
              <textarea
                rows={3}
                value={resume.summary || ''}
                onChange={(e) => setResume({ ...resume, summary: e.target.value })}
                placeholder="High-impact 2-3 sentence overview highlighting your technical strengths and quantified achievements..."
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none leading-relaxed"
              />
            </div>

            {/* Section 3: Skills */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Skills & Technologies
              </h3>

              {/* Technical / Core Skills */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Core Languages & Technologies (e.g. Python, TypeScript, C++)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(resume.skills?.technical || []).map((skill, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center space-x-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-800"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setResume({
                            ...resume,
                            skills: {
                              ...resume.skills,
                              technical: resume.skills?.technical?.filter((_, i) => i !== idx),
                            },
                          })
                        }
                        className="text-slate-400 hover:text-red-500"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  value={techSkillInput}
                  onChange={(e) => setTechSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && techSkillInput.trim()) {
                      e.preventDefault();
                      setResume({
                        ...resume,
                        skills: {
                          ...resume.skills,
                          technical: [...(resume.skills?.technical || []), techSkillInput.trim()],
                        },
                      });
                      setTechSkillInput('');
                    }
                  }}
                  placeholder="Type skill and press Enter"
                  className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Frameworks & Libraries */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Frameworks & Libraries (e.g. React, Node.js, PyTorch)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(resume.skills?.frameworks || []).map((skill, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center space-x-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-800"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setResume({
                            ...resume,
                            skills: {
                              ...resume.skills,
                              frameworks: resume.skills?.frameworks?.filter((_, i) => i !== idx),
                            },
                          })
                        }
                        className="text-slate-400 hover:text-red-500"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  value={frameworkInput}
                  onChange={(e) => setFrameworkInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && frameworkInput.trim()) {
                      e.preventDefault();
                      setResume({
                        ...resume,
                        skills: {
                          ...resume.skills,
                          frameworks: [...(resume.skills?.frameworks || []), frameworkInput.trim()],
                        },
                      });
                      setFrameworkInput('');
                    }
                  }}
                  placeholder="Type framework and press Enter"
                  className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Tools & Infrastructure */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tools & Platforms (e.g. Docker, AWS, Git, Kubernetes)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(resume.skills?.tools || []).map((skill, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center space-x-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-800"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setResume({
                            ...resume,
                            skills: {
                              ...resume.skills,
                              tools: resume.skills?.tools?.filter((_, i) => i !== idx),
                            },
                          })
                        }
                        className="text-slate-400 hover:text-red-500"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  value={toolInput}
                  onChange={(e) => setToolInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && toolInput.trim()) {
                      e.preventDefault();
                      setResume({
                        ...resume,
                        skills: {
                          ...resume.skills,
                          tools: [...(resume.skills?.tools || []), toolInput.trim()],
                        },
                      });
                      setToolInput('');
                    }
                  }}
                  placeholder="Type tool and press Enter"
                  className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Section 4: Experience */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Work Experience
                </h3>
                <button
                  type="button"
                  onClick={addExperience}
                  className="flex items-center space-x-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Role</span>
                </button>
              </div>

              {(resume.experience || []).map((exp, expIdx) => (
                <div
                  key={exp.id || expIdx}
                  className="rounded-lg border border-slate-200 p-4 space-y-3 bg-slate-50/50"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700">Role #{expIdx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeExperience(expIdx)}
                      className="text-slate-400 hover:text-red-600"
                      title="Remove Role"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      placeholder="Role Title (e.g. Senior Systems Architect)"
                      value={exp.role}
                      onChange={(e) => updateExperience(expIdx, 'role', e.target.value)}
                      className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none font-medium"
                    />
                    <input
                      type="text"
                      placeholder="Company Name"
                      value={exp.company}
                      onChange={(e) => updateExperience(expIdx, 'company', e.target.value)}
                      className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="Start Date (e.g. 2021)"
                        value={exp.startDate || ''}
                        onChange={(e) => updateExperience(expIdx, 'startDate', e.target.value)}
                        className="w-1/2 rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="End Date (or Present)"
                        value={exp.endDate || ''}
                        onChange={(e) => updateExperience(expIdx, 'endDate', e.target.value)}
                        className="w-1/2 rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Location (e.g. San Francisco, CA)"
                      value={exp.location || ''}
                      onChange={(e) => updateExperience(expIdx, 'location', e.target.value)}
                      className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* Bullet points */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                      <span>Bullet Points (XYZ format)</span>
                      <button
                        type="button"
                        onClick={() => addExperienceBullet(expIdx)}
                        className="text-blue-600 hover:text-blue-800 text-[11px]"
                      >
                        + Add Bullet
                      </button>
                    </div>
                    {(exp.bulletPoints || []).map((bullet, bIdx) => (
                      <div key={bIdx} className="flex items-center space-x-1.5">
                        <textarea
                          rows={2}
                          value={bullet}
                          onChange={(e) => updateExperienceBullet(expIdx, bIdx, e.target.value)}
                          placeholder="Accomplished [X] as measured by [Y] by doing [Z]..."
                          className="flex-1 rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                        />
                        {(exp.bulletPoints || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeExperienceBullet(expIdx, bIdx)}
                            className="text-slate-400 hover:text-red-500 p-1"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Section 5: Projects */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Projects
                </h3>
                <button
                  type="button"
                  onClick={addProject}
                  className="flex items-center space-x-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Project</span>
                </button>
              </div>

              {(resume.projects || []).map((proj, pIdx) => (
                <div
                  key={proj.id || pIdx}
                  className="rounded-lg border border-slate-200 p-3.5 space-y-2 bg-slate-50/50"
                >
                  <div className="flex justify-between items-center">
                    <input
                      type="text"
                      placeholder="Project Name"
                      value={proj.name}
                      onChange={(e) => {
                        const updated = [...(resume.projects || [])];
                        updated[pIdx].name = e.target.value;
                        setResume({ ...resume, projects: updated });
                      }}
                      className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => removeProject(pIdx)}
                      className="text-slate-400 hover:text-red-600 ml-2"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Technologies (comma-separated, e.g. Python, PyTorch, Docker)"
                    value={(proj.technologies || []).join(', ')}
                    onChange={(e) => {
                      const updated = [...(resume.projects || [])];
                      updated[pIdx].technologies = e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean);
                      setResume({ ...resume, projects: updated });
                    }}
                    className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />

                  <textarea
                    rows={2}
                    placeholder="Project description and key outcomes..."
                    value={(proj.bulletPoints || []).join('\n')}
                    onChange={(e) => {
                      const updated = [...(resume.projects || [])];
                      updated[pIdx].bulletPoints = e.target.value.split('\n').filter(Boolean);
                      setResume({ ...resume, projects: updated });
                    }}
                    className="w-full rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>

            {/* Section 6: Education */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Education
                </h3>
                <button
                  type="button"
                  onClick={addEducation}
                  className="flex items-center space-x-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Degree</span>
                </button>
              </div>

              {(resume.education || []).map((edu, eIdx) => (
                <div
                  key={edu.id || eIdx}
                  className="rounded-lg border border-slate-200 p-3.5 space-y-2.5 bg-slate-50/50"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700">Degree #{eIdx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeEducation(eIdx)}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      placeholder="University / College"
                      value={edu.institution}
                      onChange={(e) => {
                        const updated = [...(resume.education || [])];
                        updated[eIdx].institution = e.target.value;
                        setResume({ ...resume, education: updated });
                      }}
                      className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none font-medium"
                    />
                    <input
                      type="text"
                      placeholder="Degree & Major (e.g. B.S. in Computer Science)"
                      value={edu.degree}
                      onChange={(e) => {
                        const updated = [...(resume.education || [])];
                        updated[eIdx].degree = e.target.value;
                        setResume({ ...resume, education: updated });
                      }}
                      className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Graduation Year (e.g. 2020)"
                      value={edu.endDate || ''}
                      onChange={(e) => {
                        const updated = [...(resume.education || [])];
                        updated[eIdx].endDate = e.target.value;
                        setResume({ ...resume, education: updated });
                      }}
                      className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="GPA / Honors (e.g. 3.9 GPA)"
                      value={edu.grade || ''}
                      onChange={(e) => {
                        const updated = [...(resume.education || [])];
                        updated[eIdx].grade = e.target.value;
                        setResume({ ...resume, education: updated });
                      }}
                      className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Section 7: Certifications */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Certifications
                </h3>
                <button
                  type="button"
                  onClick={addCertification}
                  className="flex items-center space-x-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Certification</span>
                </button>
              </div>

              {(resume.certifications || []).map((cert, cIdx) => (
                <div
                  key={cIdx}
                  className="rounded-lg border border-slate-200 p-3.5 space-y-2 bg-slate-50/50"
                >
                  <div className="flex justify-between items-center">
                    <input
                      type="text"
                      placeholder="Certification Title (e.g. AWS Certified Solutions Architect)"
                      value={cert.name}
                      onChange={(e) => {
                        const updated = [...(resume.certifications || [])];
                        updated[cIdx].name = e.target.value;
                        setResume({ ...resume, certifications: updated });
                      }}
                      className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => removeCertification(cIdx)}
                      className="text-slate-400 hover:text-red-600 ml-2"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      placeholder="Issuing Organization (e.g. Amazon Web Services)"
                      value={cert.issuer || ''}
                      onChange={(e) => {
                        const updated = [...(resume.certifications || [])];
                        updated[cIdx].issuer = e.target.value;
                        setResume({ ...resume, certifications: updated });
                      }}
                      className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Year / Date (e.g. 2023)"
                      value={cert.date || ''}
                      onChange={(e) => {
                        const updated = [...(resume.certifications || [])];
                        updated[cIdx].date = e.target.value;
                        setResume({ ...resume, certifications: updated });
                      }}
                      className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Generate Button */}
            <div className="pt-2 pb-6 flex justify-end">
              <button
                type="button"
                onClick={() => handleGenerateResume()}
                disabled={isProcessing}
                className="flex items-center space-x-2 rounded-xl bg-blue-600 px-6 py-3 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                <span>Generate & Compile Resume</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
