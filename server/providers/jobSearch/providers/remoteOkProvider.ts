import type { JobProvider, JobSearchParams } from '../types';
import type { JobListing } from '../../../../src/types';

interface CachedFeed {
  data: any[];
  timestamp: number;
}

export class RemoteOkJobProvider implements JobProvider {
  public name = 'RemoteOK (Live Global Remote Jobs)';
  public id = 'remoteok';

  private cache: CachedFeed | null = null;
  private readonly CACHE_TTL_MS = 3 * 60 * 1000;

  public isConfigured(): boolean {
    return true;
  }

  private async fetchFeed(): Promise<any[]> {
    const now = Date.now();
    if (this.cache && now - this.cache.timestamp < this.CACHE_TTL_MS) {
      return this.cache.data;
    }

    const url = 'https://remoteok.com/api';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'AI-Career-Agent/1.0 (Live Job Aggregator)',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`RemoteOK API returned status ${res.status}`);
      }

      const raw = (await res.json()) as any[];
      if (!Array.isArray(raw)) return this.cache?.data || [];

      // First item in RemoteOK is a metadata/legal notice object
      const jobItems = raw.filter((item: any) => item && typeof item === 'object' && item.position && item.company);
      this.cache = { data: jobItems, timestamp: now };
      return jobItems;
    } catch (err: any) {
      clearTimeout(timeout);
      console.warn('[RemoteOkJobProvider] Live fetch warning:', err.message || err);
      return this.cache?.data || [];
    }
  }

  public async search(params: JobSearchParams): Promise<JobListing[]> {
    try {
      const allJobs = await this.fetchFeed();
      if (allJobs.length === 0) return [];

      const terms: string[] = [];
      if (params.query) {
        terms.push(...params.query.toLowerCase().split(/\s+/).filter((t) => t.length > 2));
      }
      if (params.role) {
        terms.push(...params.role.toLowerCase().split(/\s+/).filter((t) => t.length > 2));
      }
      if (params.skills && params.skills.length > 0) {
        terms.push(...params.skills.map((s) => s.toLowerCase().trim()).filter((t) => t.length > 2));
      }

      const isExplore = params.mode === 'explore';
      const targetLoc = (params.location || '').toLowerCase().trim();
      const isWorldwideRequest = /worldwide|global|international|outside india|abroad/i.test(targetLoc);
      const isIndiaRequest = !targetLoc || targetLoc === 'india' || /^(all\s+)?india$/i.test(targetLoc);
      const isSpecificLocation = Boolean(targetLoc && !isWorldwideRequest && !isIndiaRequest && targetLoc !== 'remote');

      const filtered = allJobs.filter((job: any) => {
        const jobLoc = (job.location || '').toLowerCase();
        const jobDesc = (job.description || '').toLowerCase();
        const tags = Array.isArray(job.tags) ? job.tags.map((t: string) => t.toLowerCase()) : [];

        // Check regional restrictions (e.g. US only, Europe only)
        const isRestrictedNonIndia =
          (jobLoc.includes('us only') ||
            jobLoc.includes('usa only') ||
            jobLoc.includes('north america') ||
            jobLoc.includes('europe only') ||
            jobLoc.includes('uk only') ||
            jobLoc.includes('canada only') ||
            jobLoc.includes('latin america') ||
            jobLoc.includes('latam')) &&
          !jobLoc.includes('india') &&
          !jobLoc.includes('apac') &&
          !jobLoc.includes('worldwide') &&
          !jobLoc.includes('global');

        // 1. SPECIFIC LOCATION (e.g. Noida, Bangalore, Pune, London)
        if (isSpecificLocation) {
          const matchesSpecific =
            jobLoc.includes(targetLoc) ||
            jobDesc.includes(targetLoc) ||
            tags.some((t: string) => t.includes(targetLoc));
          if (!matchesSpecific) {
            return false;
          }
        }
        // 2. INDIA DEFAULT / INDIA SCOPE
        else if (isIndiaRequest) {
          if (isRestrictedNonIndia) {
            return false;
          }
          const allowsIndia =
            jobLoc.includes('india') ||
            jobDesc.includes('india') ||
            tags.some((t: string) => t.includes('india')) ||
            !jobLoc ||
            jobLoc.includes('worldwide') ||
            jobLoc.includes('global') ||
            jobLoc.includes('anywhere') ||
            jobLoc.includes('apac') ||
            jobLoc.includes('asia');
          if (!allowsIndia) {
            return false;
          }
        }
        // 3. WORLDWIDE: Accepts all global remote jobs without restricting to India.

        // If search terms were provided, job must match at least one term
        if (terms.length > 0) {
          const haystack = `${job.position || ''} ${job.company || ''} ${tags.join(' ')} ${jobLoc} ${jobDesc.slice(0, 400)}`.toLowerCase();
          return terms.some((t) => haystack.includes(t));
        }

        return true;
      });

      if (filtered.length === 0) {
        return [];
      }

      // Pagination support
      const page = Math.max(1, params.page || 1);
      const limit = params.limit || 25;
      const startIndex = (page - 1) * limit;
      const selected = filtered.slice(startIndex, startIndex + limit);

      return selected.map((job: any) => {
        const locationText = job.location ? `Remote (${job.location})` : 'Remote (Worldwide)';
        const tags = Array.isArray(job.tags) ? job.tags.slice(0, 6) : ['Remote', 'Software'];

        return {
          id: `job_rok_${job.id || job.epoch || Math.abs(hashCode(job.position + job.company))}`,
          title: job.position,
          company: job.company,
          location: locationText,
          remote: true,
          employmentType: 'Full-time (Remote)',
          skills: tags,
          jobUrl: job.url || `https://remoteok.com/remote-jobs/${job.id}`,
          applyUrl: job.apply_url || job.url || `https://remoteok.com/remote-jobs/${job.id}`,
          snippet: job.description
            ? job.description.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').slice(0, 220) + '...'
            : undefined,
          postedAt: job.date ? new Date(job.date).toLocaleDateString() : undefined,
          provider: 'RemoteOK',
        };
      });
    } catch (err: any) {
      console.warn('[RemoteOkJobProvider] Search failed:', err.message || err);
      return [];
    }
  }
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
