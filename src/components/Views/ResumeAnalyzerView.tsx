import React, { useState } from 'react';
import {
  Upload,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Loader2,
  BrainCircuit,
} from 'lucide-react';
import type { ResumeAnalysis, Attachment, ResumeData } from '../../types';
import { uploadFile, sendChatMessage } from '../../services/api';

interface ResumeAnalyzerViewProps {
  onOpenInChat: (message: string, attachments?: Attachment[]) => void;
  onOpenInBuilder: (resumeData: ResumeData) => void;
}

export const ResumeAnalyzerView: React.FC<ResumeAnalyzerViewProps> = ({
  onOpenInChat,
  onOpenInBuilder,
}) => {
  const [pastedText, setPastedText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ResumeAnalysis | null>(null);
  const [extractedResume, setExtractedResume] = useState<ResumeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const file = files[0];
      const uploaded = await uploadFile(file);
      setAttachments([uploaded]);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'File upload failed');
    }
  };

  const handleAnalyze = async () => {
    if (!pastedText.trim() && attachments.length === 0) {
      setError('Please provide resume text or upload a document first.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const res = await sendChatMessage({
        message: pastedText ? `Analyze this resume:\n\n${pastedText}` : 'Analyze my attached resume.',
        attachments,
        useHighThinking: true,
      });

      if (res.message.meta?.analysis) {
        setAnalysisResult(res.message.meta.analysis);
      }
      if (res.conversation.activeResumeData) {
        setExtractedResume(res.conversation.activeResumeData);
      }
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            AI Resume Analyzer & ATS Audit
          </h2>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Upload your resume or paste its text. Our AI analyzes structure, quantifiability, impact,
            and provides an objective AI Resume Quality Score out of 100.
          </p>
        </div>

        {/* Input Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Upload Box */}
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 p-6 text-center hover:border-blue-400 bg-slate-50/50 transition-colors">
              <Upload className="h-8 w-8 text-blue-600 mb-2" />
              <div className="text-xs font-semibold text-slate-800">
                Upload Resume Document
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                PDF, DOCX, TXT, or Image (Max 15MB)
              </p>
              <input
                type="file"
                id="analyzer-file-input"
                accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => document.getElementById('analyzer-file-input')?.click()}
                className="mt-3 rounded-md bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                Select File
              </button>

              {attachments.length > 0 && (
                <div className="mt-3 flex items-center space-x-1.5 rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-700 font-medium border border-blue-100">
                  <FileText className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[160px]">{attachments[0].name}</span>
                </div>
              )}
            </div>

            {/* Paste Box */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-700 mb-1">
                Or Paste Resume Text
              </label>
              <textarea
                rows={6}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste experience, projects, education or full text here..."
                className="w-full flex-1 rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
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
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="flex items-center space-x-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Evaluating with Gemini 3.1 Pro...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Run Complete Analysis</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results Presentation */}
        {analysisResult && (
          <div className="space-y-6">
            {/* Scorecard */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Evaluation Result
                  </span>
                  <div className="flex items-baseline space-x-3 mt-1">
                    <span className="text-4xl font-extrabold text-blue-600">
                      {analysisResult.resumeQualityScore}
                    </span>
                    <span className="text-lg font-bold text-slate-400">/ 100</span>
                    <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                      AI Resume Quality Score
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    *Note: Evaluates phrasing, quantifiability, and section structure. Not an official ATS score.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  {extractedResume && (
                    <button
                      onClick={() => onOpenInBuilder(extractedResume)}
                      className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                    >
                      <span>Edit in Resume Builder</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() =>
                      onOpenInChat(
                        'Based on the resume analysis score, please suggest the best career domains and jobs for me.'
                      )
                    }
                    className="flex items-center space-x-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-slate-800"
                  >
                    <span>Discuss in Chat</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Breakdown Grid */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Strengths */}
                <div className="rounded-lg bg-emerald-50/50 border border-emerald-100 p-4 space-y-2">
                  <div className="flex items-center space-x-2 text-xs font-bold text-emerald-800 uppercase tracking-wide">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Identified Strengths</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {analysisResult.strengths.map((s, i) => (
                      <li key={i} className="flex items-start space-x-1.5">
                        <span className="text-emerald-500 font-bold">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Weaknesses */}
                <div className="rounded-lg bg-amber-50/50 border border-amber-100 p-4 space-y-2">
                  <div className="flex items-center space-x-2 text-xs font-bold text-amber-800 uppercase tracking-wide">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span>Improvement Areas</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {analysisResult.weaknesses.map((w, i) => (
                      <li key={i} className="flex items-start space-x-1.5">
                        <span className="text-amber-500 font-bold">•</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* ATS Recommendations */}
              <div className="mt-6 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  ATS & Formatting Recommendations
                </h4>
                <div className="space-y-1.5">
                  {analysisResult.atsSuggestions.map((rec, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-slate-100 bg-slate-50 p-2.5 text-xs text-slate-700"
                    >
                      {rec}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
