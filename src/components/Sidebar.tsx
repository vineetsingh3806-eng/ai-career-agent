import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  MessageSquare,
  FileText,
  SearchCheck,
  Briefcase,
  Layers,
  UserCheck,
  Settings,
  Trash2,
  X,
  Compass,
  Bookmark,
  MoreVertical,
  Pencil,
  Check,
} from 'lucide-react';
import type { Conversation } from '../types';

export type ActiveView =
  | 'chat'
  | 'resume_builder'
  | 'resume_analyzer'
  | 'job_optimization'
  | 'saved_jobs'
  | 'my_resumes'
  | 'career_profile';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  conversations: Conversation[];
  activeConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string, e: React.MouseEvent) => void;
  onRenameConversation: (id: string, newTitle: string) => Promise<void> | void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  activeView,
  onSelectView,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onOpenSettings,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    if (menuOpenId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpenId]);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleStartRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpenId(null);
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const handleSaveRename = async (id: string) => {
    const trimmed = editTitle.trim();
    if (trimmed) {
      await onRenameConversation(id, trimmed);
    }
    setEditingId(null);
  };

  const handleCancelRename = () => {
    setEditingId(null);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-xs md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed top-0 bottom-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm shadow-xs">
              <Compass className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                AI Career Agent
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                Career Copilot
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 md:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action: New Chat */}
        <div className="p-3">
          <button
            id="new-chat-btn"
            onClick={() => {
              onNewChat();
              onSelectView('chat');
              onClose();
            }}
            className="flex w-full items-center justify-center space-x-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-750 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
          >
            <Plus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Navigation Content */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
          {/* Career Tools Section */}
          <div>
            <div className="px-2 mb-1.5 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              Career Tools
            </div>
            <nav className="space-y-0.5">
              <button
                id="nav-chat-btn"
                onClick={() => {
                  onSelectView('chat');
                  onClose();
                }}
                className={`flex w-full items-center space-x-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors ${
                  activeView === 'chat'
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <MessageSquare className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                <span>Career Chat</span>
              </button>

              <button
                id="nav-resume-builder-btn"
                onClick={() => {
                  onSelectView('resume_builder');
                  onClose();
                }}
                className={`flex w-full items-center space-x-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors ${
                  activeView === 'resume_builder'
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <FileText className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                <span>Resume Builder</span>
              </button>

              <button
                id="nav-resume-analyzer-btn"
                onClick={() => {
                  onSelectView('resume_analyzer');
                  onClose();
                }}
                className={`flex w-full items-center space-x-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors ${
                  activeView === 'resume_analyzer'
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <SearchCheck className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                <span>Resume Analyzer</span>
              </button>

              <button
                id="nav-job-optimization-btn"
                onClick={() => {
                  onSelectView('job_optimization');
                  onClose();
                }}
                className={`flex w-full items-center space-x-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors ${
                  activeView === 'job_optimization'
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Briefcase className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                <span>Job Optimization</span>
              </button>

              <button
                id="nav-saved-jobs-btn"
                onClick={() => {
                  onSelectView('saved_jobs');
                  onClose();
                }}
                className={`flex w-full items-center space-x-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors ${
                  activeView === 'saved_jobs'
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Bookmark className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                <span>Saved Jobs & Tracker</span>
              </button>

              <button
                id="nav-my-resumes-btn"
                onClick={() => {
                  onSelectView('my_resumes');
                  onClose();
                }}
                className={`flex w-full items-center space-x-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors ${
                  activeView === 'my_resumes'
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Layers className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                <span>My Resumes</span>
              </button>

              <button
                id="nav-career-profile-btn"
                onClick={() => {
                  onSelectView('career_profile');
                  onClose();
                }}
                className={`flex w-full items-center space-x-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors ${
                  activeView === 'career_profile'
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <UserCheck className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                <span>Career Profile</span>
              </button>
            </nav>
          </div>

          {/* Recents Section */}
          <div>
            <div className="px-2 mb-1.5 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              Recents
            </div>
            {conversations.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-slate-400 dark:text-slate-500">
                No recent conversations
              </div>
            ) : (
              <div className="space-y-0.5">
                {conversations.map((conv) => {
                  const isActive =
                    activeView === 'chat' && conv.id === activeConversationId;
                  const isEditing = editingId === conv.id;
                  const isMenuOpen = menuOpenId === conv.id;

                  return (
                    <div
                      key={conv.id}
                      className={`group relative flex items-center justify-between rounded-md px-2.5 py-2 text-xs transition-colors ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      {isEditing ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleSaveRename(conv.id);
                          }}
                          className="flex items-center space-x-1 w-full"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            ref={inputRef}
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                handleCancelRename();
                              }
                            }}
                            className="flex-1 rounded px-1.5 py-0.5 text-xs bg-white dark:bg-slate-800 border border-blue-500 text-slate-900 dark:text-slate-100 focus:outline-none ring-1 ring-blue-500"
                          />
                          <button
                            type="submit"
                            className="p-1 text-blue-600 dark:text-blue-400 hover:text-blue-700"
                            title="Save"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelRename}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            title="Cancel"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              onSelectConversation(conv.id);
                              onSelectView('chat');
                              onClose();
                            }}
                            className="flex-1 text-left truncate pr-1"
                            title={conv.title}
                          >
                            {conv.title}
                          </button>

                          {/* Three-dot menu trigger */}
                          <div className="relative shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenId(isMenuOpen ? null : conv.id);
                              }}
                              className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-opacity ${
                                isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                              }`}
                              title="More options"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                              <div
                                ref={menuRef}
                                className="absolute right-0 top-6 z-50 w-32 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 shadow-lg text-xs"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={(e) => handleStartRename(conv, e)}
                                  className="flex w-full items-center space-x-2 px-3 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                >
                                  <Pencil className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                                  <span>Rename</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    setMenuOpenId(null);
                                    onDeleteConversation(conv.id, e);
                                  }}
                                  className="flex w-full items-center space-x-2 px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Settings Button */}
        <div className="border-t border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-900">
          <button
            id="sidebar-settings-btn"
            onClick={() => {
              onOpenSettings();
              onClose();
            }}
            className="flex w-full items-center space-x-2.5 rounded-md px-2.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            <Settings className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <span>Settings</span>
          </button>
        </div>
      </aside>
    </>
  );
};
