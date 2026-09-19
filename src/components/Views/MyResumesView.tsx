import React, { useState, useEffect } from 'react';
import {
  FileText,
  FileDown,
  FileCode,
  Trash2,
  Edit,
  Plus,
  Layers,
  Calendar,
  Sparkles,
} from 'lucide-react';
import type { ResumeData, TemplateId } from '../../types';
import { getResumes, deleteResume, getLatexCode } from '../../services/api';
import { exportResumePdf, downloadLatexFile } from '../../services/pdfExport';

interface MyResumesViewProps {
  onOpenInBuilder: (resume: ResumeData) => void;
  onCreateNewResume: () => void;
}

export const MyResumesView: React.FC<MyResumesViewProps> = ({
  onOpenInBuilder,
  onCreateNewResume,
}) => {
  const [resumes, setResumes] = useState<ResumeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchResumes = async () => {
    setIsLoading(true);
    try {
      const data = await getResumes();
      setResumes(data);
    } catch (err) {
      console.error('Failed to load resumes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchResumes();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this resume?')) return;
    try {
      await deleteResume(id);
      setResumes((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Failed to delete resume:', err);
    }
  };

  const handleDownloadLatex = async (resume: ResumeData, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const latex = await getLatexCode(resume, resume.templateId || 'modern');
      downloadLatexFile(latex, `${(resume.name || 'resume').replace(/\s+/g, '_')}.tex`);
    } catch (err) {
      console.error('LaTeX generation error:', err);
    }
  };

  const handleDownloadPdf = (resume: ResumeData, e: React.MouseEvent) => {
    e.stopPropagation();
    exportResumePdf(resume, resume.templateId || 'modern');
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              My Resumes
            </h2>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              Manage, edit, and export your tailored resumes across ATS Minimal, Modern, AI Engineer,
              Fresher, and Corporate templates.
            </p>
          </div>

          <button
            onClick={onCreateNewResume}
            className="flex items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Resume</span>
          </button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex h-48 items-center justify-center text-xs text-slate-400">
            Loading resumes...
          </div>
        ) : resumes.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
            <Layers className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-3 text-sm font-bold text-slate-900">No resumes saved yet</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              Upload an existing resume in Career Chat, or create one from scratch in Resume Builder.
            </p>
            <button
              onClick={onCreateNewResume}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-slate-800"
            >
              Build Your First Resume
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resumes.map((resume) => (
              <div
                key={resume.id}
                onClick={() => onOpenInBuilder(resume)}
                className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-blue-400 hover:shadow-sm cursor-pointer transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                          {resume.title || resume.name || 'Untitled Resume'}
                        </h4>
                        <span className="text-[11px] font-medium text-slate-500">
                          {resume.targetRole || 'General Profile'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDelete(resume.id!, e)}
                      className="p-1 rounded text-slate-300 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Delete Resume"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Template:</span>
                      <span className="font-semibold text-slate-700 capitalize">
                        {(resume.templateId || 'modern').replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Skills Count:</span>
                      <span className="font-semibold text-slate-700">
                        {(resume.skills?.technical || []).length} technical
                      </span>
                    </div>
                    {resume.lastUpdated && (
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                        <span>Updated:</span>
                        <span>{new Date(resume.lastUpdated).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-100 pt-3 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={(e) => handleDownloadPdf(resume, e)}
                      className="flex items-center space-x-1 rounded-md bg-slate-100 hover:bg-blue-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-blue-700 transition-colors"
                      title="Download PDF"
                    >
                      <FileDown className="h-3 w-3" />
                      <span>PDF</span>
                    </button>

                    <button
                      onClick={(e) => handleDownloadLatex(resume, e)}
                      className="flex items-center space-x-1 rounded-md bg-slate-100 hover:bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition-colors"
                      title="Download LaTeX Source (.tex)"
                    >
                      <FileCode className="h-3 w-3" />
                      <span>.tex</span>
                    </button>
                  </div>

                  <span className="text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform flex items-center space-x-0.5">
                    <span>Edit</span>
                    <Edit className="h-3 w-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
