import React, { useState, useEffect } from 'react';
import {
  Bookmark,
  ExternalLink,
  Sparkles,
  FileText,
  MessageSquare,
  Trash2,
  Calendar,
  Building,
  MapPin,
  Tag,
  CheckCircle2,
  Clock,
  Briefcase,
  AlertCircle,
  Search,
  Filter,
} from 'lucide-react';
import type { SavedJob, ApplicationStatus, JobListing } from '../../types';
import { getSavedJobs, updateSavedJobStatus, deleteSavedJob, saveJob } from '../../services/api';

interface SavedJobsViewProps {
  onSelectJobForOptimization?: (job: JobListing) => void;
  onOpenInChat?: (prompt: string) => void;
}

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; badgeClass: string; icon: React.ElementType }
> = {
  saved: {
    label: 'Saved',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    icon: Bookmark,
  },
  applied: {
    label: 'Applied',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800',
    icon: Clock,
  },
  interview: {
    label: 'Interview',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800',
    icon: Calendar,
  },
  interviewing: {
    label: 'Interviewing',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800',
    icon: Calendar,
  },
  offer: {
    label: 'Offer Received',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Archived / Rejected',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800',
    icon: AlertCircle,
  },
};

export const SavedJobsView: React.FC<SavedJobsViewProps> = ({
  onSelectJobForOptimization,
  onOpenInChat,
}) => {
  const [jobs, setJobs] = useState<SavedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  const loadJobs = async () => {
    try {
      setLoading(true);
      const data = await getSavedJobs();
      setJobs(data);
    } catch (err) {
      console.error('Failed to load saved jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleStatusChange = async (id: string, newStatus: ApplicationStatus) => {
    try {
      const updated = await updateSavedJobStatus(id, newStatus);
      setJobs((prev) => prev.map((j) => (j.id === id ? updated : j)));
    } catch (err) {
      console.error('Failed to update job status:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSavedJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch (err) {
      console.error('Failed to delete saved job:', err);
    }
  };

  const handleSaveNotes = async (savedJob: SavedJob) => {
    try {
      const updatedJob: SavedJob = {
        ...savedJob,
        notes: notesDraft,
      };
      await saveJob(updatedJob);
      setJobs((prev) => prev.map((j) => (j.id === savedJob.id ? updatedJob : j)));
      setEditingNotesId(null);
    } catch (err) {
      console.error('Failed to save notes:', err);
    }
  };

  const filteredJobs = jobs.filter((item) => {
    const matchesFilter = filterStatus === 'all' || item.status === filterStatus;
    const matchesSearch =
      !searchQuery ||
      item.job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.job.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.job.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <Bookmark className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              Saved Jobs & Application Tracker
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Track your applications, update stages, and tailor resumes or cover letters for each opportunity.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 rounded-full">
              {jobs.length} Total Opportunities
            </span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          <div className="flex flex-wrap gap-1.5 items-center">
            {['all', 'saved', 'applied', 'interview', 'offer', 'rejected'].map((statusKey) => (
              <button
                key={statusKey}
                onClick={() => setFilterStatus(statusKey)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                  filterStatus === statusKey
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {statusKey === 'all' ? 'All Applications' : statusKey}
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search title, company, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Job Listings List */}
        {loading ? (
          <div className="py-20 text-center text-sm text-slate-400">
            <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading your saved applications...
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
            <Bookmark className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              No saved jobs match this filter
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              Search for live openings in Career Chat and click "Save Job" on any listing to track your progress here.
            </p>
            {onOpenInChat && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => onOpenInChat('Explore live jobs')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  <Search className="h-3.5 w-3.5" />
                  Explore Live Jobs
                </button>
                <button
                  onClick={() => onOpenInChat('Search all India jobs')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium"
                >
                  🇮🇳 All India Jobs
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredJobs.map((item) => {
              const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.saved;
              const StatusIcon = config.icon;
              const isEditingNotes = editingNotesId === item.id;
              const externalUrl = item.job.jobUrl || item.job.applyUrl;

              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col gap-4"
                >
                  {/* Top row: Title, Company, Status, and External Link */}
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                          {item.job.title}
                        </h2>
                        {item.job.matchScore && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                            {item.job.matchScore}% Match
                          </span>
                        )}
                        {item.job.remote && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800">
                            Remote
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                          <Building className="h-3.5 w-3.5 text-slate-400" />
                          {item.job.company}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          {item.job.location}
                        </span>
                        {item.job.salary && (
                          <span className="text-slate-600 dark:text-slate-300 font-medium">
                            💰 {item.job.salary}
                          </span>
                        )}
                        <span className="text-slate-400 text-[11px]">
                          Saved on {new Date(item.savedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Status dropdown & delete button */}
                    <div className="flex items-center gap-2 self-start">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <StatusIcon className="h-3.5 w-3.5 text-slate-500" />
                        <select
                          value={item.status}
                          onChange={(e) =>
                            handleStatusChange(item.id, e.target.value as ApplicationStatus)
                          }
                          className="bg-transparent text-slate-800 dark:text-slate-200 font-medium focus:outline-hidden cursor-pointer"
                        >
                          <option value="saved">Saved</option>
                          <option value="applied">Applied</option>
                          <option value="interview">Interview</option>
                          <option value="offer">Offer</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>

                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                        title="Remove from saved jobs"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Skills / snippet */}
                  {item.job.skills && item.job.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {item.job.skills.slice(0, 6).map((skill, sIdx) => (
                        <span
                          key={sIdx}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  {item.job.snippet && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {item.job.snippet}
                    </p>
                  )}

                  {/* Notes Section */}
                  <div className="bg-slate-50 dark:bg-slate-850 rounded-lg p-3 border border-slate-100 dark:border-slate-800 text-xs">
                    {isEditingNotes ? (
                      <div className="space-y-2">
                        <textarea
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          placeholder="Add notes about recruiters, interview rounds, salary expectations..."
                          className="w-full p-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                          rows={3}
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingNotesId(null)}
                            className="px-2.5 py-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveNotes(item)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
                          >
                            Save Note
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-slate-600 dark:text-slate-400 italic">
                          {item.notes ? item.notes : 'No application notes added yet.'}
                        </p>
                        <button
                          onClick={() => {
                            setEditingNotesId(item.id);
                            setNotesDraft(item.notes || '');
                          }}
                          className="text-blue-600 dark:text-blue-400 font-semibold hover:underline shrink-0"
                        >
                          {item.notes ? 'Edit' : '+ Add Note'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons: Apply, Optimize Resume, Cover Letter, Interview Prep */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2">
                      {externalUrl && (
                        <a
                          href={externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                        >
                          <span>Open Job Link</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}

                      {onSelectJobForOptimization && (
                        <button
                          onClick={() => onSelectJobForOptimization(item.job)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-medium transition-colors"
                        >
                          <Sparkles className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                          <span>Optimize Resume</span>
                        </button>
                      )}

                      {onOpenInChat && (
                        <>
                          <button
                            onClick={() =>
                              onOpenInChat(
                                `Generate a tailored cover letter for ${item.job.title} at ${item.job.company}`
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-medium transition-colors"
                          >
                            <FileText className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                            <span>Generate Cover Letter</span>
                          </button>

                          <button
                            onClick={() =>
                              onOpenInChat(
                                `Prepare for interview for ${item.job.title} at ${item.job.company}. Give me technical and behavioral questions.`
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-medium transition-colors"
                          >
                            <MessageSquare className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            <span>Prepare for Interview</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
