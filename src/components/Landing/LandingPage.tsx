import React, { useState } from 'react';
import { Compass, ArrowRight } from 'lucide-react';
import { AuthModal } from '../Auth/AuthModal';

interface LandingPageProps {
  onAuthenticated: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onAuthenticated }) => {
  const [authModalOpen, setAuthModalOpen] = useState(false);

  return (
    <div
      id="landing-page-container"
      className="min-h-screen w-full bg-[#fafbfc] text-slate-900 font-sans flex flex-col justify-between selection:bg-blue-100 selection:text-blue-900"
    >
      {/* Top Navigation */}
      <header
        id="landing-header"
        className="w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-30"
      >
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Compass className="h-5 w-5" />
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900">
              AI Career Agent
            </span>
          </div>

          <button
            id="landing-header-signin-btn"
            onClick={() => setAuthModalOpen(true)}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition-colors"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Main Hero Section */}
      <main id="landing-hero" className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl text-center space-y-6">
          {/* Main Headline */}
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl sm:leading-[1.15]">
            Your Personal{' '}
            <span className="text-blue-600">AI Career Agent</span>
          </h1>

          {/* Short Supporting Description */}
          <p className="mx-auto max-w-lg text-base leading-relaxed text-slate-600">
            Analyze your resume, discover verified live job openings, tailor your applications, and
            prepare for interviews through an intelligent conversation.
          </p>

          {/* Action Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              id="landing-signin-btn"
              onClick={() => setAuthModalOpen(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 active:scale-[0.99] transition-all cursor-pointer"
            >
              <span>Sign In / Get Started</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              id="landing-guest-btn"
              onClick={onAuthenticated}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 rounded-xl bg-white border border-slate-200 px-6 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition-all cursor-pointer"
            >
              <span>Explore as Guest</span>
            </button>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer
        id="landing-footer"
        className="w-full border-t border-slate-200/80 bg-white py-6 text-center text-xs text-slate-400"
      >
        <div className="mx-auto max-w-5xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>AI Career Agent</span>
          <span>Real live job search • Resume intelligence • Career strategy</span>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={onAuthenticated}
      />
    </div>
  );
};
