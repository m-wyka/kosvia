import { Injectable, Logger } from '@nestjs/common';
import { OBF_SEARCH_FIELDS, type OpenBeautyFactsSearchPage } from './obf-types';

const BASE_URL = 'https://world.openbeautyfacts.org/api/v2/search';
/** Open Beauty Facts blocks anonymous user agents; this one names us and a contact. */
const USER_AGENT = 'Kosvia/0.1 (https://kosvia.pl; kontakt@kosvia.pl)';
const MAX_ATTEMPTS = 4;
const RETRY_BASE_DELAY_MS = 1500;
const REQUEST_TIMEOUT_MS = 30_000;
/** Be a polite client of a volunteer-run service. */
const MIN_DELAY_BETWEEN_REQUESTS_MS = 700;
export const OBF_PAGE_SIZE = 100;

export interface ObfSearchOptions {
  categoryTag: string;
  countryTag: string;
  page: number;
  pageSize?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class OpenBeautyFactsClient {
  private readonly logger = new Logger(OpenBeautyFactsClient.name);
  private lastRequestAt = 0;

  async searchPage(options: ObfSearchOptions): Promise<OpenBeautyFactsSearchPage> {
    const params = new URLSearchParams({
      categories_tags: options.categoryTag,
      countries_tags: options.countryTag,
      page: String(options.page),
      page_size: String(options.pageSize ?? OBF_PAGE_SIZE),
      fields: OBF_SEARCH_FIELDS.join(','),
    });
    return this.getJson<OpenBeautyFactsSearchPage>(`${BASE_URL}?${params.toString()}`);
  }

  private async getJson<T>(url: string): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      await this.throttle();
      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`Open Beauty Facts responded ${response.status}`);
        }
        if (!response.ok) {
          throw new Error(`Open Beauty Facts responded ${response.status} for ${url}`);
        }
        return (await response.json()) as T;
      } catch (error) {
        lastError = error;
        const delay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
        this.logger.warn(`Attempt ${attempt}/${MAX_ATTEMPTS} failed: ${String(error)}`);
        if (attempt < MAX_ATTEMPTS) {
          await sleep(delay);
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < MIN_DELAY_BETWEEN_REQUESTS_MS) {
      await sleep(MIN_DELAY_BETWEEN_REQUESTS_MS - elapsed);
    }
    this.lastRequestAt = Date.now();
  }
}
