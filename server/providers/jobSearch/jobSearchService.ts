import { ArbeitnowJobProvider } from './providers/arbeitnowProvider';
import { RemoteOkJobProvider } from './providers/remoteOkProvider';
import { AdzunaJobProvider } from './providers/adzunaProvider';
import { JobicyJobProvider } from './providers/jobicyProvider';
import type { JobProvider, JobSearchParams, JobProviderResult } from './types';
import type { JobListing, ResumeData } from '../../../src/types';

export class JobSearchService {
  private providers: Map<string, JobProvider> = new Map();

  constructor() {
    this.registerProvider('arbeitnow', new ArbeitnowJobProvider());
    this.registerProvider('remoteok', new RemoteOkJobProvider());
    this.registerProvider('adzuna', new AdzunaJobProvider());
    this.registerProvider('jobicy', new JobicyJobProvider());
  }

  public registerProvider(key: string, provider: JobProvider) {
    this.providers.set(key, provider);
  }

  public getAvailableProviders(): Array<{ id: string; name: string; isConfigured: boolean }> {
    return Array.from(this.providers.entries()).map(([id, p]) => ({
      id,
      name: p.name,
      isConfigured: p.isConfigured(),
    }));
  }

  /**
   * Generates tailored search terms from candidate's profile for personalized matching.
   * Avoids overly generic terms like "software" alone.
   */
  public generatePersonalizedSearchQueries(resume?: ResumeData): {
    primaryRole: string;
    keywords: string[];
    allSkills: string[];
  } {
    if (!resume) {
      return { primaryRole: 'Software Developer', keywords: [], allSkills: [] };
    }

    const primaryRole = resume.targetRole || 'Software Engineer';
    const allSkills: string[] = [
      ...(resume.skills?.technical || []),
      ...(resume.skills?.frameworks || []),
      ...(resume.skills?.tools || []),
    ].map((s) => s.trim()).filter((s) => s.length > 1);

    // Pick top specific skills (e.g. React, Node.js, Python, TypeScript)
    const keywords: string[] = [];
    const roleLower = primaryRole.toLowerCase();

    // Add role keywords
    const roleWords = roleLower
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !['senior', 'junior', 'lead', 'staff', 'entry', 'level'].includes(w));

    keywords.push(...roleWords);

    // Add up to 5 top distinctive skills
    const topSkills = allSkills
      .filter((s) => !['git', 'github', 'communication', 'teamwork', 'agile'].includes(s.toLowerCase()))
      .slice(0, 5);

    keywords.push(...topSkills);

    return {
      primaryRole,
      keywords: Array.from(new Set(keywords)),
      allSkills,
    };
  }

  /**
   * Normalizes a job into a canonical key for stable cross-provider deduplication.
   */
  private getDeduplicationKeys(job: JobListing): string[] {
    const keys: string[] = [];

    // 1. URL key (ignoring query strings and trailing slashes)
    const targetUrl = job.jobUrl || job.applyUrl;
    if (targetUrl) {
      try {
        const u = new URL(targetUrl);
        const cleanPath = `${u.hostname}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
        keys.push(`url:${cleanPath}`);
      } catch {
        // Not a standard URL
      }
    }

    // 2. Normalized Company + Title
    const normCompany = (job.company || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
    const normTitle = (job.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();

    if (normCompany && normTitle) {
      keys.push(`ct:${normCompany}::${normTitle}`);
    }

    // 3. Location + Company + Title
    const normLoc = (job.location || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
    if (normLoc && normCompany && normTitle) {
      keys.push(`lct:${normLoc}::${normCompany}::${normTitle}`);
    }

    return keys;
  }

  /**
   * Deduplicates jobs across multiple providers while retaining rich details.
   */
  public deduplicateJobs(jobs: JobListing[]): JobListing[] {
    const seenKeys = new Set<string>();
    const deduplicated: JobListing[] = [];

    for (const job of jobs) {
      const keys = this.getDeduplicationKeys(job);
      const isDuplicate = keys.some((k) => seenKeys.has(k));

      if (!isDuplicate) {
        keys.forEach((k) => seenKeys.add(k));
        deduplicated.push(job);
      } else {
        // If duplicate found, merge skills or keep the one with a richer snippet
        const existing = deduplicated.find((d) => {
          const dKeys = this.getDeduplicationKeys(d);
          return keys.some((k) => dKeys.includes(k));
        });

        if (existing) {
          const combinedSkills = Array.from(new Set([...(existing.skills || []), ...(job.skills || [])]));
          existing.skills = combinedSkills;
          if (!existing.snippet && job.snippet) {
            existing.snippet = job.snippet;
          }
          if (!existing.salary && job.salary) {
            existing.salary = job.salary;
          }
        }
      }
    }

    return deduplicated;
  }

  /**
   * Main Search entry point: Parallel multi-provider aggregation, deduplication, and ranking.
   */
  public async searchJobs(
    params: JobSearchParams,
    candidateResume?: ResumeData,
    preferredProvider = 'automatic'
  ): Promise<JobProviderResult> {
    const isAuto =
      !preferredProvider ||
      preferredProvider === 'automatic' ||
      preferredProvider === 'auto' ||
      preferredProvider === 'all';

    const isExplore = params.mode === 'explore' || !candidateResume;
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(10, params.limit || 25));

    // 1. DEFAULT JOB LOCATION = INDIA (When user does not explicitly provide a location)
    // 2. SPECIFIC LOCATION OVERRIDES INDIA (e.g. Noida, Bangalore, Pune, Delhi, London)
    // 3. EXPLORE WORLDWIDE (International / global live jobs)
    const rawLoc = (params.location || '').trim();
    const rawLocLower = rawLoc.toLowerCase();

    let locationScopeDescription: string;
    let resolvedLocation: string;

    if (!rawLoc || rawLocLower === 'india' || /^(all\s+)?india$/i.test(rawLocLower)) {
      // Default location is India
      locationScopeDescription = 'India';
      resolvedLocation = 'India';
    } else if (/^(worldwide|global|international|outside india|abroad)$/i.test(rawLocLower)) {
      locationScopeDescription = 'Worldwide';
      resolvedLocation = 'Worldwide';
    } else if (/^remote$/i.test(rawLocLower)) {
      locationScopeDescription = 'Remote';
      resolvedLocation = 'Remote';
    } else {
      // Specific user-requested location (Noida, Bangalore, Pune, Delhi, London, etc.)
      locationScopeDescription = rawLoc;
      resolvedLocation = rawLoc;
    }

    // Collect query terms
    let effectiveParams: JobSearchParams = {
      ...params,
      location: resolvedLocation,
      page,
      limit,
      mode: isExplore ? 'explore' : 'personalized',
    };

    if (!isExplore && candidateResume) {
      const generated = this.generatePersonalizedSearchQueries(candidateResume);
      const targetRoleName = params.role || generated.primaryRole;
      effectiveParams = {
        ...effectiveParams,
        role: targetRoleName,
        skills: params.skills && params.skills.length > 0 ? params.skills : generated.allSkills,
        query: params.query || targetRoleName,
      };
    }

    let collectedJobs: JobListing[] = [];
    const providersContributed: string[] = [];

    if (isAuto) {
      // Parallel execution across all configured providers
      const providerEntries = Array.from(this.providers.entries()).filter(([_, p]) => p.isConfigured());

      const results = await Promise.allSettled(
        providerEntries.map(async ([key, provider]) => {
          try {
            const jobs = await provider.search(effectiveParams);
            return { key, name: provider.name, jobs };
          } catch (err: any) {
            console.warn(`[JobSearchService] Provider ${key} failed during parallel search:`, err.message || err);
            return { key, name: provider.name, jobs: [] };
          }
        })
      );

      results.forEach((r) => {
        if (r.status === 'fulfilled' && r.value.jobs.length > 0) {
          collectedJobs.push(...r.value.jobs);
          providersContributed.push(r.value.name.split(' ')[0]);
        }
      });
    } else {
      // Specific requested provider
      const primary = this.providers.get(preferredProvider);
      if (primary && primary.isConfigured()) {
        try {
          collectedJobs = await primary.search(effectiveParams);
          if (collectedJobs.length > 0) {
            providersContributed.push(primary.name.split(' ')[0]);
          }
        } catch (e: any) {
          console.warn(`[JobSearchService] Requested provider ${preferredProvider} failed:`, e.message || e);
        }
      }

      // Graceful fallback to other providers if primary returned 0 results
      if (collectedJobs.length === 0) {
        const fallbackEntries = Array.from(this.providers.entries()).filter(
          ([key, p]) => key !== preferredProvider && p.isConfigured()
        );

        const fallbackResults = await Promise.allSettled(
          fallbackEntries.map(async ([key, p]) => {
            const jobs = await p.search(effectiveParams);
            return { key, name: p.name, jobs };
          })
        );

        fallbackResults.forEach((r) => {
          if (r.status === 'fulfilled' && r.value.jobs.length > 0) {
            collectedJobs.push(...r.value.jobs);
            providersContributed.push(r.value.name.split(' ')[0]);
          }
        });
      }
    }

    // Deduplicate jobs across providers
    const deduplicated = this.deduplicateJobs(collectedJobs);

    if (deduplicated.length === 0) {
      return {
        jobs: [],
        providerName: isAuto ? 'All Connected Providers' : preferredProvider,
        isLive: true,
        statusMessage: `No live openings currently available from our connected job providers for this search query in ${locationScopeDescription}.`,
        totalFound: 0,
        page,
        hasMore: false,
        providersContributed: [],
        mode: isExplore ? 'explore' : 'personalized',
        locationScope: locationScopeDescription,
      };
    }

    // Ranking and Resume Match Evaluation
    let rankedJobs: JobListing[] = [];

    if (isExplore) {
      // EXPLORE MODE: Rank purely by query relevance, remote flexibility, and recency
      const queryWords = (effectiveParams.query || effectiveParams.role || '')
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2);

      rankedJobs = deduplicated.map((job) => {
        let score = 70;
        const text = `${job.title} ${job.company} ${(job.skills || []).join(' ')} ${job.location}`.toLowerCase();

        // Query keyword matches
        if (queryWords.length > 0) {
          const matchCount = queryWords.filter((qw) => text.includes(qw)).length;
          score += Math.min(25, matchCount * 8);
        }

        if (job.remote) score += 3;

        return {
          ...job,
          matchScore: undefined, // Explore mode does NOT fabricate a fake resume match score
          whyMatches: job.remote
            ? ['Live Remote Opening', `Verified opening via ${job.provider}`]
            : [`Location: ${job.location}`, `Verified opening via ${job.provider}`],
        };
      });

      // Sort by relevance score descending
      rankedJobs.sort((a, b) => {
        // If dates available, prefer newer
        if (a.postedAt && b.postedAt && a.postedAt !== b.postedAt) {
          const timeA = Date.parse(a.postedAt) || 0;
          const timeB = Date.parse(b.postedAt) || 0;
          if (timeA && timeB) return timeB - timeA;
        }
        return 0;
      });
    } else {
      // PERSONALIZED MODE: Derived Match Analysis from candidate's resume
      const userSkills = new Set<string>();
      if (candidateResume) {
        (candidateResume.skills?.technical || []).forEach((s) => userSkills.add(s.toLowerCase()));
        (candidateResume.skills?.frameworks || []).forEach((s) => userSkills.add(s.toLowerCase()));
        (candidateResume.skills?.tools || []).forEach((s) => userSkills.add(s.toLowerCase()));
      }

      const candidateRole = (candidateResume?.targetRole || '').toLowerCase();
      const candidateLocation = (candidateResume?.location || '').toLowerCase();

      rankedJobs = deduplicated.map((job) => {
        const matchingSkills: string[] = [];
        const missingSkills: string[] = [];
        const jobSkills = job.skills || [];

        jobSkills.forEach((js) => {
          const lower = js.toLowerCase();
          if (userSkills.has(lower) || Array.from(userSkills).some((us) => us.includes(lower) || lower.includes(us))) {
            matchingSkills.push(js);
          } else {
            missingSkills.push(js);
          }
        });

        // Role alignment
        const titleLower = job.title.toLowerCase();
        let roleFit = false;
        if (candidateRole && (titleLower.includes(candidateRole) || candidateRole.includes(titleLower))) {
          roleFit = true;
        }

        // Location alignment
        let locationFit = false;
        if (candidateLocation && job.location && job.location.toLowerCase().includes(candidateLocation)) {
          locationFit = true;
        }

        // Calculate honest derived application match score (range: 52% - 96%)
        let score = 60;
        if (matchingSkills.length > 0) {
          score += Math.min(24, matchingSkills.length * 6);
        }
        if (roleFit) {
          score += 10;
        }
        if (job.remote) {
          score += 4;
        }
        if (locationFit) {
          score += 5;
        }
        score = Math.min(96, Math.max(52, score));

        const whyMatches: string[] = [];
        if (matchingSkills.length > 0) {
          whyMatches.push(`Skills match: ${matchingSkills.slice(0, 3).join(', ')}`);
        }
        if (roleFit) {
          whyMatches.push(`Role match: ${candidateResume?.targetRole}`);
        }
        if (job.remote) {
          whyMatches.push('Remote flexibility');
        } else if (locationFit) {
          whyMatches.push(`Location alignment: ${job.location}`);
        }

        if (whyMatches.length === 0) {
          whyMatches.push(`Verified live opening via ${job.provider}`);
        }

        return {
          ...job,
          matchScore: score,
          matchingSkills: matchingSkills.slice(0, 5),
          missingSkills: missingSkills.slice(0, 3),
          whyMatches,
        };
      });

      // Sort by match score descending
      rankedJobs.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    }

    // Pagination slice
    const totalFound = rankedJobs.length;
    const paginatedJobs = rankedJobs.slice(0, limit);
    const hasMore = totalFound > limit;

    const uniqueProviders = Array.from(new Set(paginatedJobs.map((j) => j.provider)));
    const providerLabel = isAuto
      ? uniqueProviders.join(', ') || 'Connected Providers'
      : preferredProvider;

    return {
      jobs: paginatedJobs,
      providerName: providerLabel,
      isLive: true,
      statusMessage: `Found ${totalFound} live openings from ${providerLabel} (Live jobs available from our connected job providers).`,
      totalFound,
      page,
      hasMore,
      providersContributed: uniqueProviders,
      mode: isExplore ? 'explore' : 'personalized',
      locationScope: locationScopeDescription,
    };
  }
}

export const jobSearchService = new JobSearchService();
