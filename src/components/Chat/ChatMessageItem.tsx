import React, { useState } from 'react';
import {
  Sparkles,
  User,
  BrainCircuit,
  FileDown,
  FileText,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Briefcase,
  Bookmark,
  Check,
  ChevronRight,
  FileCode,
  Layers,
  ArrowRight,
  Copy,
  MessageSquare,
  HelpCircle,
  TrendingUp,
  Award,
  BookOpen,
  Globe,
  Compass,
  MapPin,
} from 'lucide-react';
import type { ChatMessage, JobListing, TemplateId } from '../../types';
import { exportResumePdf, downloadLatexFile } from '../../services/pdfExport';
import { saveJob } from '../../services/api';

interface ChatMessageItemProps {
  message: ChatMessage;
  onSelectJobForOptimization: (job: JobListing) => void;
  onOpenResumeInBuilder: (resumeData: any) => void;
  onSendMessage?: (text: string) => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  onSelectJobForOptimization,
  onOpenResumeInBuilder,
  onSendMessage,
}) => {
  const isUser = message.role === 'user';
  const meta = message.meta;
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('modern');
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [copiedCoverLetter, setCopiedCoverLetter] = useState(false);
  const [expandedJobs, setExpandedJobs] = useState(false);
  const [activeProviderFilter, setActiveProviderFilter] = useState<string>('all');

  const handleSaveJob = async (job: JobListing) => {
    try {
      await saveJob(job);
      setSavedJobIds((prev) => new Set([...prev, job.id]));
    } catch (err) {
      console.error('Failed to save job:', err);
    }
  };

  const handleCopyCoverLetter = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCoverLetter(true);
    setTimeout(() => setCopiedCoverLetter(false), 2000);
  };

  const handleDownloadCoverLetter = (title: string, text: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.toLowerCase().replace(/\s+/g, '_')}_cover_letter.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={`group flex w-full py-5 px-4 sm:px-6 transition-colors ${
        isUser
          ? 'bg-white dark:bg-slate-900'
          : 'bg-slate-50/80 dark:bg-slate-900/60 border-y border-slate-100/80 dark:border-slate-800/80'
      }`}
    >
      <div className="mx-auto flex w-full max-w-4xl space-x-3.5 sm:space-x-4">
        {/* Avatar */}
        <div className="shrink-0 pt-0.5">
          {isUser ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs shadow-2xs">
              <User className="h-4 w-4" />
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white font-medium text-xs shadow-xs">
              <Sparkles className="h-4 w-4" />
            </div>
          )}
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0 space-y-3.5">
          {/* Header row with Intent Tag & Thinking Tag */}
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {isUser ? 'You' : 'AI Career Agent'}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>

            {meta?.usedThinkingMode && (
              <span className="inline-flex items-center space-x-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                <BrainCircuit className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                <span>Deep Reasoning</span>
              </span>
            )}

            {meta?.intents && meta.intents.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {meta.intents.map((intent) => (
                  <span
                    key={intent}
                    className="rounded-md bg-slate-200/70 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300 capitalize"
                  >
                    {intent.replace('_', ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* User Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {message.attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center space-x-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 shadow-2xs"
                >
                  <FileCode className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium truncate max-w-[200px]">{att.name}</span>
                  <span className="text-[10px] text-slate-400">
                    ({(att.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Text Message Body with clean styling */}
          <div className="prose prose-sm max-w-none text-slate-800 dark:text-slate-200 space-y-2 whitespace-pre-wrap leading-relaxed text-sm">
            {message.content}
          </div>

          {/* INTERACTIVE COMPONENT 1: Resume Quality Scorecard */}
          {meta?.analysis && (
            <div className="rounded-xl border border-blue-100 dark:border-slate-800 bg-white dark:bg-slate-850 p-4 shadow-2xs mt-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    AI Resume Quality Score
                  </div>
                  <div className="flex items-baseline space-x-2 mt-0.5">
                    <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                      {meta.analysis.resumeQualityScore}
                    </span>
                    <span className="text-sm font-semibold text-slate-400">/ 100</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                    <div className="text-slate-400 text-[10px]">Impact</div>
                    <div className="font-bold text-slate-700 dark:text-slate-200">
                      {meta.analysis.scoreBreakdown?.impact ?? 20}/25
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                    <div className="text-slate-400 text-[10px]">Brevity</div>
                    <div className="font-bold text-slate-700 dark:text-slate-200">
                      {meta.analysis.scoreBreakdown?.brevity ?? 20}/25
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                    <div className="text-slate-400 text-[10px]">Structure</div>
                    <div className="font-bold text-slate-700 dark:text-slate-200">
                      {meta.analysis.scoreBreakdown?.structure ?? 20}/25
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                    <div className="text-slate-400 text-[10px]">Skills Match</div>
                    <div className="font-bold text-slate-700 dark:text-slate-200">
                      {meta.analysis.scoreBreakdown?.skillsRelevance ?? 18}/25
                    </div>
                  </div>
                </div>
              </div>

              {/* Identified Skills Pills */}
              {meta.analysis.identifiedSkills && meta.analysis.identifiedSkills.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Identified Competencies:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {meta.analysis.identifiedSkills.slice(0, 10).map((skill, idx) => (
                      <span
                        key={idx}
                        className="rounded-md bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/40"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* INTERACTIVE COMPONENT 2: Real Job Cards */}
          {meta?.jobResults && meta.jobResults.jobs.length > 0 && (() => {
            const allJobs = meta.jobResults.jobs;
            const providers = Array.from(new Set(allJobs.map((j) => j.provider).filter(Boolean)));
            const filteredJobs = activeProviderFilter === 'all'
              ? allJobs
              : allJobs.filter((j) => j.provider === activeProviderFilter);
            const displayedJobs = expandedJobs ? filteredJobs : filteredJobs.slice(0, 6);
            const isExplore = meta.jobResults.mode === 'explore';
            const locationScope = meta.jobResults.activeLocationScope;

            return (
              <div className="mt-3 space-y-3">
                {/* Header bar with Mode, Scope and Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      {isExplore ? <Compass className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> : <Award className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
                      {isExplore ? 'Explore Live Jobs' : 'Recommended For You'}
                    </span>
                    {locationScope && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                        <MapPin className="h-3 w-3 text-slate-500" />
                        {locationScope}
                      </span>
                    )}
                    {onSendMessage && (
                      locationScope === 'Worldwide' ? (
                        <button
                          type="button"
                          onClick={() => onSendMessage('Search jobs in India')}
                          className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition-colors cursor-pointer"
                        >
                          🇮🇳 Switch to India Scope
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSendMessage('Explore Worldwide')}
                          className="px-2.5 py-0.5 rounded-full text-[11px] bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Globe className="h-3 w-3" />
                          Explore Worldwide
                        </button>
                      )
                    )}
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      ({filteredJobs.length} {filteredJobs.length === 1 ? 'position' : 'positions'})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Verified Live
                    </span>
                  </div>
                </div>

                {/* Multi-Provider Filter Chips */}
                {providers.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mr-1">Source:</span>
                    <button
                      type="button"
                      onClick={() => setActiveProviderFilter('all')}
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                        activeProviderFilter === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      All ({allJobs.length})
                    </button>
                    {providers.map((p) => {
                      const count = allJobs.filter((j) => j.provider === p).length;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setActiveProviderFilter(p)}
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                            activeProviderFilter === p
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {p} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Job Cards Grid */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {displayedJobs.map((job) => {
                    const isSaved = savedJobIds.has(job.id);
                    const externalUrl = job.applyUrl || job.jobUrl;

                    return (
                      <div
                        key={job.id}
                        className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 p-4 shadow-2xs hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                              {job.title}
                            </h4>
                            {job.matchScore && (
                              <span className="shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                {job.matchScore}% Match
                              </span>
                            )}
                          </div>

                          <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {job.company}
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <span>{job.location}</span>
                            {job.remote && (
                              <span className="rounded bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
                                Remote
                              </span>
                            )}
                            <span className="rounded bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              Live • {job.provider || 'Verified'}
                            </span>
                          </div>

                          {job.skills && job.skills.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {job.skills.slice(0, 4).map((s, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}

                          {job.whyMatches && job.whyMatches.length > 0 && (
                            <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="font-semibold text-slate-600 dark:text-slate-300">
                                Match details:{' '}
                              </span>
                              {job.whyMatches.join(', ')}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            {/* Real Apply Button (Opens in new browser tab) */}
                            {externalUrl ? (
                              <a
                                href={externalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors"
                              >
                                <span>Apply Now</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">Direct Apply Unavailable</span>
                            )}

                            <div className="flex items-center gap-1.5">
                              {/* Save Job */}
                              <button
                                onClick={() => handleSaveJob(job)}
                                className={`p-1.5 rounded-lg border text-xs transition-colors ${
                                  isSaved
                                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border-slate-200 dark:border-slate-700'
                                }`}
                                title={isSaved ? 'Job Saved' : 'Save Job'}
                              >
                                <Bookmark className={`h-3.5 w-3.5 ${isSaved ? 'fill-current' : ''}`} />
                              </button>

                              {/* View Match Details in Chat */}
                              {onSendMessage && (
                                <button
                                  onClick={() =>
                                    onSendMessage(`Show match details for job: ${job.title}`)
                                  }
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
                                  title="View detailed match analysis"
                                >
                                  View Details
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Secondary Actions: Tailor resume, Cover Letter, Interview Prep */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                            <button
                              onClick={() => onSelectJobForOptimization(job)}
                              className="text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1"
                            >
                              <Sparkles className="h-3 w-3" />
                              Optimize Resume
                            </button>
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            {onSendMessage && (
                              <>
                                <button
                                  onClick={() =>
                                    onSendMessage(
                                      `Generate cover letter for ${job.title} at ${job.company}`
                                    )
                                  }
                                  className="text-purple-600 dark:text-purple-400 hover:underline font-medium"
                                >
                                  Cover Letter
                                </button>
                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                <button
                                  onClick={() =>
                                    onSendMessage(
                                      `Prepare me for interview for ${job.title} at ${job.company}`
                                    )
                                  }
                                  className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                                >
                                  Interview Prep
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination / Expand and Explore Suggestions Footer */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {filteredJobs.length > 6 ? (
                    <button
                      type="button"
                      onClick={() => setExpandedJobs(!expandedJobs)}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline text-left"
                    >
                      {expandedJobs ? 'Show fewer openings' : `Show all ${filteredJobs.length} openings`}
                    </button>
                  ) : <div />}

                  {onSendMessage && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">Actions:</span>
                      <button
                        type="button"
                        onClick={() => onSendMessage('Explore Worldwide')}
                        className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[11px] font-semibold border border-blue-200 dark:border-blue-800 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Globe className="h-3 w-3" />
                        Explore Worldwide
                      </button>
                      <button
                        type="button"
                        onClick={() => onSendMessage('Search all India jobs')}
                        className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        🇮🇳 All India Jobs
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* INTERACTIVE COMPONENT 3: Dedicated Job Match Detail View */}
          {meta?.jobMatch && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 p-4 shadow-xs mt-3 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Match Breakdown: {meta.jobMatch.jobTitle}
                    </h4>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {meta.jobMatch.company}
                    </span>
                  </div>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {meta.jobMatch.overallScore}%
                  </span>
                  <span className="text-xs font-medium text-slate-400">match</span>
                </div>
              </div>

              {/* Matched Skills vs Missing Skills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Matching Skills ({meta.jobMatch.matchingSkills.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {meta.jobMatch.matchingSkills.map((s, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-white dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-medium shadow-2xs border border-emerald-200/50"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-50/60 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-100 dark:border-amber-900/40">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 mb-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    Missing or Gaps ({meta.jobMatch.missingSkills.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {meta.jobMatch.missingSkills.map((s, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-white dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-medium shadow-2xs border border-amber-200/50"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Relevance ratings & Missing Keywords */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                  <span className="text-slate-400 dark:text-slate-500 block text-[10px]">
                    Experience Relevance
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {meta.jobMatch.experienceRelevance}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                  <span className="text-slate-400 dark:text-slate-500 block text-[10px]">
                    Education Relevance
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {meta.jobMatch.educationRelevance}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                  <span className="text-slate-400 dark:text-slate-500 block text-[10px]">
                    Missing Keywords
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {meta.jobMatch.missingKeywords?.slice(0, 3).join(', ') || 'None identified'}
                  </span>
                </div>
              </div>

              {/* Recommendations */}
              {meta.jobMatch.recommendations && meta.jobMatch.recommendations.length > 0 && (
                <div className="text-xs space-y-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    Tailoring Recommendations:
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
                    {meta.jobMatch.recommendations.map((rec, rIdx) => (
                      <li key={rIdx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action shortcuts */}
              {onSendMessage && (
                <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() =>
                      onSendMessage(
                        `Generate tailored cover letter for ${meta.jobMatch?.jobTitle} at ${meta.jobMatch?.company}`
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-xs font-semibold hover:bg-purple-100 dark:hover:bg-purple-900 transition-colors"
                  >
                    Generate Cover Letter
                  </button>
                  <button
                    onClick={() =>
                      onSendMessage(
                        `Prepare me for interview for ${meta.jobMatch?.jobTitle} at ${meta.jobMatch?.company}`
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
                  >
                    Prepare Interview Questions
                  </button>
                </div>
              )}
            </div>
          )}

          {/* INTERACTIVE COMPONENT 4: Dedicated Cover Letter View */}
          {meta?.coverLetter && (
            <div className="rounded-xl border border-purple-200 dark:border-purple-900/60 bg-white dark:bg-slate-850 p-4 shadow-xs mt-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-100 dark:border-purple-900/40 pb-2.5">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Tailored Cover Letter: {meta.coverLetter.jobTitle}
                    </h4>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {meta.coverLetter.company} • For {meta.coverLetter.candidateName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      handleCopyCoverLetter(meta.coverLetter?.coverLetterText || '')
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    {copiedCoverLetter ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Letter</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() =>
                      handleDownloadCoverLetter(
                        `${meta.coverLetter?.jobTitle}_${meta.coverLetter?.company}`,
                        meta.coverLetter?.coverLetterText || ''
                      )
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    <span>Download (.txt)</span>
                  </button>
                </div>
              </div>

              {meta.coverLetter.keyHighlights && meta.coverLetter.keyHighlights.length > 0 && (
                <div className="text-xs bg-purple-50/50 dark:bg-purple-950/30 p-2.5 rounded-lg border border-purple-100 dark:border-purple-900/30">
                  <span className="font-semibold text-purple-900 dark:text-purple-300 block mb-1">Key Application Highlights:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-purple-800 dark:text-purple-300/90">
                    {meta.coverLetter.keyHighlights.map((h, hIdx) => (
                      <li key={hIdx}>{h}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-xs space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed font-serif bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-lg border border-slate-100 dark:border-slate-700/50 whitespace-pre-wrap">
                {meta.coverLetter.coverLetterText}
              </div>
            </div>
          )}

          {/* INTERACTIVE COMPONENT 5: Dedicated Interview Prep Guide */}
          {meta?.interviewPrep && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-white dark:bg-slate-850 p-4 shadow-xs mt-3 space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-100 dark:border-emerald-900/40 pb-2.5">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Interview Preparation Guide
                    </h4>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {meta.interviewPrep.jobTitle} {meta.interviewPrep.company ? `at ${meta.interviewPrep.company}` : ''}
                    </span>
                  </div>
                </div>
              </div>

              {meta.interviewPrep.roleOverview && (
                <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-emerald-50/40 dark:bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-100/60 dark:border-emerald-900/30">
                  {meta.interviewPrep.roleOverview}
                </p>
              )}

              {/* Technical Questions */}
              {meta.interviewPrep.technicalQuestions && meta.interviewPrep.technicalQuestions.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
                    Top Technical Questions & Recommended Approach:
                  </h5>
                  <div className="space-y-2">
                    {meta.interviewPrep.technicalQuestions.map((q, qIdx) => (
                      <div
                        key={qIdx}
                        className="text-xs p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700"
                      >
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {qIdx + 1}. {q.question}
                        </div>
                        {q.context && (
                          <div className="text-slate-500 dark:text-slate-400 mt-1 text-[11px]">
                            <span className="font-medium">Context: </span>
                            {q.context}
                          </div>
                        )}
                        <div className="text-slate-600 dark:text-slate-300 mt-1 pl-3 border-l-2 border-blue-400">
                          <span className="font-medium text-slate-700 dark:text-slate-200">Recommended Approach: </span>
                          {q.recommendedApproach}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Behavioral Questions */}
              {meta.interviewPrep.behavioralQuestions && meta.interviewPrep.behavioralQuestions.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <HelpCircle className="h-3.5 w-3.5 text-emerald-600" />
                    Behavioral & STAR Questions:
                  </h5>
                  <div className="space-y-2">
                    {meta.interviewPrep.behavioralQuestions.map((q, qIdx) => (
                      <div
                        key={qIdx}
                        className="text-xs p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700"
                      >
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {qIdx + 1}. {q.question}
                        </div>
                        {q.competency && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100/70 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                            Competency: {q.competency}
                          </span>
                        )}
                        <div className="text-slate-600 dark:text-slate-300 mt-1.5 pl-3 border-l-2 border-emerald-400">
                          <span className="font-medium text-slate-700 dark:text-slate-200">STAR Advice: </span>
                          {q.starAdvice}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resume Specific Questions */}
              {meta.interviewPrep.resumeSpecificQuestions && meta.interviewPrep.resumeSpecificQuestions.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-purple-600" />
                    Resume-Specific Questions They May Ask You:
                  </h5>
                  <div className="space-y-2">
                    {meta.interviewPrep.resumeSpecificQuestions.map((q, qIdx) => (
                      <div
                        key={qIdx}
                        className="text-xs p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700"
                      >
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {q.question}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 mt-0.5 text-[11px]">
                          Based on: {q.basedOn}
                        </div>
                        <div className="text-slate-600 dark:text-slate-300 mt-1 pl-3 border-l-2 border-purple-400">
                          <span className="font-medium text-slate-700 dark:text-slate-200">Tip: </span>
                          {q.tip}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preparation Topics */}
              {meta.interviewPrep.preparationTopics && meta.interviewPrep.preparationTopics.length > 0 && (
                <div className="text-xs p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">Key Revision Topics:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {meta.interviewPrep.preparationTopics.map((topic, tIdx) => (
                      <span
                        key={tIdx}
                        className="px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px]"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* INTERACTIVE COMPONENT 6: Tailored Resume Download & Template Switcher */}
          {(meta?.jobOptimization?.tailoredResume || meta?.resumeData) && (
            <div className="rounded-xl border border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-850 p-4 shadow-2xs mt-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <div className="flex items-center space-x-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-white">
                    <FileDown className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Generated Resume Ready for Export
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Export in LaTeX source (.tex) or generate a clean print PDF.
                    </p>
                  </div>
                </div>

                {/* Template Selector */}
                <div className="flex items-center space-x-1.5 text-xs">
                  <span className="text-slate-400 text-[11px]">Template:</span>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value as TemplateId)}
                    className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:border-blue-500 focus:outline-hidden"
                  >
                    <option value="ats_minimal">1. ATS Minimal</option>
                    <option value="modern">2. Modern</option>
                    <option value="ai_engineer">3. AI Engineer</option>
                    <option value="fresher">4. Fresher</option>
                    <option value="corporate">5. Corporate</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={() => {
                    const resumeToExport =
                      meta?.jobOptimization?.tailoredResume || meta?.resumeData;
                    if (resumeToExport) {
                      exportResumePdf(resumeToExport, selectedTemplate);
                    }
                  }}
                  className="flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 transition-colors"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  <span>Download PDF</span>
                </button>

                <button
                  onClick={() => {
                    if (meta.latexCode) {
                      downloadLatexFile(meta.latexCode, `resume_${selectedTemplate}.tex`);
                    }
                  }}
                  className="flex items-center space-x-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                >
                  <FileCode className="h-3.5 w-3.5 text-slate-500" />
                  <span>Download .tex (LaTeX)</span>
                </button>

                <button
                  onClick={() => {
                    const r = meta?.jobOptimization?.tailoredResume || meta?.resumeData;
                    if (r) onOpenResumeInBuilder(r);
                  }}
                  className="flex items-center space-x-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                >
                  <Layers className="h-3.5 w-3.5 text-slate-500" />
                  <span>Open in Builder</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
