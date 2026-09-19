import { GoogleGenAI, ThinkingLevel } from '@google/genai';

let geminiClient: GoogleGenAI | null = null;

export const HIGH_DEMAND_USER_MESSAGE =
  'AI is temporarily unavailable because the selected Gemini model is experiencing high demand. Please try again in a moment.';

export class GeminiHighDemandError extends Error {
  isHighDemand: boolean;
  constructor(message = HIGH_DEMAND_USER_MESSAGE) {
    super(message);
    this.name = 'GeminiHighDemandError';
    this.isHighDemand = true;
  }
}

export function is503UnavailableError(err: any): boolean {
  if (!err) return false;
  const status = err.status || err.statusCode || err.response?.status || err.error?.code;
  if (status === 503 || status === '503') return true;

  const msg = (
    (typeof err.message === 'string' ? err.message : '') +
    ' ' +
    (typeof err.toString === 'function' ? err.toString() : '') +
    ' ' +
    (err.error?.message || '') +
    ' ' +
    (err.statusText || '')
  ).toLowerCase();

  return (
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('spikes in demand') ||
    msg.includes('overloaded') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('service unavailable') ||
    err.code === 14 // gRPC UNAVAILABLE
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is not configured. Please set your Gemini API key in Settings > Secrets.'
      );
    }
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

export interface ModelCallOptions {
  useHighThinking?: boolean;
  systemInstruction?: string;
  responseMimeType?: 'application/json' | 'text/plain';
  responseSchema?: any;
}

// In-memory cooldown tracker for models that experience 429 quota limits
const modelCooldownUntil = new Map<string, number>();

export async function callGemini(
  promptOrParts: string | any[],
  options: ModelCallOptions = {}
): Promise<string> {
  const ai = getGeminiClient();

  // Model selection:
  // 1. gemini-3.1-flash-lite is the default high-availability production model:
  //    Generous free-tier limits (1,500 RPD, 15 RPM), ultra-low latency,
  //    and full support for JSON schemas, system instructions, and multi-part content.
  // 2. gemini-3.8-flash is prioritized for high-thinking reasoning tasks when available,
  //    or as an alternate model. (Note: free-tier limit for 3.8-flash is 20 RPD).
  const primaryModel = options.useHighThinking ? 'gemini-3.8-flash' : 'gemini-3.1-flash-lite';
  const alternateModel = options.useHighThinking ? 'gemini-3.1-flash-lite' : 'gemini-3.8-flash';

  const now = Date.now();
  const allCandidates = [primaryModel, alternateModel];
  // Filter out any models currently in rate-limit / quota cooldown
  const activeCandidates = allCandidates.filter((m) => (modelCooldownUntil.get(m) || 0) <= now);
  const modelsToTry = activeCandidates.length > 0 ? activeCandidates : allCandidates;

  let contents: any;
  if (typeof promptOrParts === 'string') {
    contents = promptOrParts;
  } else if (Array.isArray(promptOrParts)) {
    contents = { parts: promptOrParts };
  } else {
    contents = promptOrParts;
  }

  let lastError: any = null;

  for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
    const currentModel = modelsToTry[mIdx];
    const isPrimary = mIdx === 0;

    // Retry settings:
    // Primary model gets 1 retry on 503 high demand before switching
    const maxRetries = isPrimary ? 1 : 0;

    // Build model config
    const config: any = {};
    if (options.systemInstruction) {
      config.systemInstruction = options.systemInstruction;
    }
    if (options.responseMimeType) {
      config.responseMimeType = options.responseMimeType;
    }
    if (options.responseSchema) {
      config.responseSchema = options.responseSchema;
    }

    // Thinking config is only valid on models supporting thinking (e.g. gemini-3.8-flash)
    if (options.useHighThinking && (currentModel === 'gemini-3.8-flash' || currentModel === 'gemini-3.1-pro-preview')) {
      config.thinkingConfig = {
        thinkingLevel: ThinkingLevel.HIGH,
      };
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const callPromise = ai.models.generateContent({
          model: currentModel,
          contents,
          config,
        });

        // 30s timeout per request to prevent hanging
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('AI request timed out after 30 seconds.')), 30000);
        });

        const response: any = await Promise.race([callPromise, timeoutPromise]);

        const text = response?.text;
        if (text === undefined || text === null) {
          throw new Error('Gemini returned an empty response.');
        }

        return text;
      } catch (err: any) {
        lastError = err;
        const msg = (err.message || '').toLowerCase();
        const status = err.status || err.statusCode || err.response?.status;

        // Check for 401 / 403 (auth errors) - do NOT retry, fail immediately
        if (
          status === 401 ||
          status === 403 ||
          msg.includes('api key') ||
          msg.includes('unauthorized') ||
          msg.includes('permission denied')
        ) {
          console.error('[Gemini Auth Error]:', err.message);
          throw new Error(
            'Gemini API key is invalid or unauthorized. Please configure a valid GEMINI_API_KEY in Settings > Secrets.'
          );
        }

        // Check for 400 (bad request) - do NOT retry, fail immediately
        if (status === 400) {
          console.error('[Gemini 400 Bad Request]:', err.message);
          throw new Error(
            'The AI service could not process this request. Please try simplifying or shortening your input.'
          );
        }

        const isUnavailable = is503UnavailableError(err);

        if (isUnavailable) {
          console.warn(
            `[Gemini] ${currentModel} returned 503 UNAVAILABLE (attempt ${attempt + 1}/${maxRetries + 1}): high demand detected.`
          );

          if (attempt < maxRetries) {
            const backoffMs = 1000 * Math.pow(2, attempt) + Math.floor(Math.random() * 200 + 100);
            await sleep(backoffMs);
            continue;
          } else {
            break;
          }
        } else if (
          status === 429 ||
          msg.includes('quota') ||
          msg.includes('resource_exhausted') ||
          msg.includes('rate limit')
        ) {
          // Model exceeded quota or rate limit: put on cooldown for 2 minutes and fail over immediately
          modelCooldownUntil.set(currentModel, Date.now() + 120000);
          console.info(
            `[Gemini] ${currentModel} hit rate limit / quota. Cooling down for 2m and failing over to next model.`
          );
          break;
        } else {
          console.warn(`[Gemini] Error with ${currentModel}:`, err.message || err);
          break;
        }
      }
    }
  }

  // If all retries and fallback models failed
  if (is503UnavailableError(lastError)) {
    throw new GeminiHighDemandError();
  }

  // Sanitize any other error so raw JSON is never leaked
  const cleanMessage =
    lastError?.message && !lastError.message.includes('{')
      ? lastError.message
      : 'The AI service is temporarily unavailable. Please try again in a moment.';

  throw new Error(cleanMessage);
}
