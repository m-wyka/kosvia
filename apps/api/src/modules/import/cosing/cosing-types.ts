export type CosIngAnnex = 'II' | 'III' | 'IV' | 'V' | 'VI';

export const COSING_ANNEXES: CosIngAnnex[] = ['II', 'III', 'IV', 'V', 'VI'];

/** Every field the EU Search API returns is an array of strings, even scalars. */
export interface CosIngSearchHit {
  reference: string;
  metadata: Record<string, string[] | undefined>;
}

export interface CosIngSearchPage {
  totalResults: number;
  pageNumber: number;
  pageSize: number;
  results: CosIngSearchHit[];
}

/** A lexicographic `substanceId` range the glossary is paged within. */
export interface CosIngIdRange {
  gte: string;
  lt: string;
  totalResults?: number;
}

export interface CosIngFunctionRecord {
  cosIngRef: string;
  name: string;
  description: string | null;
}

export interface CosIngIngredientRecord {
  cosIngRef: string;
  inciName: string;
  innName: string | null;
  casNumber: string | null;
  ecNumber: string | null;
  chemicalDescription: string | null;
  functionNames: string[];
  isPerfumingName: boolean;
  isActive: boolean;
}

export interface CosIngAnnexEntry {
  annex: CosIngAnnex;
  referenceNumber: string;
  /** Glossary / INCI names listed on the row, one per substance. */
  names: string[];
  maximumConcentration: string | null;
  conditions: string | null;
  isFragranceAllergen: boolean;
}
