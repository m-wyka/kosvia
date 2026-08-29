/** The subset of an Open Beauty Facts v2 product record the importer reads. */
export interface OpenBeautyFactsProduct {
  code?: string;
  product_name?: string;
  product_name_pl?: string;
  product_name_en?: string;
  brands?: string;
  categories_tags?: string[];
  ingredients_text?: string;
  ingredients_text_pl?: string;
  ingredients_text_en?: string;
  image_url?: string;
  quantity?: string;
  lang?: string;
  countries_tags?: string[];
  last_modified_t?: number;
}

export interface OpenBeautyFactsSearchPage {
  count: number;
  page: number;
  page_size: number;
  products: OpenBeautyFactsProduct[];
}

export const OBF_SEARCH_FIELDS = [
  'code',
  'product_name',
  'product_name_pl',
  'product_name_en',
  'brands',
  'categories_tags',
  'ingredients_text',
  'ingredients_text_pl',
  'ingredients_text_en',
  'image_url',
  'quantity',
  'lang',
  'countries_tags',
  'last_modified_t',
] as const;
