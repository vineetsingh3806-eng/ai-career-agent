import type { JobProvider, JobSearchParams } from '../types';
import type { JobListing } from '../../../../src/types';

export function getSanitizedAdzunaCredentials(): { appId: string; appKey: string } {
  const rawId = process.env.ADZUNA_APP_ID || '';
  const rawKey = process.env.ADZUNA_APP_KEY || '';
  const appId = rawId.replace(/^ADZUNA_APP_ID=\s*/i, '').trim();
  const appKey = rawKey.replace(/^ADZUNA_APP_KEY=\s*/i, '').trim();
  return { appId, appKey };
}

export function detectAdzunaCountry(location?: string, countryParam?: string): string {
  const combined = `${countryParam || ''} ${location || ''}`.toLowerCase().trim();

  // If explicit Worldwide / Global / Abroad requested, use US index for global coverage
  if (/worldwide|global|international|outside india|abroad/.test(combined)) {
    return 'us';
  }

  // India default: if empty, or mentions India or any Indian city / region
  if (
    !combined ||
    /india|delhi|noida|bangalore|bengaluru|mumbai|gurgaon|gurugram|hyderabad|pune|chennai|kolkata|ahmedabad|karnataka|maharashtra|ncr|uttar pradesh|telangana|haryana|tamil nadu|gujarat/.test(
      combined
    )
  ) {
    return 'in';
  }

  // United Kingdom
  if (/uk|united kingdom|britain|london|manchester|birmingham|england|scotland|wales|leeds|bristol/.test(combined)) {
    return 'gb';
  }
  // Germany
  if (/germany|deutschland|berlin|munich|münchen|frankfurt|hamburg|cologne|köln|stuttgart/.test(combined)) {
    return 'de';
  }
  // Canada
  if (/canada|toronto|vancouver|montreal|ottawa|calgary|quebec|ontario/.test(combined)) {
    return 'ca';
  }
  // Australia
  if (/australia|sydney|melbourne|brisbane|perth|adelaide/.test(combined)) {
    return 'au';
  }
  // France
  if (/france|paris|lyon|marseille|toulouse/.test(combined)) {
    return 'fr';
  }
  // Netherlands
  if (/netherlands|holland|amsterdam|rotterdam|utrecht|the hague/.test(combined)) {
    return 'nl';
  }
  // Singapore
  if (/singapore/.test(combined)) {
    return 'sg';
  }
  // Poland
  if (/poland|polska|warsaw|krakow|wroclaw/.test(combined)) {
    return 'pl';
  }

  // Default to India for all unmapped or Indian searches
  return 'in';
}

export class AdzunaJobProvider implements JobProvider {
  public name = 'Adzuna Global Job Index';
  public id = 'adzuna';

  public isConfigured(): boolean {
    const { appId, appKey } = getSanitizedAdzunaCredentials();
    return Boolean(appId && appKey && !appId.includes('YOUR_') && !appKey.includes('YOUR_'));
  }

  public async search(params: JobSearchParams): Promise<JobListing[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const { appId, appKey } = getSanitizedAdzunaCredentials();
    const country = detectAdzunaCountry(params.location, params.country);
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(10, params.limit || 25));

    // Construct a clean, high-relevance query term
    let rawQuery = (params.role || params.query || '').trim();

    // Strip out location references and generic words from whatQuery
    if (params.location) {
      const locEscaped = params.location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      rawQuery = rawQuery.replace(new RegExp(`\\b(?:in|at|around|near|for)?\\s*${locEscaped}\\b`, 'gi'), '');
    }
    rawQuery = rawQuery
      .replace(/\b(?:jobs?|openings?|roles?|positions?|vacancies)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Clean query words: limit to top 4 words max
    const words = rawQuery.split(/\s+/).filter((w) => w.length > 1);
    const whatQuery = words.length > 0 ? words.slice(0, 4).join(' ') : '';

    let url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?app_id=${appId}&app_key=${appKey}&results_per_page=${limit}&content-type=application/json`;

    if (whatQuery) {
      url += `&what=${encodeURIComponent(whatQuery)}`;
    }

    // Only add specific city/region/state to `where` if it's not a generic country or worldwide
    const isGenericLocation =
      !params.location ||
      /^(india|all india|worldwide|global|remote|anywhere|abroad|international)$/i.test(params.location.trim());
    if (!isGenericLocation) {
      // Clean location string (remove "India", "in", etc. if present at end)
      const cleanLoc = params.location!.replace(/,\s*india$/i, '').trim();
      if (cleanLoc) {
        url += `&where=${encodeURIComponent(cleanLoc)}`;
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        // Do not throw or break the app if Adzuna quota/auth fails
        console.warn(`[AdzunaJobProvider] API returned ${res.status} for country ${country}`);
        return [];
      }

      const data = (await res.json()) as any;
      const results = Array.isArray(data.results) ? data.results : [];

      return results.map((item: any) => {
        const isRemote =
          item.title?.toLowerCase().includes('remote') ||
          item.description?.toLowerCase().includes('remote') ||
          item.location?.display_name?.toLowerCase().includes('remote') ||
          false;

        return {
          id: `job_adz_${item.id}`,
          title: item.title ? item.title.replace(/<[^>]*>?/gm, '').trim() : 'Open Position',
          company: item.company?.display_name || 'Hiring Organization',
          location: item.location?.display_name || (country === 'in' ? 'India' : 'International'),
          remote: isRemote,
          employmentType: item.contract_time === 'full_time' ? 'Full-time' : item.contract_time || 'Full-time',
          skills: [],
          salary: item.salary_min
            ? `${country === 'in' ? '₹' : '$'}${Math.round(item.salary_min).toLocaleString()}`
            : undefined,
          jobUrl: item.redirect_url,
          applyUrl: item.redirect_url,
          snippet: item.description
            ? item.description.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').slice(0, 220) + '...'
            : undefined,
          postedAt: item.created ? new Date(item.created).toLocaleDateString() : undefined,
          provider: 'Adzuna',
        };
      });
    } catch (err: any) {
      clearTimeout(timeout);
      console.warn('[AdzunaJobProvider] Search warning:', err.message || err);
      return [];
    }
  }
}
