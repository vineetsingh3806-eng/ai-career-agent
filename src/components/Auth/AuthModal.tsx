import React, { useState, useEffect } from 'react';
import { X, Mail, ArrowRight, Compass, ShieldCheck, ExternalLink, RefreshCw } from 'lucide-react';
import { useAuthSession } from '../../contexts/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  subtitle?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = 'Welcome to AI Career Agent',
  subtitle = 'Sign in to continue to your personal career workspace',
}) => {
  const { signInWithGoogle, signInWithEmail, user } = useAuthSession();
  const [showAlternative, setShowAlternative] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitingForExternalAuth, setWaitingForExternalAuth] = useState(false);

  const isEmbedded = typeof window !== 'undefined' && window.self !== window.top;
  const authUrl = typeof window !== 'undefined' ? `${window.location.origin}/?auth=google` : '/?auth=google';

  // Listen for successful authentication from top-level window/popup
  useEffect(() => {
    if (!isOpen) return;

    const handleSync = (newUser?: any) => {
      if (newUser || localStorage.getItem('career_agent_user')) {
        onSuccess?.();
        onClose();
      }
    };

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('career_auth_sync');
      bc.onmessage = (event) => {
        if (event.data?.type === 'SIGNED_IN') {
          handleSync(event.data?.user);
        }
      };
    } catch {
      // Fallback
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'career_agent_user' && e.newValue) {
        handleSync();
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      bc?.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, [isOpen, onSuccess, onClose]);

  // If user becomes signed in, close modal
  useEffect(() => {
    if (user) {
      onSuccess?.();
      onClose();
    }
  }, [user, onSuccess, onClose]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      if (isEmbedded) {
        setWaitingForExternalAuth(true);
        // Attempt to open safe top-level tab for Google authentication
        const w = window.open(authUrl, '_blank', 'noopener,noreferrer');
        if (!w) {
          // If popup blocker intervened, waiting UI provides direct link
        }
      } else {
        await signInWithGoogle();
        onSuccess?.();
        onClose();
      }
    } catch (err: any) {
      if (err?.message === 'POPUP_BLOCKED') {
        setWaitingForExternalAuth(true);
      } else {
        setError(err?.message || 'Failed to sign in with Google');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await signInWithEmail(email, password);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to sign in');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="auth-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
    >
      <div
        id="auth-card"
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900 transition-all text-slate-900 dark:text-slate-100"
      >
        {/* Close Button */}
        <button
          id="auth-close-btn"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Minimal Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 mb-3 shadow-2xs">
            <Compass className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Authentication Options */}
        <div className="space-y-3">
          {waitingForExternalAuth ? (
            /* External Tab Authentication Active */
            <div id="auth-external-waiting" className="space-y-4 py-2 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/50">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Google Sign-In Opened in New Tab
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400 px-2">
                  Select your Google account in the opened window. This preview will update automatically once signed in.
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <a
                  id="reopen-google-tab-btn"
                  href={authUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Click to Open Sign-In Tab</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    if (localStorage.getItem('career_agent_user')) {
                      window.location.reload();
                    } else {
                      setWaitingForExternalAuth(false);
                    }
                  }}
                  className="inline-flex items-center justify-center gap-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Already signed in? Refresh status</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWaitingForExternalAuth(false)}
                  className="w-full text-center text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 pt-1"
                >
                  Cancel and choose another option
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Main Option: Continue with Google */}
              <button
                id="continue-with-google-btn"
                type="button"
                disabled={isSubmitting}
                onClick={handleGoogleSignIn}
                className="flex w-full items-center justify-center space-x-3 rounded-xl border border-slate-200 bg-white py-3 px-4 text-sm font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-800 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
              >
                {/* Google G icon */}
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              {!showAlternative ? (
                /* Alternative Button Toggle */
                <div className="pt-2 text-center">
                  <button
                    id="login-another-way-btn"
                    type="button"
                    onClick={() => setShowAlternative(true)}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                  >
                    Login another way
                  </button>
                </div>
              ) : (
                /* Alternative Login Form */
                <form onSubmit={handleEmailSignIn} className="space-y-3 pt-2">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white px-2 text-slate-400 dark:bg-slate-900">
                        or continue with email
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:focus:bg-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Password (optional)
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:focus:bg-slate-800"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex w-full items-center justify-center space-x-2 rounded-xl bg-blue-600 py-2.5 px-4 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    <span>Sign in with Email</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAlternative(false)}
                      className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      ← Back to Google sign-in
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>

        {/* Quiet Trust Note */}
        <div className="mt-6 flex items-center justify-center space-x-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Secure authentication • Private candidate data</span>
        </div>
      </div>
    </div>
  );
};
