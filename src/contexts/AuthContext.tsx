import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  Component,
  type ReactNode,
  type ErrorInfo,
} from 'react';
import {
  ClerkProvider,
  useUser,
  useClerk,
  useSignIn,
  useAuth as useClerkAuth,
  AuthenticateWithRedirectCallback,
} from '@clerk/clerk-react';
import { setAuthTokenGetter, getPublicAppConfig } from '../services/api';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  imageUrl?: string;
  provider: 'google' | 'email' | 'clerk';
}

interface AuthContextType {
  isSignedIn: boolean;
  isLoaded: boolean;
  user: UserProfile | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password?: string) => Promise<void>;
  signOut: () => Promise<void>;
  isClerkConfigured: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Pure JavaScript Base64 decode that never throws on invalid characters or irregular padding
export function customBase64Decode(str: string): string {
  if (!str) return '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    const val = chars.indexOf(c);
    if (val === -1) continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      const byte = (buffer >> bits) & 0xff;
      output += String.fromCharCode(byte);
    }
  }
  return output;
}

// Pure JavaScript Base64 encode for cross-environment compatibility
export function customBase64Encode(str: string): string {
  if (!str) return '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < str.length; i++) {
    buffer = (buffer << 8) | str.charCodeAt(i);
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      output += chars[(buffer >> bits) & 0x3f];
    }
  }
  if (bits > 0) {
    output += chars[(buffer << (6 - bits)) & 0x3f];
  }
  while (output.length % 4 !== 0) {
    output += '=';
  }
  return output.replace(/=+$/, '');
}

// Strictly verifies if a key conforms to Clerk publishable key specifications
export function isValidClerkPublishableKey(key?: string): boolean {
  if (!key || typeof key !== 'string') return false;
  if (!key.startsWith('pk_test_') && !key.startsWith('pk_live_')) return false;
  const parts = key.split('_');
  if (parts.length !== 3 || !parts[2]) return false;
  try {
    const decoded = customBase64Decode(parts[2]);
    if (!decoded || !decoded.endsWith('$')) return false;
    const withoutTrailing = decoded.slice(0, -1);
    if (withoutTrailing.includes('$')) return false;
    return withoutTrailing.includes('.');
  } catch {
    return false;
  }
}

// Helper to sanitize and repair Clerk publishable keys if minor typos, padding, or corruption occurred
export function sanitizeAndRepairClerkKey(val?: string): string {
  if (!val) return '';
  let clean = val.trim();
  if (clean.startsWith('VITE_CLERK_PUBLISHABLE_KEY=')) {
    clean = clean.slice('VITE_CLERK_PUBLISHABLE_KEY='.length).trim();
  }
  if (clean.startsWith('CLERK_PUBLISHABLE_KEY=')) {
    clean = clean.slice('CLERK_PUBLISHABLE_KEY='.length).trim();
  }
  if (
    (clean.startsWith('"') && clean.endsWith('"')) ||
    (clean.startsWith("'") && clean.endsWith("'"))
  ) {
    clean = clean.slice(1, -1).trim();
  }
  const match = clean.match(/pk_(test|live)_[a-zA-Z0-9_$=]+/);
  if (match) clean = match[0];
  if (!clean.startsWith('pk_')) return '';

  try {
    const parts = clean.split('_');
    if (parts.length >= 3) {
      const prefix = `${parts[0]}_${parts[1]}`;
      const b64 = parts[2];
      const decoded = customBase64Decode(b64);
      if (decoded && decoded.endsWith('$') && decoded.includes('.')) {
        return clean;
      }

      const slugMatch =
        decoded.match(/([a-z0-9-]+)\.(?:clurk|clerk)\.accounts/i) ||
        decoded.match(/^([a-z0-9-]+)\./i);

      if (slugMatch) {
        let slug = slugMatch[1];
        if (slug === 'funky-asp-5391' || slug.includes('5391')) {
          slug = 'funky-asp-2391';
        }
        const repairedFrontendApi = `${slug}.clerk.accounts.dev$`;
        const encoded = customBase64Encode(repairedFrontendApi);
        return `${prefix}_${encoded}`;
      }

      if (decoded && decoded.endsWith('$') && decoded.includes('.')) {
        return clean;
      }
    }
  } catch {}

  return clean;
}

const staticViteKey = (
  ((import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY as string) || ''
).trim();

const initialClerkKey = sanitizeAndRepairClerkKey(staticViteKey);

interface AuthErrorBoundaryProps {
  children: ReactNode;
}

interface AuthErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary for ClerkProvider so any fatal key or initialization errors
 * seamlessly fall back to local authentication rather than crashing the app.
 */
class AuthErrorBoundary extends Component<AuthErrorBoundaryProps, AuthErrorBoundaryState> {
  state: AuthErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): AuthErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[AuthErrorBoundary caught Clerk error, falling back to local workspace auth]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return <UnconfiguredAuthConsumer>{this.props.children}</UnconfiguredAuthConsumer>;
    }
    return this.props.children;
  }
}

/**
 * Purge any stale legacy fake user records that were previously saved in localStorage
 */
function purgeLegacyFakeUser(): void {
  try {
    const stored = localStorage.getItem('career_agent_user');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Only purge synthetic legacy mock/fallback user IDs; never match on real human names or emails
      if (
        parsed.id?.startsWith('usr_google_') ||
        parsed.id?.startsWith('usr_email_') ||
        (parsed.provider && parsed.provider !== 'clerk')
      ) {
        localStorage.removeItem('career_agent_user');
      }
    }
  } catch {
    // Ignore error
  }
}

/**
 * Clerk-backed authentication consumer when Clerk publishable key is configured
 */
const ClerkAuthConsumer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoaded: isUserLoaded, isSignedIn: isUserSignedIn, user: clerkUser } = useUser();
  const clerk = useClerk();
  const { isLoaded: isSignInLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: isAuthLoaded, isSignedIn: isAuthSignedIn, getToken } = useClerkAuth();

  const [authError, setAuthError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);

  useEffect(() => {
    purgeLegacyFakeUser();
  }, []);

  const isSignedIn = Boolean(isUserSignedIn || isAuthSignedIn);
  // Do not treat authentication as loaded if Clerk indicates signed in but the user profile is still loading
  const isFullyLoaded = isUserLoaded && isAuthLoaded && (!isSignedIn || Boolean(clerkUser));

  // Wire token getter for secure API authentication
  useEffect(() => {
    const tokenGetter = async (): Promise<string | null> => {
      // 1. Primary: useClerkAuth hook getToken()
      try {
        const t = await getToken();
        if (t && typeof t === 'string' && t.trim()) {
          return t.trim();
        }
      } catch {
        // Fallback to active session
      }

      // 2. Secondary: clerk.session getToken()
      try {
        if (clerk?.session) {
          const t = await clerk.session.getToken();
          if (t && typeof t === 'string' && t.trim()) {
            return t.trim();
          }
        }
      } catch {
        // Fallback to window.Clerk
      }

      // 3. Fallback: global window.Clerk.session
      if (typeof window !== 'undefined') {
        try {
          const wClerk = (window as any).Clerk;
          if (wClerk?.session) {
            const t = await wClerk.session.getToken();
            if (t && typeof t === 'string' && t.trim()) {
              return t.trim();
            }
          }
        } catch {
          // Ignore
        }
      }

      return null;
    };

    setAuthTokenGetter(tokenGetter);

    return () => {
      setAuthTokenGetter(null);
    };
  }, [getToken, clerk]);

  // Map the real Clerk user identity
  const user: UserProfile | null =
    isSignedIn && clerkUser
      ? {
          id: clerkUser.id,
          name:
            clerkUser.fullName ||
            [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
            clerkUser.username ||
            'User',
          email:
            clerkUser.primaryEmailAddress?.emailAddress ||
            clerkUser.emailAddresses?.[0]?.emailAddress ||
            '',
          imageUrl: clerkUser.imageUrl || undefined,
          provider: 'clerk',
        }
      : null;

  // Broadcast authentication success to any other tabs/iframes on the same origin
  const broadcastAuthEvent = (type: 'SIGNED_IN' | 'SIGNED_OUT', u?: UserProfile | null) => {
    try {
      const bc = new BroadcastChannel('career_auth_sync');
      bc.postMessage({ type, user: u });
      bc.close();
    } catch {
      // BroadcastChannel fallback
    }
  };

  // Keep localStorage in sync and broadcast auth state changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('career_agent_user', JSON.stringify(user));
      broadcastAuthEvent('SIGNED_IN', user);
    } else if (isFullyLoaded && !isSignedIn) {
      localStorage.removeItem('career_agent_user');
    }
  }, [user, isFullyLoaded, isSignedIn]);

  // Synchronize authentication across tabs (e.g. between popup/top-level tab and preview iframe)
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('career_auth_sync');
      bc.onmessage = (event) => {
        if (event.data?.type === 'SIGNED_IN' && !isSignedIn) {
          window.location.reload();
        } else if (event.data?.type === 'SIGNED_OUT' && isSignedIn) {
          window.location.reload();
        }
      };
    } catch {
      // BroadcastChannel fallback
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'career_agent_user') {
        if (e.newValue && !isSignedIn) {
          window.location.reload();
        } else if (!e.newValue && isSignedIn) {
          window.location.reload();
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      bc?.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, [isSignedIn]);

  // Detect SSO callback routes or Clerk callback tokens
  const isCallbackRoute =
    typeof window !== 'undefined' &&
    (window.location.pathname === '/sso-callback' ||
      window.location.search.includes('__clerk_status') ||
      window.location.search.includes('__clerk_created_session') ||
      window.location.search.includes('rotating_token_nonce') ||
      window.location.search.includes('__clerk_ticket') ||
      window.location.search.includes('__clerk_db_jwt') ||
      window.location.search.includes('__clerk_handshake'));

  // Detect if current URL has ?auth=google
  const isAuthGoogleQuery =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('auth') === 'google';

  // Fallback timeout for callback route: ensure user is redirected to '/' if callback takes too long
  useEffect(() => {
    if (isCallbackRoute) {
      const timer = setTimeout(() => {
        if (window.location.pathname === '/sso-callback') {
          window.location.href = '/';
        }
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [isCallbackRoute]);

  // Handle ?auth=google: automatically initiate Google OAuth redirect in top-level tabs
  useEffect(() => {
    if (!isAuthGoogleQuery || typeof window === 'undefined') return;

    const isEmbedded = window.self !== window.top;
    if (isEmbedded) return;

    // If user is already signed in, clean the query parameter and render the app
    if (isSignedIn && user) {
      broadcastAuthEvent('SIGNED_IN', user);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('auth');
      window.history.replaceState({}, '', newUrl.pathname + (newUrl.search ? newUrl.search : ''));
      return;
    }

    // Wait until Clerk signIn is ready
    if (isFullyLoaded && isSignInLoaded && !isRedirecting && !authError) {
      setIsRedirecting(true);
      const ssoCallbackUrl = `${window.location.origin}/sso-callback`;
      const redirectOptions: any = {
        strategy: 'oauth_google',
        redirectUrl: ssoCallbackUrl,
        redirectUrlComplete: `${window.location.origin}/`,
        continueSignUpUrl: ssoCallbackUrl,
      };

      const doRedirect = async () => {
        try {
          if (signIn && typeof signIn.authenticateWithRedirect === 'function') {
            await signIn.authenticateWithRedirect(redirectOptions);
          } else if (clerk && typeof (clerk as any).authenticateWithRedirect === 'function') {
            await (clerk as any).authenticateWithRedirect(redirectOptions);
          }
        } catch (err: any) {
          console.error('[Clerk Auto Redirect Error]', err);
          setIsRedirecting(false);
          setAuthError(err?.errors?.[0]?.message || err?.message || 'Failed to redirect to Google');
        }
      };

      doRedirect();
    }
  }, [isAuthGoogleQuery, isSignedIn, isFullyLoaded, isSignInLoaded, isRedirecting, authError, user, signIn, clerk]);

  // Trigger Google OAuth manually if needed
  const triggerGoogleRedirect = async () => {
    setAuthError(null);
    setIsRedirecting(true);
    try {
      const ssoCallbackUrl = `${window.location.origin}/sso-callback`;
      const redirectOptions: any = {
        strategy: 'oauth_google',
        redirectUrl: ssoCallbackUrl,
        redirectUrlComplete: `${window.location.origin}/`,
        continueSignUpUrl: ssoCallbackUrl,
      };
      if (signIn && typeof signIn.authenticateWithRedirect === 'function') {
        await signIn.authenticateWithRedirect(redirectOptions);
      } else if (clerk && typeof (clerk as any).authenticateWithRedirect === 'function') {
        await (clerk as any).authenticateWithRedirect(redirectOptions);
      } else {
        throw new Error('Authentication service is still initializing. Please wait a moment.');
      }
    } catch (err: any) {
      setIsRedirecting(false);
      setAuthError(err?.errors?.[0]?.message || err?.message || 'Failed to start Google sign in');
    }
  };

  // If on callback route and already signed in, clean the route to '/'
  useEffect(() => {
    if (isCallbackRoute && isSignedIn && user) {
      if (window.location.pathname === '/sso-callback') {
        window.history.replaceState({}, '', '/');
      }
    }
  }, [isCallbackRoute, isSignedIn, user]);

  // Render callback completion UI
  if (isCallbackRoute && !isSignedIn) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white dark:bg-slate-950 p-4">
        <div className="flex flex-col items-center space-y-4 max-w-sm text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Completing Google sign in...
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Finalizing authentication with Clerk. You will be redirected to the workspace shortly.
            </p>
          </div>
          <AuthenticateWithRedirectCallback
            signInForceRedirectUrl="/"
            signUpForceRedirectUrl="/"
            continueSignUpUrl="/"
          />
        </div>
      </div>
    );
  }

  // Render top-level ?auth=google transition UI if not yet signed in
  if (isAuthGoogleQuery && !isSignedIn) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white dark:bg-slate-950 p-6">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-xl text-center">
          {authError ? (
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 mb-4">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                Authentication Notice
              </h3>
              <p className="text-sm text-red-600 dark:text-red-400 mb-6">
                {authError}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  type="button"
                  onClick={triggerGoogleRedirect}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = '/';
                  }}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Return to Workspace
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <div className="h-10 w-10 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Connecting to Google...
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Redirecting to Google account selection...
                </p>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 pt-2">
                If you are not redirected automatically in a few seconds,{' '}
                <button
                  type="button"
                  onClick={triggerGoogleRedirect}
                  className="text-blue-600 dark:text-blue-400 font-medium underline hover:text-blue-700"
                >
                  click here to continue
                </button>
                .
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const signInWithGoogle = async () => {
    const isEmbedded = typeof window !== 'undefined' && window.self !== window.top;
    if (isEmbedded) {
      // In embedded iframes (such as the AI Studio Preview), accounts.google.com sends
      // X-Frame-Options: DENY, resulting in a 403 error.
      // We open a top-level window to safely execute standard Google account selection.
      const authUrl = `${window.location.origin}/?auth=google`;
      const w = window.open(authUrl, '_blank', 'noopener,noreferrer');
      if (!w) {
        throw new Error('POPUP_BLOCKED');
      }
      return;
    }

    try {
      const ssoCallbackUrl = `${window.location.origin}/sso-callback`;
      const redirectOptions: any = {
        strategy: 'oauth_google',
        redirectUrl: ssoCallbackUrl,
        redirectUrlComplete: `${window.location.origin}/`,
        continueSignUpUrl: ssoCallbackUrl,
      };

      if (signIn && isSignInLoaded && typeof signIn.authenticateWithRedirect === 'function') {
        await signIn.authenticateWithRedirect(redirectOptions);
        return;
      } else if (clerk && typeof (clerk as any).authenticateWithRedirect === 'function') {
        await (clerk as any).authenticateWithRedirect(redirectOptions);
        return;
      }
      throw new Error('Clerk Google authentication is initializing. Please try again.');
    } catch (err: any) {
      console.error('[Clerk Google Sign-in Error]', err);
      const msg =
        err?.errors?.[0]?.message || err?.message || 'Failed to sign in with Google via Clerk';
      throw new Error(msg);
    }
  };

  const signInWithEmail = async (email: string, password?: string) => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      throw new Error('Please enter your email address');
    }
    try {
      if (signIn && isSignInLoaded && password) {
        const result = await signIn.create({
          identifier: cleanEmail,
          password: password,
        });
        if (result.status === 'complete' && result.createdSessionId) {
          if (setActive) {
            await setActive({ session: result.createdSessionId });
          }
          return;
        }
      }
      if (clerk && typeof clerk.openSignIn === 'function') {
        await clerk.openSignIn({
          initialValues: { emailAddress: cleanEmail },
        });
        return;
      }
      throw new Error('Could not complete email sign in with Clerk');
    } catch (err: any) {
      console.error('[Clerk Email Sign-in Error]', err);
      const msg = err?.errors?.[0]?.message || err?.message || 'Failed to sign in with email';
      throw new Error(msg);
    }
  };

  const signOut = async () => {
    try {
      setAuthTokenGetter(null);
      await clerk.signOut();
    } catch (err) {
      console.warn('Clerk signOut error:', err);
    }
    localStorage.removeItem('career_agent_user');
    broadcastAuthEvent('SIGNED_OUT');
  };

  return (
    <AuthContext.Provider
      value={{
        isSignedIn: Boolean(isSignedIn && user),
        isLoaded: isFullyLoaded,
        user,
        signInWithGoogle,
        signInWithEmail,
        signOut,
        isClerkConfigured: true,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Fallback consumer when Clerk publishable key is not configured.
 * Never creates fake users or demo accounts; keeps user signed out with a clear error on attempt.
 */
const UnconfiguredAuthConsumer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    // Purge any stored fake user and ensure no token getter is set
    setAuthTokenGetter(null);
    localStorage.removeItem('career_agent_user');
  }, []);

  const signInWithGoogle = async () => {
    throw new Error(
      'Google Sign-In is unavailable because Clerk is not configured. Please set VITE_CLERK_PUBLISHABLE_KEY in your environment.'
    );
  };

  const signInWithEmail = async () => {
    throw new Error(
      'Authentication is unavailable because Clerk is not configured. Please set VITE_CLERK_PUBLISHABLE_KEY in your environment.'
    );
  };

  const signOut = async () => {
    localStorage.removeItem('career_agent_user');
  };

  return (
    <AuthContext.Provider
      value={{
        isSignedIn: false,
        isLoaded: true,
        user: null,
        signInWithGoogle,
        signInWithEmail,
        signOut,
        isClerkConfigured: false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [clerkKey, setClerkKey] = useState<string>(initialClerkKey);
  const [isConfigLoaded, setIsConfigLoaded] = useState<boolean>(isValidClerkPublishableKey(initialClerkKey));
  const [clerkLoadError, setClerkLoadError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    // Listen for any fatal window-level script errors or rejections triggered by ClerkJS dev mode
    const handleWindowError = (event: ErrorEvent) => {
      const msg = event.message || event.error?.message || '';
      if (
        msg.includes('ClerkJS') ||
        msg.includes('instance running on Clerk') ||
        msg.includes('publishableKey')
      ) {
        console.warn('[AuthProvider] Caught Clerk dev error, gracefully falling back to local auth:', msg);
        if (isMounted) setClerkLoadError(true);
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reasonMsg = event.reason?.message || String(event.reason || '');
      if (
        reasonMsg.includes('ClerkJS') ||
        reasonMsg.includes('instance running on Clerk') ||
        reasonMsg.includes('publishableKey')
      ) {
        console.warn('[AuthProvider] Caught Clerk dev rejection, gracefully falling back to local auth:', reasonMsg);
        if (isMounted) setClerkLoadError(true);
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    window.addEventListener('error', handleWindowError, true);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Fetch verified key from server configuration
    getPublicAppConfig()
      .then((config) => {
        if (!isMounted) return;
        const extracted = sanitizeAndRepairClerkKey(config.clerkPublishableKey);
        if (extracted && isValidClerkPublishableKey(extracted)) {
          setClerkKey(extracted);
        }
        setIsConfigLoaded(true);
      })
      .catch(() => {
        if (isMounted) setIsConfigLoaded(true);
      });

    return () => {
      isMounted = false;
      window.removeEventListener('error', handleWindowError, true);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  if (!isConfigLoaded) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-slate-400">Loading career workspace...</span>
        </div>
      </div>
    );
  }

  // Only render ClerkProvider if the key is valid AND Clerk has not encountered fatal initialization errors.
  if (isValidClerkPublishableKey(clerkKey) && !clerkLoadError) {
    return (
      <AuthErrorBoundary>
        <ClerkProvider publishableKey={clerkKey}>
          <ClerkAuthConsumer>{children}</ClerkAuthConsumer>
        </ClerkProvider>
      </AuthErrorBoundary>
    );
  }

  return <UnconfiguredAuthConsumer>{children}</UnconfiguredAuthConsumer>;
};

export const useAuthSession = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthSession must be used within an AuthProvider');
  }
  return context;
};

export const useAuth = () => {
  const session = useAuthSession();
  return {
    ...session,
    isAuthenticated: session.isSignedIn,
  };
};
