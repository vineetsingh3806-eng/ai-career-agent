import type { JobProvider, JobSearchParams } from '../types';
import type { JobListing } from '../../../../src/types';

interface CachedPage {
  data: any[];
  timestamp: number;
}

export class ArbeitnowJobProvider implements JobProvider {
  public name = 'Arbeitnow (Live Job Board)';
  public id = 'arbeitnow';

  // In-memory cache: key -> CachedPage (TTL: 3 minutes)
  private cache = new Map<string, CachedPage>();
  private readonly CACHE_TTL_MS = 3 * 60 * 1000;

  public isConfigured(): boolean {
    return true;
  }

  private async fetchPage(page: number, search?: string): Promise<any[]> {
    const cacheKey = `${search || 'all'}_${page}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.data;
    }

    let url = `https://www.arbeitnow.com/api/job-board-api?page=${page}`;
    if (search && search.trim()) {
      url += `&search=${encodeURIComponent(search.trim())}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'AI-Career-Agent/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Arbeitnow API error: ${res.status} ${res.statusText}`);
      }

      const json = (await res.json()) as { data?: any[] };
      const rawJobs = Array.isArray(json.data) ? json.data : [];
      this.cache.set(cacheKey, { data: rawJobs, timestamp: now });
      return rawJobs;
    } catch (err: any) {
      clearTimeout(timeout);
      console.warn(`[ArbeitnowJobProvider] Live fetch warning for page ${page}:`, err.message || err);
      return cached?.data || [];
    }
  }

  public async search(params: JobSearchParams): Promise<JobListing[]> {
    try {
      const page = Math.max(1, params.page || 1);
      const searchRole = (params.role || params.query || '').trim();
      const firstWord = searchRole.split(/\s+/)[0] || '';
      const rawJobs = await this.fetchPage(page, firstWord.length > 2 ? firstWord : undefined);

      if (rawJobs.length === 0) {
        return [];
      }

      // Build search terms
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
      const isRemoteRequest = Boolean(params.remoteOnly || /remote|wfh/i.test(targetLoc));

      const filtered = rawJobs.filter((job: any) => {
        const jobLoc = (job.location || '').toLowerCase();
        const jobDesc = (job.description || '').toLowerCase();
        const jobTags = Array.isArray(job.tags) ? job.tags.map((t: string) => t.toLowerCase()) : [];
        const isRemote = Boolean(job.remote);

        // Remote filter
        if (isRemoteRequest && !isRemote) {
          return false;
        }

        // 1. SPECIFIC LOCATION (e.g. Noida, Bangalore, Pune, Berlin, London)
        if (isSpecificLocation) {
          const locMatch =
            jobLoc.includes(targetLoc) ||
            jobDesc.includes(targetLoc) ||
            jobTags.some((t: string) => t.includes(targetLoc)) ||
            (job.title || '').toLowerCase().includes(targetLoc);
          if (!locMatch) {
            return false;
          }
        }
        // 2. INDIA DEFAULT / INDIA SCOPE
        else if (isIndiaRequest) {
          const mentionsIndia =
            jobLoc.includes('india') ||
            jobDesc.includes('india') ||
            jobTags.some((t: string) => t.includes('india')) ||
            jobLoc.includes('bangalore') ||
            jobLoc.includes('bengaluru') ||
            jobLoc.includes('noida') ||
            jobLoc.includes('delhi') ||
            jobLoc.includes('pune') ||
            jobLoc.includes('mumbai') ||
            jobLoc.includes('hyderabad') ||
            jobLoc.includes('chennai');

          const isRestrictedNonIndia =
            (jobLoc.includes('germany') ||
              jobLoc.includes('deutschland') ||
              jobLoc.includes('berlin') ||
              jobLoc.includes('munich') ||
              jobLoc.includes('austria') ||
              jobLoc.includes('switzerland') ||
              jobLoc.includes('eu only') ||
              jobLoc.includes('uk only')) &&
            !mentionsIndia &&
            !jobLoc.includes('worldwide') &&
            !jobLoc.includes('global');

          if (isRestrictedNonIndia && !mentionsIndia) {
            return false;
          }

          const allowsIndia =
            mentionsIndia ||
            (isRemote && (jobLoc.includes('worldwide') || jobLoc.includes('global') || !jobLoc || jobDesc.includes('worldwide')));

          if (!allowsIndia) {
            return false;
          }
        }
        // 3. WORLDWIDE: accepts all live openings across Europe, US, Remote, and worldwide.

        // If search terms were provided, job must match at least one relevant keyword
        if (terms.length > 0) {
          const jobText = `${job.title || ''} ${job.company_name || ''} ${jobTags.join(' ')} ${jobLoc} ${jobDesc.slice(0, 400)}`.toLowerCase();
          return terms.some((term) => jobText.includes(term));
        }

        return true;
      });

      // Never fall back to unrelated rawJobs when filters yielded no matches
      if (filtered.length === 0) {
        return [];
      }

      const limit = params.limit || 25;
      const selected = filtered.slice(0, limit);

      return selected.map((item: any, idx: number) => {
        const skills = Array.isArray(item.tags) && item.tags.length > 0
          ? item.tags
          : ['Software Engineering', 'Technology'];

        return {
          id: `job_arb_${item.slug || item.id || idx}`,
          title: item.title,
          company: item.company_name,
          location: item.location || (item.remote ? 'Remote' : 'Flexible'),
          remote: Boolean(item.remote),
          employmentType: Array.isArray(item.job_types) ? item.job_types.join(', ') : 'Full-time',
          skills,
          jobUrl: item.url,
          applyUrl: item.url,
          snippet: item.description
            ? item.description.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').slice(0, 220) + '...'
            : undefined,
          postedAt: item.created_at ? new Date(item.created_at * 1000).toLocaleDateString() : undefined,
          provider: 'Arbeitnow',
        };
      });
    } catch (err: any) {
      console.warn('[ArbeitnowJobProvider] Search failed:', err.message || err);
      return [];
    }
  }
}
