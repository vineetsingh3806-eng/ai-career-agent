import React, { useEffect, useRef } from 'react';
import { Sparkles, Ribbon } from 'lucide-react';
import type { ChatMessage, Attachment, JobListing } from '../../types';
import { ChatMessageItem } from './ChatMessageItem';
import { ChatComposer } from './ChatComposer';

interface ChatContainerProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (text: string, attachments: Attachment[]) => void;
  onSelectJobForOptimization: (job: JobListing) => void;
  onOpenResumeInBuilder: (resumeData: any) => void;
  onTriggerFileUploadPrompt: () => void;
  guestLimitReached?: boolean;
  guestRemaining?: number;
  onContinueWithGoogle?: () => void;
  onLoginAnotherWay?: () => void;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  messages,
  isLoading,
  onSendMessage,
  onSelectJobForOptimization,
  onOpenResumeInBuilder,
  guestLimitReached = false,
  guestRemaining,
  onContinueWithGoogle,
  onLoginAnotherWay,
}) => {
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Empty State: Vertically and horizontally centered greeting with pink ribbon icon and composer directly underneath
  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col justify-center items-center overflow-y-auto px-4 py-8 bg-white dark:bg-slate-900 transition-colors">
        <div className="w-full max-w-2xl flex flex-col items-center text-center my-auto">
          {/* Small Pink Ribbon / Bow Icon */}
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-50 dark:bg-pink-950/50 text-pink-500 dark:text-pink-400 shadow-xs ring-1 ring-pink-200 dark:ring-pink-900/40">
            <Ribbon className="h-7 w-7" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Hey cuties 👋
          </h2>
          <p className="mt-2 text-base text-slate-500 dark:text-slate-400">
            Let's build your career together.
          </p>

          <div className="w-full mt-6 text-left">
            <ChatComposer
              onSendMessage={onSendMessage}
              isLoading={isLoading}
              guestLimitReached={guestLimitReached}
              guestRemaining={guestRemaining}
              onContinueWithGoogle={onContinueWithGoogle}
              onLoginAnotherWay={onLoginAnotherWay}
            />
          </div>
        </div>
      </div>
    );
  }

  // Active Chat State: Standard scrollable messages with fixed composer at bottom
  return (
    <div className="flex h-full flex-col justify-between overflow-hidden bg-white dark:bg-slate-900 transition-colors">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-slate-100/80 dark:divide-slate-800/80">
          {messages.map((msg) => (
            <ChatMessageItem
              key={msg.id}
              message={msg}
              onSelectJobForOptimization={onSelectJobForOptimization}
              onOpenResumeInBuilder={onOpenResumeInBuilder}
              onSendMessage={(prompt) => onSendMessage(prompt, [])}
            />
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex w-full py-4 px-4 sm:px-6 bg-slate-50/60 dark:bg-slate-900/60 border-y border-slate-100 dark:border-slate-800">
              <div className="mx-auto flex w-full max-w-4xl space-x-3.5 sm:space-x-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                </div>
                <div className="flex items-center space-x-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span>AI Career Agent is evaluating and composing response...</span>
                  <span className="flex space-x-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={scrollEndRef} />
        </div>
      </div>

      {/* Fixed Composer at Bottom */}
      <div className="shrink-0 bg-white/95 dark:bg-slate-900/95 pt-2 border-t border-slate-100 dark:border-slate-800">
        <ChatComposer
          onSendMessage={onSendMessage}
          isLoading={isLoading}
          guestLimitReached={guestLimitReached}
          guestRemaining={guestRemaining}
          onContinueWithGoogle={onContinueWithGoogle}
          onLoginAnotherWay={onLoginAnotherWay}
        />
      </div>
    </div>
  );
};

