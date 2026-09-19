import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Header } from './components/Header';
import { Sidebar, type ActiveView } from './components/Sidebar';
import { ChatContainer } from './components/Chat/ChatContainer';
import { LandingPage } from './components/Landing/LandingPage';
import { AuthModal } from './components/Auth/AuthModal';
import { ResumeBuilderView } from './components/Views/ResumeBuilderView';
import { ResumeAnalyzerView } from './components/Views/ResumeAnalyzerView';
import { JobOptimizationView } from './components/Views/JobOptimizationView';
import { SavedJobsView } from './components/Views/SavedJobsView';
import { MyResumesView } from './components/Views/MyResumesView';
import { CareerProfileView } from './components/Views/CareerProfileView';
import { SettingsModal } from './components/Views/SettingsModal';
import type {
  Conversation,
  AppSettings,
  Attachment,
  ResumeData,
  JobListing,
} from './types';
import {
  getConversations,
  createConversation,
  getConversation,
  deleteConversation,
  renameConversation,
  sendChatMessage,
  getSettings,
  updateSettings,
  getGuestStatus,
  type GuestStatus,
} from './services/api';

function CareerAppContent() {
  const { isAuthenticated, isLoaded, user, signInWithGoogle } = useAuth();
  const [isGuestEntered, setIsGuestEntered] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalConfig, setAuthModalConfig] = useState<{ title?: string; subtitle?: string }>({});
  const [guestStatus, setGuestStatus] = useState<GuestStatus | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('chat');

  // Application Settings
  const [settings, setSettings] = useState<AppSettings>({
    thinkingMode: false,
    preferredJobProvider: 'automatic',
    defaultTemplate: 'modern',
  });

  // Chat & Conversations
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Sub-view Contexts
  const [editingResume, setEditingResume] = useState<ResumeData | undefined>(undefined);
  const [targetJobForOpt, setTargetJobForOpt] = useState<Partial<JobListing> | undefined>(
    undefined
  );

  // Refresh Guest Status
  const refreshGuestStatus = useCallback(async () => {
    if (!isAuthenticated) {
      try {
        const status = await getGuestStatus();
        setGuestStatus(status);
      } catch (err) {
        console.warn('Could not load guest status:', err);
      }
    } else {
      setGuestStatus(null);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshGuestStatus();
  }, [refreshGuestStatus]);

  // Load initial settings and conversation list
  const loadUserData = useCallback(async () => {
    getSettings()
      .then(setSettings)
      .catch((err) => console.warn('Could not load settings:', err));

    try {
      const list = await getConversations();
      setConversations(list);
      if (list.length > 0) {
        const first = list[0];
        setActiveConversationId(first.id);
        const fullConv = await getConversation(first.id);
        setCurrentConversation(fullConv);
      } else {
        // Initialize first clean conversation
        const newConv = await createConversation();
        setConversations([newConv]);
        setActiveConversationId(newConv.id);
        setCurrentConversation(newConv);
      }
    } catch (err) {
      console.warn('Could not load conversations:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isAuthenticated || isGuestEntered) {
      loadUserData();
    }
  }, [isAuthenticated, isGuestEntered, loadUserData]);

  // Dismiss any open auth modal when user becomes authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setAuthModalOpen(false);
    }
  }, [isAuthenticated]);

  // Wait for Clerk authentication state to finish loading before deciding auth state
  if (!isLoaded) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white dark:bg-slate-950">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Loading workspace...
          </p>
        </div>
      </div>
    );
  }

  // Show Landing Page if user is not signed in and has not clicked explore/guest
  if (!isAuthenticated && !isGuestEntered) {
    return (
      <LandingPage
        onAuthenticated={() => {
          setIsGuestEntered(true);
        }}
      />
    );
  }

  const handleUpdateSettings = async (delta: Partial<AppSettings>) => {
    try {
      const updated = await updateSettings(delta);
      setSettings(updated);
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  const handleSelectConversation = async (id: string) => {
    setActiveConversationId(id);
    try {
      const conv = await getConversation(id);
      setCurrentConversation(conv);
    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
  };

  const handleNewChat = async () => {
    try {
      const newConv = await createConversation();
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      setCurrentConversation(newConv);
      setActiveView('chat');
    } catch (err) {
      console.error('Failed to create new conversation:', err);
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteConversation(id);
      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);

      if (activeConversationId === id) {
        if (remaining.length > 0) {
          handleSelectConversation(remaining[0].id);
        } else {
          handleNewChat();
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    // Update state immediately for instant feedback
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: trimmed, isCustomTitle: true } : c))
    );
    if (currentConversation && currentConversation.id === id) {
      setCurrentConversation((prev) =>
        prev ? { ...prev, title: trimmed, isCustomTitle: true } : null
      );
    }

    try {
      const updated = await renameConversation(id, trimmed);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updated } : c))
      );
      if (currentConversation && currentConversation.id === id) {
        setCurrentConversation((prev) => (prev ? { ...prev, ...updated } : null));
      }
    } catch (err) {
      console.error('Failed to rename conversation:', err);
    }
  };

  const handleSendMessage = async (text: string, attachments: Attachment[] = []) => {
    if (isLoading) return;

    // Check if guest limit has already been reached
    if (!isAuthenticated && guestStatus?.limitReached) {
      setAuthModalConfig({
        title: "You've used your 3 free guest uses for today.",
        subtitle: 'Sign in with Google to continue.',
      });
      setAuthModalOpen(true);
      return;
    }

    setIsLoading(true);

    try {
      const result = await sendChatMessage({
        conversationId: activeConversationId || undefined,
        message: text,
        attachments,
        useHighThinking: settings.thinkingMode,
      });

      if (result.guestStatus) {
        setGuestStatus(result.guestStatus);
      } else {
        refreshGuestStatus();
      }

      setCurrentConversation(result.conversation);
      setActiveConversationId(result.conversation.id);

      // Update sidebar conversation list
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === result.conversation.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = result.conversation;
          return updated;
        }
        return [result.conversation, ...prev];
      });
    } catch (err: any) {
      console.error('Send message failed:', err);

      // If guest daily limit was reached on server
      if (err.isGuestLimit || err.limitReached || err.message?.includes('guest uses')) {
        setGuestStatus((prev) =>
          prev
            ? { ...prev, usageCount: 3, remaining: 0, limitReached: true }
            : { isGuest: true, usageCount: 3, limit: 3, remaining: 0, limitReached: true }
        );
        setAuthModalConfig({
          title: "You've used your 3 free guest uses for today.",
          subtitle: 'Sign in with Google to continue.',
        });
        setAuthModalOpen(true);
        return;
      }

      // Append a clean user-friendly message locally if request completely failed
      if (currentConversation) {
        const raw = (err.message || '').toLowerCase();
        const isUnavailable =
          raw.includes('503') ||
          raw.includes('unavailable') ||
          raw.includes('high demand') ||
          raw.includes('spikes in demand');

        const cleanMessage = isUnavailable
          ? 'AI is temporarily unavailable because the selected Gemini model is experiencing high demand. Please try again in a moment.'
          : 'AI is temporarily unavailable. Please try again in a moment.';

        const errorMsg = {
          id: 'err_' + Date.now(),
          role: 'assistant' as const,
          content: cleanMessage,
          timestamp: new Date().toISOString(),
        };
        setCurrentConversation({
          ...currentConversation,
          messages: [...currentConversation.messages, errorMsg],
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectJobForOptimization = (job: JobListing) => {
    setTargetJobForOpt(job);
    setActiveView('job_optimization');
  };

  const handleOpenResumeInBuilder = (resume: ResumeData) => {
    setEditingResume(resume);
    setActiveView('resume_builder');
  };

  const handleCreateNewResume = () => {
    setEditingResume(undefined);
    setActiveView('resume_builder');
  };

  // View title helper
  const getViewTitle = () => {
    switch (activeView) {
      case 'resume_builder':
        return 'Resume Builder';
      case 'resume_analyzer':
        return 'Resume Analyzer';
      case 'job_optimization':
        return 'Job Optimization';
      case 'saved_jobs':
        return 'Saved Jobs';
      case 'my_resumes':
        return 'My Resumes';
      case 'career_profile':
        return 'Career Profile';
      default:
        return undefined;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased transition-colors">
      {/* Sidebar Navigation */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeView={activeView}
        onSelectView={setActiveView}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onOpenSettings={() => setSettingsModalOpen(true)}
      />

      {/* Main View Area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onOpenSettingsModal={() => setSettingsModalOpen(true)}
          onOpenAuthModal={() => {
            setAuthModalConfig({});
            setAuthModalOpen(true);
          }}
          currentViewTitle={getViewTitle()}
          guestStatus={guestStatus}
        />

        <main className="flex-1 overflow-hidden relative">
          {activeView === 'chat' && (
            <ChatContainer
              messages={currentConversation?.messages || []}
              isLoading={isLoading}
              onSendMessage={handleSendMessage}
              onSelectJobForOptimization={handleSelectJobForOptimization}
              onOpenResumeInBuilder={handleOpenResumeInBuilder}
              onTriggerFileUploadPrompt={() => {
                document.getElementById('composer-file-input')?.click();
              }}
              guestLimitReached={!isAuthenticated && (guestStatus?.limitReached ?? false)}
              guestRemaining={!isAuthenticated ? guestStatus?.remaining : undefined}
              onContinueWithGoogle={async () => {
                try {
                  await signInWithGoogle();
                } catch (e) {
                  console.error('Sign in with Google error:', e);
                }
              }}
              onLoginAnotherWay={() => {
                setAuthModalConfig({});
                setAuthModalOpen(true);
              }}
            />
          )}

          {activeView === 'resume_builder' && (
            <ResumeBuilderView
              initialResume={editingResume}
              onBackToChat={() => setActiveView('chat')}
            />
          )}

          {activeView === 'resume_analyzer' && (
            <ResumeAnalyzerView
              onOpenInChat={(prompt) => {
                setActiveView('chat');
                handleSendMessage(prompt);
              }}
              onOpenInBuilder={handleOpenResumeInBuilder}
            />
          )}

          {activeView === 'job_optimization' && (
            <JobOptimizationView
              initialJob={targetJobForOpt}
              onOpenInBuilder={handleOpenResumeInBuilder}
            />
          )}

          {activeView === 'saved_jobs' && (
            <SavedJobsView
              onSelectJobForOptimization={handleSelectJobForOptimization}
              onOpenInChat={(prompt) => {
                setActiveView('chat');
                handleSendMessage(prompt);
              }}
            />
          )}

          {activeView === 'my_resumes' && (
            <MyResumesView
              onOpenInBuilder={handleOpenResumeInBuilder}
              onCreateNewResume={handleCreateNewResume}
            />
          )}

          {activeView === 'career_profile' && <CareerProfileView />}
        </main>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onOpenAuthModal={() => {
          setSettingsModalOpen(false);
          setAuthModalOpen(true);
        }}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        title={authModalConfig.title}
        subtitle={authModalConfig.subtitle}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CareerAppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
