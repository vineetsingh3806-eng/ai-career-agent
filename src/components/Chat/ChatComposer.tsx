import React, { useRef, useState } from 'react';
import { Plus, ArrowUp, X, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import type { Attachment } from '../../types';
import { uploadFile } from '../../services/api';

interface ChatComposerProps {
  onSendMessage: (text: string, attachments: Attachment[]) => void;
  isLoading: boolean;
  placeholder?: string;
  guestLimitReached?: boolean;
  guestRemaining?: number;
  onContinueWithGoogle?: () => void;
  onLoginAnotherWay?: () => void;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  onSendMessage,
  isLoading,
  placeholder = 'Ask anything about your career...',
  guestLimitReached = false,
  guestRemaining,
  onContinueWithGoogle,
  onLoginAnotherWay,
}) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const newAttachments: Attachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Validate size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`File "${file.name}" exceeds 10MB limit.`);
        }
        const uploaded = await uploadFile(file);
        newAttachments.push(uploaded);
      }
      setAttachments((prev) => [...prev, ...newAttachments]);
    } catch (err: any) {
      console.error('[ChatComposer] Upload error:', err);
      setUploadError(err.message || 'Failed to upload attachment');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoading || isUploading) return;
    if (!text.trim() && attachments.length === 0) return;

    onSendMessage(text.trim(), attachments);
    setText('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-grow textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-4">
      {/* Upload Error Alert */}
      {uploadError && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 border border-red-200">
          <span>{uploadError}</span>
          <button
            onClick={() => setUploadError(null)}
            className="text-red-500 hover:text-red-700 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((att) => {
            const isImg = att.type.startsWith('image/');
            return (
              <div
                key={att.id}
                className="group relative flex items-center space-x-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-2xs"
              >
                {isImg && att.dataUrl ? (
                  <img
                    src={att.dataUrl}
                    alt={att.name}
                    referrerPolicy="no-referrer"
                    className="h-6 w-6 rounded object-cover border border-slate-100"
                  />
                ) : (
                  <FileText className="h-4 w-4 text-blue-600" />
                )}
                <span className="max-w-[150px] truncate font-medium">{att.name}</span>
                <span className="text-[10px] text-slate-400">
                  ({(att.size / 1024).toFixed(0)} KB)
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  aria-label={`Remove ${att.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Composer Box or Guest Limit Card */}
      {guestLimitReached ? (
        <div
          id="guest-limit-card"
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs text-center space-y-3"
        >
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
            You've used your 3 free guest uses for today.
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sign in with Google to continue.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <button
              id="guest-limit-google-btn"
              type="button"
              onClick={onContinueWithGoogle}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 active:scale-[0.99] transition-all cursor-pointer"
            >
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
            {onLoginAnotherWay && (
              <button
                id="guest-limit-another-way-btn"
                type="button"
                onClick={onLoginAnotherWay}
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition-all cursor-pointer"
              >
                <span>Login another way</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <form
            onSubmit={handleSubmit}
            className="relative flex items-end rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 px-3 py-2 shadow-sm transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900/40"
          >
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
              className="hidden"
              id="composer-file-input"
            />

            {/* Attachment '+' Button */}
            <button
              type="button"
              id="attach-file-btn"
              disabled={isLoading || isUploading}
              onClick={() => fileInputRef.current?.click()}
              title="Upload resume or documents (PDF, DOCX, TXT, PNG, JPG)"
              className="mb-1 mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-50 transition-colors"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              ) : (
                <Plus className="h-5 w-5" />
              )}
            </button>

            {/* Text Area */}
            <textarea
              id="chat-composer-textarea"
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              disabled={isLoading}
              className="max-h-44 w-full resize-none border-0 bg-transparent py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-0 focus:outline-none leading-relaxed"
            />

            {/* Send Button */}
            <button
              type="submit"
              id="send-message-btn"
              disabled={isLoading || isUploading || (!text.trim() && attachments.length === 0)}
              className="mb-1 ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs hover:bg-blue-600 dark:hover:bg-blue-600 dark:hover:text-white disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:shadow-none transition-colors"
              title="Send message"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4 stroke-[2.5]" />
              )}
            </button>
          </form>

          <div className="mt-1.5 flex items-center justify-between px-2 text-[11px] text-slate-400 dark:text-slate-500">
            <span>
              {guestRemaining !== undefined && guestRemaining >= 0
                ? `${guestRemaining} of 3 free guest uses remaining`
                : 'Supports PDF, DOCX, TXT, images'}
            </span>
            <span>Enter to send, Shift+Enter for new line</span>
          </div>
        </>
      )}
    </div>
  );
};
