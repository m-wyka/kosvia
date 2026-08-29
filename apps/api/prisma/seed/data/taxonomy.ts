/**
 * Beauty concerns, goals, categories and stores.
 *
 * DEMO DATA — everything in prisma/seed is invented for local development.
 * Brands, products, prices and store offers do not describe real merchandise.
 */

export const CONCERNS = [
  {
    slug: 'acne',
    name: 'Acne & breakouts',
    description: 'Frequent spots, congestion or inflamed blemishes.',
  },
  {
    slug: 'blackheads',
    name: 'Blackheads',
    description: 'Visible congestion, mainly around the nose and chin.',
  },
  {
    slug: 'redness',
    name: 'Redness',
    description: 'Skin flushes easily or looks persistently pink.',
  },
  {
    slug: 'pigmentation',
    name: 'Pigmentation',
    description: 'Dark marks left after blemishes or sun exposure.',
  },
  {
    slug: 'dryness',
    name: 'Dryness',
    description: 'Skin lacks oil — feels tight, rough or flaky.',
  },
  {
    slug: 'dehydration',
    name: 'Dehydration',
    description: 'Skin lacks water — looks dull and feels papery.',
  },
  {
    slug: 'wrinkles',
    name: 'Fine lines & wrinkles',
    description: 'Expression lines and loss of firmness.',
  },
  {
    slug: 'pores',
    name: 'Visible pores',
    description: 'Pores that look enlarged, especially in the T-zone.',
  },
  {
    slug: 'uneven-tone',
    name: 'Uneven tone',
    description: 'Patchy colour or lack of overall radiance.',
  },
] as const;

export const GOALS = [
  {
    slug: 'hydration',
    name: 'Hydration',
    description: 'Keep water in the skin throughout the day.',
  },
  {
    slug: 'barrier-support',
    name: 'Barrier support',
    description: 'Strengthen the skin’s protective layer.',
  },
  {
    slug: 'anti-aging',
    name: 'Anti-ageing',
    description: 'Support firmness and smooth expression lines.',
  },
  {
    slug: 'brightening',
    name: 'Brightening',
    description: 'Even out tone and bring back radiance.',
  },
  {
    slug: 'acne-care',
    name: 'Blemish care',
    description: 'Care routine for congestion-prone skin.',
  },
  { slug: 'sun-protection', name: 'Sun protection', description: 'Daily UV defence.' },
  { slug: 'soothing', name: 'Soothing', description: 'Calm reactive, easily irritated skin.' },
] as const;

export type RoutineStepSeed =
  | 'CLEANSER'
  | 'TONER'
  | 'EXFOLIANT'
  | 'SERUM'
  | 'EYE'
  | 'MOISTURIZER'
  | 'SPF'
  | 'MASK'
  | 'TREATMENT'
  | 'BODY'
  | 'HAIR'
  | 'MAKEUP'
  | 'OTHER';

export interface CategorySeed {
  slug: string;
  name: string;
  parent?: string;
  routineStep: RoutineStepSeed;
  description?: string;
  sortOrder?: number;
}

/** Three-level tree: Skincare → Face → Moisturizers. */
export const CATEGORIES: CategorySeed[] = [
  {
    slug: 'skincare',
    name: 'Skincare',
    routineStep: 'OTHER',
    sortOrder: 1,
    description: 'Everything you put on your skin, from cleansers to SPF.',
  },
  { slug: 'face', name: 'Face', parent: 'skincare', routineStep: 'OTHER', sortOrder: 1 },
  { slug: 'body', name: 'Body', parent: 'skincare', routineStep: 'BODY', sortOrder: 2 },

  {
    slug: 'cleansers',
    name: 'Cleansers',
    parent: 'face',
    routineStep: 'CLEANSER',
    sortOrder: 1,
    description: 'Gels, creams, balms and micellar waters that remove the day.',
  },
  {
    slug: 'toners',
    name: 'Toners & essences',
    parent: 'face',
    routineStep: 'TONER',
    sortOrder: 2,
    description: 'Watery layers applied after cleansing.',
  },
  {
    slug: 'exfoliants',
    name: 'Exfoliants',
    parent: 'face',
    routineStep: 'EXFOLIANT',
    sortOrder: 3,
    description: 'Acid and enzyme products that loosen dead surface cells.',
  },
  {
    slug: 'serums',
    name: 'Serums',
    parent: 'face',
    routineStep: 'SERUM',
    sortOrder: 4,
    description: 'Concentrated treatment steps with a clear purpose.',
  },
  {
    slug: 'moisturizers',
    name: 'Moisturizers',
    parent: 'face',
    routineStep: 'MOISTURIZER',
    sortOrder: 5,
    description: 'Creams, gels and lotions that hold hydration in place.',
  },
  {
    slug: 'eye-care',
    name: 'Eye care',
    parent: 'face',
    routineStep: 'EYE',
    sortOrder: 6,
    description: 'Lightweight formulas for the thinner skin around the eyes.',
  },
  {
    slug: 'sun-care',
    name: 'Sun care',
    parent: 'face',
    routineStep: 'SPF',
    sortOrder: 7,
    description: 'Daily UV protection for the face.',
  },
  {
    slug: 'masks',
    name: 'Masks',
    parent: 'face',
    routineStep: 'MASK',
    sortOrder: 8,
    description: 'Occasional intensive steps.',
  },
  {
    slug: 'face-oils',
    name: 'Face oils',
    parent: 'face',
    routineStep: 'TREATMENT',
    sortOrder: 9,
    description: 'Lipid-rich finishing steps.',
  },

  { slug: 'body-lotions', name: 'Body lotions', parent: 'body', routineStep: 'BODY', sortOrder: 1 },
  { slug: 'hand-care', name: 'Hand care', parent: 'body', routineStep: 'BODY', sortOrder: 2 },

  {
    slug: 'haircare',
    name: 'Haircare',
    routineStep: 'HAIR',
    sortOrder: 2,
    description: 'Shampoos, conditioners and scalp care.',
  },
  { slug: 'shampoos', name: 'Shampoos', parent: 'haircare', routineStep: 'HAIR', sortOrder: 1 },
  {
    slug: 'conditioners',
    name: 'Conditioners & masks',
    parent: 'haircare',
    routineStep: 'HAIR',
    sortOrder: 2,
  },
];

export interface StoreSeed {
  slug: string;
  name: string;
  websiteUrl: string;
  affiliateUrlTemplate?: string;
}

/**
 * Fictional demo retailers. Real retailer integrations are deliberately out of
 * scope for the MVP — see README, "Known limitations".
 */
export const STORES: StoreSeed[] = [
  {
    slug: 'demo-drogeria',
    name: 'Demo Drogeria',
    websiteUrl: 'https://demo-drogeria.example',
    affiliateUrlTemplate: 'https://demo-drogeria.example/p/{sku}?ref=kosvia',
  },
  {
    slug: 'demo-apteka',
    name: 'Demo Apteka',
    websiteUrl: 'https://demo-apteka.example',
    affiliateUrlTemplate: 'https://demo-apteka.example/produkt/{sku}?ref=kosvia',
  },
  {
    slug: 'demo-perfumeria',
    name: 'Demo Perfumeria',
    websiteUrl: 'https://demo-perfumeria.example',
    affiliateUrlTemplate: 'https://demo-perfumeria.example/{sku}?utm_source=kosvia',
  },
  { slug: 'demo-market', name: 'Demo Market', websiteUrl: 'https://demo-market.example' },
  {
    slug: 'demo-beauty-club',
    name: 'Demo Beauty Club',
    websiteUrl: 'https://demo-beauty-club.example',
  },
];

export interface BrandSeed {
  slug: string;
  name: string;
  description: string;
  isVegan: boolean;
  isCrueltyFree: boolean;
  /** Rough price positioning, used to generate believable offer prices. */
  tier: 'value' | 'mid' | 'premium';
}

/** 22 invented brands. Any resemblance to real brands is unintended. */
export const BRANDS: BrandSeed[] = [
  {
    slug: 'aurelis-skin',
    name: 'Aurelis Skin',
    description: 'Minimal, dermatology-informed formulas built around a short ingredient list.',
    isVegan: true,
    isCrueltyFree: true,
    tier: 'mid',
  },
  {
    slug: 'nordvel',
    name: 'Nordvel',
    description: 'Scandinavian barrier care for cold climates and reactive skin.',
    isVegan: false,
    isCrueltyFree: true,
    tier: 'mid',
  },
  {
    slug: 'byrelle',
    name: 'Byrelle',
    description: 'Everyday essentials at an accessible price, sold mainly in drugstores.',
    isVegan: false,
    isCrueltyFree: false,
    tier: 'value',
  },
  {
    slug: 'cerulea',
    name: 'Cerulea',
    description: 'Water-light textures for oily and combination skin.',
    isVegan: true,
    isCrueltyFree: true,
    tier: 'value',
  },
  {
    slug: 'dermivo',
    name: 'Dermivo',
    description: 'Pharmacy skincare focused on tolerance and simple actives.',
    isVegan: false,
    isCrueltyFree: true,
    tier: 'mid',
  },
  {
    slug: 'ekhos',
    name: 'Ekhos',
    description: 'Single-active formulas with transparent concentrations.',
    isVegan: true,
    isCrueltyFree: true,
    tier: 'value',
  },
  {
    slug: 'florabene',
    name: 'Florabene',
    description: 'Botanical blends with a light natural fragrance.',
    isVegan: true,
    isCrueltyFree: true,
    tier: 'mid',
  },
  {
    slug: 'glacee',
    name: 'Glacée',
    description: 'Cooling gels and hydrators for warm weather routines.',
    isVegan: true,
    isCrueltyFree: true,
    tier: 'mid',
  },
  {
    slug: 'hydrapure-lab',
    name: 'Hydrapure Lab',
    description: 'Hydration specialists — humectant-forward serums and creams.',
    isVegan: true,
    isCrueltyFree: true,
    tier: 'mid',
  },
  {
    slug: 'ilva-botanics',
    name: 'Ilva Botanics',
    description: 'Plant oils and butters, cold-pressed and lightly refined.',
    isVegan: true,
    isCrueltyFree: true,
    tier: 'premium',
  },
  {
    slug: 'junipair',
    name: 'Junipair',
    description: 'Playful, well-priced basics for people starting a routine.',
    isVegan: false,
    isCrueltyFree: false,
    tier: 'value',
  },
  {
    slug: 'kalme',
    name: 'Kalmé',
    description: 'Fragrance-free comfort formulas for easily irritated skin.',
    isVegan: true,
    isCrueltyFree: true,
    tier: 'mid',
  },
  {
    slug: 'lumiere-nord',
    name: 'Lumière Nord',
    description: 'Brightening and tone-evening care with gentle actives.',
    isVegan: false,
    isCrueltyFree: true,
    tier: 'premium',
  },
  {
    slug: 'mineralis',
    name: 'Mineralis',
    description: 'Mineral sun care and clay-based treatments.',
    isVegan: true,
    isCrueltyFree: true,
    tier: 'mid',
  },
  {
    slug: 'noctura',
    name: 'Noctura',
    description: 'Night-focused treatments built around retinoids and peptides.',
    isVegan: false,
    isCrueltyFree: true,
    tier: 'premium',
  },
  {
    slug: 'oaklyn-beauty',
    name: 'Oaklyn Beauty',
    description: 'Warm, comforting textures with a considered scent profile.',
    isVegan: false,
    isCrueltyFree: false,
    tier: 'mid',
  },
  {
    slug: 'pura-vive',
    name: 'Pura Vive',
    description: 'Clean-feeling everyday skincare in recyclable packaging.',
    isVegan: true,
    isCrueltyFree: true,
    tier: 'value',
  },
  {
    slug: 'quintess',
    name: 'Quintess',
    description: 'Luxury textures with a strong focus on sensory experience.',
    isVegan: false,
    isCrueltyFree: false,
    tier: 'premium',
  },
  {
    slug: 'rosevault',
    name: 'Rosevault',
    description: 'Rose-led soothing care, lightly scented.',
    isVegan: true,
    isCrueltyFree: true,
    tier: 'mid',
  },
  {
    slug: 'serenna',
    name: 'Serenna',
    description: 'Quiet, unfussy formulas — nothing you do not need.',
    isVegan: true,
    isCrueltyFree: true,
    tier: 'mid',
  },
  {
    slug: 'terravera',
    name: 'Terravera',
    description: 'Body and hand care made in small batches.',
    isVegan: true,
    isCrueltyFree: true,
    tier: 'value',
  },
  {
    slug: 'vitalux',
    name: 'Vitalux',
    description: 'Vitamin-C forward antioxidant care.',
    isVegan: false,
    isCrueltyFree: true,
    tier: 'premium',
  },
];
