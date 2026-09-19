import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Sparkles,
  ArrowRight,
  FileDown,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Layers,
} from 'lucide-react';
import type { ResumeData, JobOptimizationResult, JobListing, TemplateId } from '../../types';
import { getResumes, getSavedJobs, sendChatMessage } from '../../services/api';
import { exportResumePdf, downloadLatexFile } from '../../services/pdfExport';

interface JobOptimizationViewProps {
  initialJob?: Partial<JobListing>;
  onOpenInBuilder: (resumeData: ResumeData) => void;
}

export const JobOptimizationView: React.FC<JobOptimizationViewProps> = ({
  initialJob,
  onOpenInBuilder,
}) => {
  const [resumes, setResumes] = useState<ResumeData[]>([]);
  const [savedJobs, setSavedJobs] = useState<JobListing[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [jobText, setJobText] = useState<string>(
    initialJob
      ? `${initialJob.title} at ${initialJob.company}\n${initialJob.snippet || ''}\nRequired Skills: ${(initialJob.skills || []).join(', ')}`
      : ''
  );
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [result, setResult] = useState<JobOptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('modern');

  useEffect(() => {
    getResumes().then((list) => {
      setResumes(list);
      if (list.length > 0 && !selectedResumeId) {
        setSelectedResumeId(list[0].id || '');
      }
    });
    getSavedJobs().then((jobs) => setSavedJobs(jobs.map((s) => s.job)));
  }, []);

  const handleOptimize = async () => {
    if (!jobText.trim()) {
      setError('Please provide a job description or select a saved job.');
      return;
    }
    const chosenResume = resumes.find((r) => r.id === selectedResumeId);
    if (!chosenResume) {
      setError('Please select or create a resume first.');
      return;
    }

    setIsOptimizing(true);
    setError(null);

    try {
      const prompt = `Optimize my resume for this specific job position:\n\n${jobText}`;
      const res = await sendChatMessage({
        message: prompt,
        useHighThinking: true,
      });

      if (res.message.meta?.jobOptimization) {
        setResult(res.message.meta.jobOptimization);
      } else {
        setError('Could not complete job optimization. Please ensure your resume has experience or skills listed.');
      }
    } catch (err: any) {
      setError(err.message || 'Job optimization failed');
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Job-Specific Resume Optimization
          </h2>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Align your CV with a specific job posting. Gemini analyzes matching skills, highlights
            relevant achievements, and reframes bullet points using high-impact action verbs without fabricating claims.
          </p>
        </div>

        {/* Configuration Box */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Resume Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Base Resume
              </label>
              {resumes.length === 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  No saved resumes found. Upload or build a resume first in Career Chat or Resume Builder.
                </div>
              ) : (
                <select
                  value={selectedResumeId}
                  onChange={(e) => setSelectedResumeId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title || r.name} ({r.targetRole || 'General'})
                    </option>
                  ))}
                </select>
              )}

              {/* Quick Pick from Saved Jobs */}
              {savedJobs.length > 0 && (
                <div className="mt-4">
                  <span className="text-[11px] font-semibold text-slate-500">
                    Quick Pick from Saved Jobs:
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {savedJobs.map((j) => (
                      <button
                        key={j.id}
                        type="button"
                        onClick={() =>
                          setJobText(
                            `${j.title} at ${j.company}\nLocation: ${j.location}\nRequired Skills: ${(j.skills || []).join(', ')}\n${j.snippet || ''}`
                          )
                        }
                        className="rounded-md bg-slate-100 hover:bg-blue-50 px-2 py-1 text-[11px] text-slate-700 hover:text-blue-700 border border-slate-200 transition-colors truncate max-w-[200px]"
                      >
                        {j.title} ({j.company})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Job Description Text Area */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Job Description
              </label>
              <textarea
                rows={6}
                value={jobText}
                onChange={(e) => setJobText(e.target.value)}
                placeholder="Paste the full job description or key requirements here..."
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none leading-relaxed"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
              {error}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              onClick={handleOptimize}
              disabled={isOptimizing || resumes.length === 0}
              className="flex items-center space-x-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isOptimizing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Optimizing with Gemini 3.1 Pro...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Generate Tailored Resume</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Optimization Result for
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    {result.targetJobTitle}{' '}
                    {result.targetCompany && (
                      <span className="text-slate-500 font-normal">at {result.targetCompany}</span>
                    )}
                  </h3>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <span className="text-[11px] font-medium text-slate-400">Match Score</span>
                    <div className="text-2xl font-extrabold text-blue-600 leading-none">
                      {result.matchScore}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Skills Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg bg-emerald-50/60 border border-emerald-100 p-3.5 space-y-2">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-800 uppercase">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Matching Skills You Possess</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.matchingSkills.map((s, i) => (
                      <span
                        key={i}
                        className="rounded bg-white px-2 py-0.5 text-xs font-medium text-emerald-800 border border-emerald-200"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg bg-amber-50/60 border border-amber-100 p-3.5 space-y-2">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-800 uppercase">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <span>Missing or Additional Skills Needed</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.missingSkills.length > 0 ? (
                      result.missingSkills.map((s, i) => (
                        <span
                          key={i}
                          className="rounded bg-white px-2 py-0.5 text-xs font-medium text-amber-800 border border-amber-200"
                        >
                          {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">
                        No critical skill gaps detected for this role!
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bullet Refinements */}
              {result.tailoredBulletPoints && result.tailoredBulletPoints.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Refined High-Impact Bullet Points (Before vs After)
                  </h4>
                  <div className="space-y-3">
                    {result.tailoredBulletPoints.map((item, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-slate-200 p-3 space-y-1.5 bg-slate-50/50 text-xs"
                      >
                        <div className="text-slate-500 line-through">
                          <span className="font-semibold text-slate-400 mr-1.5">Original:</span>
                          {item.original}
                        </div>
                        <div className="text-slate-900 font-medium">
                          <span className="font-bold text-blue-600 mr-1.5">Tailored:</span>
                          {item.improved}
                        </div>
                        <div className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-100">
                          Why: {item.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tailored Resume Export Actions */}
              {result.tailoredResume && (
                <div className="border-t border-slate-100 pt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-500">Export Template:</span>
                    <select
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value as TemplateId)}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800"
                    >
                      <option value="ats_minimal">1. ATS Minimal</option>
                      <option value="modern">2. Modern</option>
                      <option value="ai_engineer">3. AI Engineer</option>
                      <option value="fresher">4. Fresher</option>
                      <option value="corporate">5. Corporate</option>
                    </select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onOpenInBuilder(result.tailoredResume!)}
                      className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                    >
                      <Layers className="h-3.5 w-3.5" />
                      <span>Open in Builder</span>
                    </button>

                    <button
                      onClick={() => exportResumePdf(result.tailoredResume!, selectedTemplate)}
                      className="flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700"
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      <span>Export Tailored PDF</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
