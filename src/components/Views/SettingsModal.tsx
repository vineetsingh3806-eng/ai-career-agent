import React from 'react';
import { X, Sun, Moon, LogOut, User as UserIcon } from 'lucide-react';
import type { AppSettings, TemplateId } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  onOpenAuthModal?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onOpenAuthModal,
}) => {
  const { theme, setTheme } = useTheme();
  const { user, isAuthenticated, signOut } = useAuth();

  if (!isOpen) return null;

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    }
  };

  return (
    <div
      id="settings-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs"
    >
      <div
        id="settings-card"
        className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4 text-slate-900 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Settings</h3>
          <button
            id="settings-close-btn"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Appearance */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-900 dark:text-slate-200">
            Appearance
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              id="theme-light-btn"
              onClick={() => setTheme('light')}
              className={`flex items-center justify-center space-x-2 rounded-xl border py-2 px-3 text-xs font-semibold transition-all ${
                theme === 'light'
                  ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750'
              }`}
            >
              <Sun className="h-3.5 w-3.5 text-amber-500" />
              <span>Light</span>
            </button>
            <button
              type="button"
              id="theme-dark-btn"
              onClick={() => setTheme('dark')}
              className={`flex items-center justify-center space-x-2 rounded-xl border py-2 px-3 text-xs font-semibold transition-all ${
                theme === 'dark'
                  ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750'
              }`}
            >
              <Moon className="h-3.5 w-3.5 text-indigo-400" />
              <span>Dark</span>
            </button>
          </div>
        </div>

        {/* AI Preferences */}
        <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <label className="block text-xs font-bold text-slate-900 dark:text-slate-200">
            AI Preferences
          </label>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-3">
            <div className="pr-3">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Deep Thinking
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Use deeper reasoning for complex career tasks.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                id="deep-thinking-toggle"
                checked={Boolean(settings.thinkingMode)}
                onChange={(e) => onUpdateSettings({ thinkingMode: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Job Search */}
        <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <label
            htmlFor="preferred-job-provider"
            className="block text-xs font-bold text-slate-900 dark:text-slate-200"
          >
            Job Search
          </label>
          <div className="space-y-1">
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">
              Preferred source
            </span>
            <select
              id="preferred-job-provider"
              value={settings.preferredJobProvider || 'automatic'}
              onChange={(e) => onUpdateSettings({ preferredJobProvider: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
            >
              <option value="automatic">Automatic (Recommended)</option>
              <option value="arbeitnow">Arbeitnow</option>
              <option value="remoteok">RemoteOK</option>
              <option value="adzuna">Adzuna</option>
            </select>
          </div>
        </div>

        {/* Resume */}
        <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <label
            htmlFor="default-resume-template"
            className="block text-xs font-bold text-slate-900 dark:text-slate-200"
          >
            Resume
          </label>
          <div className="space-y-1">
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">
              Default resume template
            </span>
            <select
              id="default-resume-template"
              value={settings.defaultTemplate || 'modern'}
              onChange={(e) => onUpdateSettings({ defaultTemplate: e.target.value as TemplateId })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
            >
              <option value="modern">Modern</option>
              <option value="ats_minimal">ATS Minimal</option>
              <option value="ai_engineer">AI Engineer</option>
              <option value="fresher">Fresher</option>
              <option value="corporate">Corporate</option>
            </select>
          </div>
        </div>

        {/* Account */}
        <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <label className="block text-xs font-bold text-slate-900 dark:text-slate-200">
            Account
          </label>
          {isAuthenticated && user ? (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-3">
              <div className="flex items-center space-x-3 min-w-0">
                {user.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt={user.name || 'User avatar'}
                    referrerPolicy="no-referrer"
                    className="h-9 w-9 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold uppercase text-white shadow-xs">
                    {user.name ? user.name.charAt(0) : user.email ? user.email.charAt(0) : 'U'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                    {user.name || 'User'}
                  </div>
                  <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {user.email}
                  </div>
                </div>
              </div>
              <button
                type="button"
                id="settings-signout-btn"
                onClick={handleSignOut}
                className="inline-flex items-center space-x-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-200 dark:hover:border-rose-900 transition-colors shadow-2xs shrink-0 ml-2"
              >
                <LogOut className="h-3 w-3" />
                <span>Sign out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-3">
              <div className="flex items-center space-x-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                  <UserIcon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Guest session
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500">
                    Sign in to sync your data
                  </div>
                </div>
              </div>
              {onOpenAuthModal && (
                <button
                  type="button"
                  id="settings-signin-btn"
                  onClick={onOpenAuthModal}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 transition-colors"
                >
                  Sign in
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            id="settings-done-btn"
            onClick={onClose}
            className="rounded-xl bg-slate-900 dark:bg-slate-100 px-5 py-2 text-xs font-semibold text-white dark:text-slate-900 shadow-2xs hover:bg-slate-800 dark:hover:bg-white active:scale-[0.99] transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
