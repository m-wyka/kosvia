import { Injectable, Logger } from '@nestjs/common';
import type {
  CosIngAnnex,
  CosIngFunctionRecord,
  CosIngIdRange,
  CosIngIngredientRecord,
  CosIngSearchHit,
  CosIngSearchPage,
} from './cosing-types';

/**
 * CosIng 2.0 has no bulk download of the glossary. The public web application
 * reads it through the Commission's EU Search API with a key shipped in its
 * own config (assets/env-json-config.json), and the annexes through a CSV export.
 */
const SEARCH_URL = 'https://webgate.ec.europa.eu/es/search-api/rest/search';
const SEARCH_API_KEY = '285a77fd-1257-4271-8507-f0c6b2961203';
const ANNEX_EXPORT_URL = 'https://api.tech.ec.europa.eu/cosing20/1.0/api/annexes';
const USER_AGENT = 'Kosvia/0.1 (https://kosvia.pl; kontakt@kosvia.pl)';
/** The search API silently caps a page at 200 hits. */
export const COSING_PAGE_SIZE = 200;
/** Elasticsearch stops paging past this many hits, so the glossary is read in id ranges. */
export const COSING_MAX_RESULT_WINDOW = 10_000;
/** Longer than any id and all nines, so `gte: "5", lt: "59999999999"` covers every id starting with 5. */
const AFTER_DIGITS = '9'.repeat(10);
/** Ids never start with 0 — and a range from "0" is answered with the whole glossary. */
const LEADING_DIGITS = '123456789';
const MAX_RANGE_DEPTH = 3;
const MAX_ATTEMPTS = 4;
const RETRY_BASE_DELAY_MS = 1500;
const REQUEST_TIMEOUT_MS = 60_000;
const MIN_DELAY_BETWEEN_REQUESTS_MS = 300;
const ACTIVE_STATUS = 'Active';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const first = (hit: CosIngSearchHit, key: string): string | null => {
  const value = hit.metadata[key]?.[0]?.trim();
  return value && value !== '-' ? value : null;
};

const all = (hit: CosIngSearchHit, key: string): string[] =>
  (hit.metadata[key] ?? []).map((value) => value.trim()).filter(Boolean);

@Injectable()
export class CosIngClient {
  private readonly logger = new Logger(CosIngClient.name);
  private lastRequestAt = 0;

  async fetchFunctions(): Promise<CosIngFunctionRecord[]> {
    const page = await this.search('function', 1, 500);
    return page.results.flatMap((hit) => {
      const cosIngRef = first(hit, 'functionId');
      const name = first(hit, 'functionName');
      if (!cosIngRef || !name) {
        return [];
      }
      return [{ cosIngRef, name, description: first(hit, 'functionDescription') }];
    });
  }

  /**
   * Splits the glossary into `substanceId` prefix ranges small enough to page
   * through: ids are strings ("57559", "100000"), so a prefix range is
   * `gte: "5", lt: "59999999999"`; a range that is still too large is split one digit deeper.
   */
  async planIngredientRanges(prefix = '', depth = 0): Promise<CosIngIdRange[]> {
    if (depth > MAX_RANGE_DEPTH) {
      throw new Error(`CosIng id range "${prefix}" cannot be split small enough to page`);
    }
    const ranges: CosIngIdRange[] = [];
    for (const digit of prefix ? '0123456789' : LEADING_DIGITS) {
      const range = { gte: `${prefix}${digit}`, lt: `${prefix}${digit}${AFTER_DIGITS}` };
      const page = await this.search('ingredient', 1, 1, range);
      if (page.totalResults === 0) {
        continue;
      }
      if (page.totalResults >= COSING_MAX_RESULT_WINDOW) {
        ranges.push(...(await this.planIngredientRanges(`${prefix}${digit}`, depth + 1)));
      } else {
        ranges.push({ ...range, totalResults: page.totalResults });
      }
    }
    return ranges;
  }

  async fetchIngredientPage(
    range: CosIngIdRange,
    pageNumber: number,
  ): Promise<{ totalResults: number; records: CosIngIngredientRecord[] }> {
    const page = await this.search('ingredient', pageNumber, COSING_PAGE_SIZE, range);
    const records = page.results.flatMap((hit) => {
      const cosIngRef = first(hit, 'substanceId');
      const inciName = first(hit, 'inciName') ?? first(hit, 'nameOfCommonIngredientsGlossary');
      if (!cosIngRef || !inciName) {
        return [];
      }
      return [
        {
          cosIngRef,
          inciName,
          innName: first(hit, 'innName'),
          casNumber: first(hit, 'casNo'),
          ecNumber: first(hit, 'ecNo'),
          chemicalDescription: first(hit, 'chemicalDescription'),
          functionNames: all(hit, 'functionName'),
          isPerfumingName: first(hit, 'perfuming') === 'Y',
          isActive: (first(hit, 'status') ?? ACTIVE_STATUS) === ACTIVE_STATUS,
        },
      ];
    });
    return { totalResults: page.totalResults, records };
  }

  async fetchAnnexCsv(annex: CosIngAnnex): Promise<string> {
    const response = await this.request(`${ANNEX_EXPORT_URL}/${annex}/export-csv`, {
      headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
    });
    return response.text();
  }

  private async search(
    itemType: 'ingredient' | 'function',
    pageNumber: number,
    pageSize: number,
    range?: Pick<CosIngIdRange, 'gte' | 'lt'>,
  ): Promise<CosIngSearchPage> {
    const params = new URLSearchParams({
      apiKey: SEARCH_API_KEY,
      text: '*',
      pageSize: String(pageSize),
      pageNumber: String(pageNumber),
    });
    const body = new FormData();
    const query = {
      bool: {
        must: [
          { term: { itemType } },
          ...(range ? [{ range: { substanceId: { gte: range.gte, lt: range.lt } } }] : []),
        ],
      },
    };
    body.append('query', new Blob([JSON.stringify(query)], { type: 'application/json' }));
    const sort = [{ field: 'substanceId', order: 'ASC' }];
    body.append('sort', new Blob([JSON.stringify(sort)], { type: 'application/json' }));

    const response = await this.request(`${SEARCH_URL}?${params.toString()}`, {
      method: 'POST',
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      body,
    });
    return (await response.json()) as CosIngSearchPage;
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      await this.throttle();
      try {
        const response = await fetch(url, {
          ...init,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`CosIng responded ${response.status}`);
        }
        if (!response.ok) {
          throw new Error(`CosIng responded ${response.status} for ${url}`);
        }
        return response;
      } catch (error) {
        lastError = error;
        this.logger.warn(`Attempt ${attempt}/${MAX_ATTEMPTS} failed: ${String(error)}`);
        if (attempt < MAX_ATTEMPTS) {
          await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
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
