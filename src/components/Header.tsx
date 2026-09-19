import React from 'react';
import {
  Menu,
  Sparkles,
  BrainCircuit,
  Sliders,
  Sun,
  Moon,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import type { AppSettings } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  onToggleSidebar: () => void;
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  onOpenSettingsModal: () => void;
  onOpenAuthModal?: () => void;
  currentViewTitle?: string;
  guestStatus?: {
    isGuest: boolean;
    usageCount: number;
    limit: number;
    remaining: number;
    limitReached: boolean;
  } | null;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  settings,
  onUpdateSettings,
  onOpenSettingsModal,
  onOpenAuthModal,
  currentViewTitle,
  guestStatus,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated, signOut } = useAuth();

  return (
    <header
      id="app-header"
      className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-4 backdrop-blur-sm sm:px-6 transition-colors"
    >
      <div className="flex items-center space-x-3">
        <button
          id="sidebar-toggle-btn"
          onClick={onToggleSidebar}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition-colors md:hidden"
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex flex-col">
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight sm:text-lg">
              AI Career Agent
            </h1>
            {currentViewTitle && (
              <>
                <span className="text-slate-300 dark:text-slate-600">/</span>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-900/50">
                  {currentViewTitle}
                </span>
              </>
            )}
          </div>
          <p className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
            Your AI-powered career assistant
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-2.5">
        {/* Thinking Mode Toggle Button */}
        <button
          id="thinking-mode-toggle"
          onClick={() => onUpdateSettings({ thinkingMode: !settings.thinkingMode })}
          title={
            settings.thinkingMode
              ? 'Deep Thinking is active for complex career tasks'
              : 'Turn on Deep Thinking for deeper reasoning'
          }
          className={`flex items-center space-x-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
            settings.thinkingMode
              ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 ring-1 ring-indigo-300 dark:ring-indigo-700'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent'
          }`}
        >
          <BrainCircuit
            className={`h-3.5 w-3.5 ${settings.thinkingMode ? 'text-indigo-600 dark:text-indigo-400 animate-pulse' : 'text-slate-500'}`}
          />
          <span className="hidden sm:inline">Deep Thinking:</span>
          <span className="font-semibold">{settings.thinkingMode ? 'ON' : 'OFF'}</span>
        </button>

        {/* Theme Toggle (Light / Dark) */}
        <button
          id="theme-toggle-btn"
          onClick={toggleTheme}
          className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4 text-slate-600" />
          )}
        </button>

        {/* Settings Modal Button */}
        <button
          id="settings-modal-btn"
          onClick={onOpenSettingsModal}
          className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          title="Settings"
        >
          <Sliders className="h-4 w-4" />
        </button>

        {/* User Profile / Auth Button */}
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              {user.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={user.name || 'User avatar'}
                  referrerPolicy="no-referrer"
                  className="h-7 w-7 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div className="h-7 w-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                  {user.name ? user.name[0] : user.email ? user.email[0] : 'U'}
                </div>
              )}
              <span className="hidden md:inline text-xs font-semibold text-slate-700 dark:text-slate-200 max-w-[100px] truncate">
                {user.name || user.email.split('@')[0]}
              </span>
            </div>
            <button
              onClick={signOut}
              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 pl-1">
            {guestStatus && guestStatus.isGuest && (
              <span
                id="guest-usage-indicator"
                className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  guestStatus.remaining > 0
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                }`}
                title="Free guest limit: 3 interactions per day"
              >
                {guestStatus.remaining} of {guestStatus.limit} free guest uses remaining
              </span>
            )}
            {onOpenAuthModal && (
              <button
                onClick={onOpenAuthModal}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
              >
                <UserIcon className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

