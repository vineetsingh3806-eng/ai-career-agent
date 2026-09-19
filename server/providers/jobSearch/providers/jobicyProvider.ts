import type { JobProvider, JobSearchParams } from '../types';
import type { JobListing } from '../../../../src/types';

interface CachedJobicy {
  jobs: any[];
  timestamp: number;
}

export class JobicyJobProvider implements JobProvider {
  public name = 'Jobicy (Live Remote Tech Jobs)';
  public id = 'jobicy';

  private cache: CachedJobicy | null = null;
  private readonly CACHE_TTL_MS = 3 * 60 * 1000;

  public isConfigured(): boolean {
    return true;
  }

  private async fetchFeed(tag?: string): Promise<any[]> {
    const now = Date.now();
    if (!tag && this.cache && now - this.cache.timestamp < this.CACHE_TTL_MS) {
      return this.cache.jobs;
    }

    const queryTag = tag ? `&tag=${encodeURIComponent(tag)}` : '&tag=dev';
    const url = `https://jobicy.com/api/v2/remote-jobs?count=50${queryTag}`;
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
        throw new Error(`Jobicy API error: ${res.status}`);
      }

      const json = (await res.json()) as { jobs?: any[] };
      const rawJobs = Array.isArray(json.jobs) ? json.jobs : [];
      if (!tag) {
        this.cache = { jobs: rawJobs, timestamp: now };
      }
      return rawJobs;
    } catch (err: any) {
      clearTimeout(timeout);
      console.warn('[JobicyJobProvider] Live fetch warning:', err.message || err);
      return this.cache?.jobs || [];
    }
  }

  public async search(params: JobSearchParams): Promise<JobListing[]> {
    try {
      const roleOrQuery = (params.role || params.query || '').toLowerCase();
      let tag: string | undefined;
      if (roleOrQuery.includes('dev') || roleOrQuery.includes('software') || roleOrQuery.includes('engineer') || roleOrQuery.includes('react') || roleOrQuery.includes('python')) {
        tag = 'dev';
      } else if (roleOrQuery.includes('data') || roleOrQuery.includes('ai') || roleOrQuery.includes('machine learning')) {
        tag = 'data-science';
      }

      const rawJobs = await this.fetchFeed(tag);
      if (rawJobs.length === 0) return [];

      const targetLoc = (params.location || '').toLowerCase().trim();
      const isWorldwide = /worldwide|global|international|outside india|abroad/i.test(targetLoc);
      const isIndia = targetLoc === 'india' || /^(all\s+)?india$/i.test(targetLoc) || !targetLoc;
      const isSpecific = Boolean(targetLoc && !isWorldwide && !isIndia && targetLoc !== 'remote');

      const terms: string[] = [];
      if (params.query) {
        terms.push(...params.query.toLowerCase().split(/\s+/).filter((t) => t.length > 2));
      }
      if (params.role) {
        terms.push(...params.role.toLowerCase().split(/\s+/).filter((t) => t.length > 2));
      }

      const filtered = rawJobs.filter((job: any) => {
        const geo = (job.jobGeo || '').toLowerCase();
        const title = (job.jobTitle || '').toLowerCase();
        const desc = (job.jobExcerpt || job.jobDescription || '').toLowerCase();

        // 1. SPECIFIC LOCATION
        if (isSpecific) {
          const matches = geo.includes(targetLoc) || desc.includes(targetLoc) || title.includes(targetLoc);
          if (!matches) return false;
        }
        // 2. INDIA DEFAULT
        else if (isIndia) {
          const isRestrictedNonIndia =
            (geo.includes('usa only') || geo.includes('us only') || geo.includes('uk only') || geo.includes('canada only') || geo.includes('europe only')) &&
            !geo.includes('india') &&
            !geo.includes('anywhere') &&
            !geo.includes('apac');

          if (isRestrictedNonIndia) return false;

          const allowsIndia =
            geo.includes('anywhere') ||
            geo.includes('india') ||
            geo.includes('apac') ||
            geo.includes('worldwide') ||
            geo.includes('global') ||
            !geo;
          if (!allowsIndia) return false;
        }
        // 3. WORLDWIDE: accepts all

        // Filter by terms if any
        if (terms.length > 0) {
          const haystack = `${title} ${(job.companyName || '')} ${(job.jobIndustry || []).join(' ')} ${desc.slice(0, 300)}`.toLowerCase();
          return terms.some((t) => haystack.includes(t));
        }

        return true;
      });

      const limit = params.limit || 25;
      const selected = filtered.slice(0, limit);

      return selected.map((item: any) => {
        const skills = Array.isArray(item.jobIndustry) ? item.jobIndustry : ['Technology', 'Remote'];
        return {
          id: `job_jby_${item.id}`,
          title: item.jobTitle,
          company: item.companyName,
          location: item.jobGeo ? `Remote (${item.jobGeo})` : 'Remote (Worldwide)',
          remote: true,
          employmentType: Array.isArray(item.jobType) ? item.jobType.join(', ') : 'Full-time',
          skills,
          jobUrl: item.url,
          applyUrl: item.url,
          snippet: item.jobExcerpt
            ? item.jobExcerpt.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').slice(0, 220) + '...'
            : undefined,
          postedAt: item.pubDate ? new Date(item.pubDate).toLocaleDateString() : undefined,
          provider: 'Jobicy',
        };
      });
    } catch (err: any) {
      console.warn('[JobicyJobProvider] Search failed:', err.message || err);
      return [];
    }
  }
}
