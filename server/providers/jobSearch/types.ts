import type { JobListing } from '../../../src/types';

export interface JobSearchParams {
  query?: string;
  role?: string;
  domain?: string;
  skills?: string[];
  location?: string;
  country?: string;
  remoteOnly?: boolean;
  limit?: number;
  page?: number;
  mode?: 'personalized' | 'explore';
}

export interface JobProviderResult {
  jobs: JobListing[];
  providerName: string;
  isLive: boolean;
  statusMessage: string;
  totalFound: number;
  page?: number;
  hasMore?: boolean;
  providersContributed?: string[];
  mode?: 'personalized' | 'explore';
  locationScope?: string;
}

export interface JobProvider {
  name: string;
  isConfigured(): boolean;
  search(params: JobSearchParams): Promise<JobListing[]>;
}
