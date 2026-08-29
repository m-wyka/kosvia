/**
 * Open Beauty Facts category tags → Kosvia category slugs. Most specific
 * first: a product tagged both `en:face` and `en:facial-sunscreens` is sun
 * care, not "face". Anything unmapped is skipped and counted — we never guess
 * a routine step.
 */
const OBF_CATEGORY_TO_SLUG: ReadonlyArray<readonly [string, string]> = [
  ['en:facial-sunscreens', 'sun-care'],
  ['en:sunscreens', 'sun-care'],
  ['en:sunscreen', 'sun-care'],
  ['en:in-sun-protections', 'sun-care'],
  ['en:suncare', 'sun-care'],
  ['en:eye-contour-creams', 'eye-care'],
  ['en:eye-creams', 'eye-care'],
  ['en:eye-care', 'eye-care'],
  ['en:facial-serums', 'serums'],
  ['en:face-serums', 'serums'],
  ['en:serums', 'serums'],
  ['en:facial-masks', 'masks'],
  ['en:face-masks', 'masks'],
  ['en:masks', 'masks'],
  ['en:facial-oils', 'face-oils'],
  ['en:face-oils', 'face-oils'],
  ['en:exfoliants', 'exfoliants'],
  ['en:facial-scrubs', 'exfoliants'],
  ['en:face-scrubs', 'exfoliants'],
  ['en:peelings', 'exfoliants'],
  ['en:toners', 'toners'],
  ['en:facial-toners', 'toners'],
  ['en:micellar-waters', 'cleansers'],
  ['en:micellar-water', 'cleansers'],
  ['en:facial-cleansers', 'cleansers'],
  ['en:face-cleansers', 'cleansers'],
  ['en:cleansing-gels', 'cleansers'],
  ['en:makeup-removers', 'cleansers'],
  ['en:make-up-removers', 'cleansers'],
  ['en:facial-creams', 'moisturizers'],
  ['en:face-creams', 'moisturizers'],
  ['en:facial-moisturizers', 'moisturizers'],
  ['en:face-moisturizers', 'moisturizers'],
  ['en:day-creams', 'moisturizers'],
  ['en:night-creams', 'moisturizers'],
  ['en:hand-creams', 'hand-care'],
  ['en:hand-care', 'hand-care'],
  ['en:body-lotions', 'body-lotions'],
  ['en:body-milks', 'body-lotions'],
  ['en:body-creams', 'body-lotions'],
  ['en:body-butters', 'body-lotions'],
  ['en:shampoos', 'shampoos'],
  ['en:hair-conditioners', 'conditioners'],
  ['en:conditioners', 'conditioners'],
];

const slugByTag = new Map(OBF_CATEGORY_TO_SLUG);

export const mapObfCategory = (tags: readonly string[]): string | null => {
  for (const [tag, slug] of OBF_CATEGORY_TO_SLUG) {
    if (tags.includes(tag)) {
      return slug;
    }
  }
  return null;
};

export const isMappedObfCategory = (tag: string): boolean => slugByTag.has(tag);
