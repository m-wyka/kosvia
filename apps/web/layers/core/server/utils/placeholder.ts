/**
 * Deterministic SVG product imagery.
 *
 * Kosvia's demo catalogue cannot ship real product photography — copying it
 * would be both a licensing problem and a lie about what the data is. Instead
 * every product gets a generated illustration: the same slug always yields the
 * same bottle shape and palette, so the grid looks like a considered catalogue
 * rather than a wall of grey boxes.
 */

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Muted palette drawn from the design tokens — nothing neon, nothing saturated. */
const PALETTES = [
  { bg: '#F7E8E4', vessel: '#E3B3A7', cap: '#8E6155', label: '#FBF6F4' }, // blush
  { bg: '#FBEEE1', vessel: '#E8C49E', cap: '#9A7148', label: '#FCF7F1' }, // peach
  { bg: '#EEECF7', vessel: '#B7B0D8', cap: '#5E5788', label: '#F8F7FC' }, // lavender
  { bg: '#E8F0E9', vessel: '#A6BFAC', cap: '#4E6B55', label: '#F5F9F6' }, // sage
  { bg: '#F4EFE8', vessel: '#D3C0A8', cap: '#7C6851', label: '#FAF7F2' }, // sand
  { bg: '#E7EEF4', vessel: '#A8BECE', cap: '#4B6478', label: '#F4F8FB' }, // slate blue
];

type Shape = 'dropper' | 'jar' | 'tube' | 'pump' | 'bottle' | 'flask';

/** Infers the vessel from the product slug, so a serum looks like a serum. */
function shapeFor(slug: string): Shape {
  const s = slug.toLowerCase();
  if (/(serum|oil|essence|solution|liquid|retinoid|retinol|drops)/.test(s)) return 'dropper';
  if (/(cream|mask|balm|butter)/.test(s)) return 'jar';
  if (/(spf|sunscreen|hand|gel-cleanser|cleanser|wash|exfolian|scrub)/.test(s)) return 'tube';
  if (/(lotion|shampoo|conditioner|body|micellar)/.test(s)) return 'pump';
  if (/(toner|water|mist|fluid)/.test(s)) return 'bottle';
  return 'flask';
}

function vessel(shape: Shape, p: (typeof PALETTES)[number]): string {
  const shadow = `<ellipse cx="300" cy="626" rx="118" ry="16" fill="#1A1614" opacity="0.07"/>`;
  const gloss = `<rect x="0" y="0" width="0" height="0"/>`;

  switch (shape) {
    case 'dropper':
      return `${shadow}
        <rect x="252" y="150" width="96" height="46" rx="12" fill="${p.cap}"/>
        <rect x="286" y="188" width="28" height="26" fill="${p.cap}" opacity="0.85"/>
        <rect x="234" y="206" width="132" height="412" rx="28" fill="${p.vessel}"/>
        <rect x="234" y="206" width="44" height="412" rx="24" fill="#FFFFFF" opacity="0.16"/>
        <rect x="258" y="330" width="84" height="150" rx="10" fill="${p.label}" opacity="0.94"/>
        ${gloss}`;
    case 'jar':
      return `${shadow}
        <rect x="196" y="238" width="208" height="46" rx="14" fill="${p.cap}"/>
        <rect x="204" y="280" width="192" height="330" rx="34" fill="${p.vessel}"/>
        <rect x="204" y="280" width="58" height="330" rx="30" fill="#FFFFFF" opacity="0.16"/>
        <rect x="238" y="392" width="124" height="132" rx="12" fill="${p.label}" opacity="0.94"/>`;
    case 'tube':
      return `${shadow}
        <rect x="262" y="150" width="76" height="52" rx="14" fill="${p.cap}"/>
        <path d="M252 200h96l26 380a26 26 0 0 1-26 28H252a26 26 0 0 1-26-28l26-380Z" fill="${p.vessel}"/>
        <path d="M252 200h34l-16 408h-18a26 26 0 0 1-26-28l26-380Z" fill="#FFFFFF" opacity="0.16"/>
        <rect x="256" y="336" width="92" height="164" rx="10" fill="${p.label}" opacity="0.94"/>`;
    case 'pump':
      return `${shadow}
        <path d="M300 132h44a14 14 0 0 1 14 14v14h-58v-28Z" fill="${p.cap}"/>
        <rect x="286" y="160" width="30" height="54" rx="10" fill="${p.cap}"/>
        <rect x="222" y="210" width="156" height="408" rx="30" fill="${p.vessel}"/>
        <rect x="222" y="210" width="48" height="408" rx="26" fill="#FFFFFF" opacity="0.16"/>
        <rect x="250" y="348" width="100" height="164" rx="10" fill="${p.label}" opacity="0.94"/>`;
    case 'bottle':
      return `${shadow}
        <rect x="272" y="128" width="56" height="42" rx="10" fill="${p.cap}"/>
        <path d="M282 168h36l24 60v364a26 26 0 0 1-26 26h-32a26 26 0 0 1-26-26V228l24-60Z" fill="${p.vessel}"/>
        <path d="M282 168h14l-14 60v390h-6a26 26 0 0 1-26-26V228l32-60Z" fill="#FFFFFF" opacity="0.16"/>
        <rect x="256" y="352" width="88" height="152" rx="10" fill="${p.label}" opacity="0.94"/>`;
    default:
      return `${shadow}
        <rect x="264" y="146" width="72" height="44" rx="12" fill="${p.cap}"/>
        <rect x="216" y="188" width="168" height="430" rx="36" fill="${p.vessel}"/>
        <rect x="216" y="188" width="52" height="430" rx="30" fill="#FFFFFF" opacity="0.16"/>
        <rect x="248" y="336" width="104" height="168" rx="10" fill="${p.label}" opacity="0.94"/>`;
  }
}

export function productImageSvg(slug: string): string {
  const seed = hash(slug);
  const palette = PALETTES[seed % PALETTES.length]!;
  const shape = shapeFor(slug);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 750" width="600" height="750" role="img" aria-label="Illustrated product">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="${palette.bg}"/>
    </linearGradient>
  </defs>
  <rect width="600" height="750" fill="url(#bg)"/>
  <circle cx="${120 + (seed % 60)}" cy="${140 + (seed % 90)}" r="${90 + (seed % 40)}" fill="#FFFFFF" opacity="0.5"/>
  ${vessel(shape, palette)}
</svg>`;
}

/** Wordmark tile used for brand and store logos. */
export function monogramSvg(name: string, slug: string): string {
  const palette = PALETTES[hash(slug) % PALETTES.length]!;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="${escapeXml(name)}">
  <rect width="120" height="120" rx="26" fill="${palette.bg}"/>
  <text x="60" y="60" text-anchor="middle" dominant-baseline="central"
        font-family="Georgia, 'Times New Roman', serif" font-size="42" fill="${palette.cap}">${escapeXml(initials)}</text>
</svg>`;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char] as string,
  );
}
