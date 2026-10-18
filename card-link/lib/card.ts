import { Platform } from 'react-native';

export type PlatformKey =
  | 'instagram' | 'tiktok' | 'youtube' | 'github' | 'x' | 'linkedin' | 'whatsapp' | 'other';

export const PLATFORMS: Record<PlatformKey, { label: string; url: (h: string) => string }> = {
  instagram: { label: 'Instagram', url: (h) => `https://instagram.com/${h}` },
  tiktok: { label: 'TikTok', url: (h) => `https://tiktok.com/@${h}` },
  youtube: { label: 'YouTube', url: (h) => `https://youtube.com/@${h}` },
  github: { label: 'GitHub', url: (h) => `https://github.com/${h}` },
  x: { label: 'X', url: (h) => `https://x.com/${h}` },
  linkedin: { label: 'LinkedIn', url: (h) => `https://linkedin.com/in/${h}` },
  // Write the number with country code: @60123456789
  whatsapp: { label: 'WhatsApp', url: (h) => `https://wa.me/${h.replace(/\D/g, '')}` },
  // "Other" uses the link the creator types in (CardData.urls).
  other: { label: 'Other', url: () => '' },
};

/** Quick starting points. Both colours stay editable afterwards. */
export const THEMES = {
  graphite: { primary: '#1C1D21', secondary: '#7CF2D4' },
  cobalt: { primary: '#2342F5', secondary: '#FFD84D' },
  rose: { primary: '#F6D5E1', secondary: '#D6246E' },
  moss: { primary: '#2B4636', secondary: '#C6F26B' },
  lilac: { primary: '#DAD3FF', secondary: '#5A3BFF' },
  chalk: { primary: '#ECEFF2', secondary: '#FF4F1F' },
} as const;
export type ThemeKey = keyof typeof THEMES;

export const SWATCHES = [
  '#1C1D21', '#2342F5', '#F6D5E1', '#2B4636', '#DAD3FF', '#ECEFF2',
  '#7CF2D4', '#FFD84D', '#D6246E', '#C6F26B', '#5A3BFF', '#FF4F1F',
];

export type Palette = { bg: string; fg: string; accent: string; muted: string };

export const isHex = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s);

function lum(hex: string) {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Readable text colour for a given background. */
export const onColor = (hex: string) => (lum(hex) > 0.45 ? '#14161B' : '#FFFFFF');
function mix(a: string, b: string, t: number) {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i, 3 + i), 16);
  return (
    '#' +
    [0, 2, 4]
      .map((i) => Math.round(ch(a, i) * (1 - t) + ch(b, i) * t).toString(16).padStart(2, '0'))
      .join('')
  );
}
/** Primary = card colour, secondary = accent. Text colour and muted tone are derived. */
export function palette(primary: string, secondary: string): Palette {
  const fg = lum(primary) < 0.4 ? '#F4F2EE' : '#14161B';
  return { bg: primary, fg, accent: secondary, muted: mix(fg, primary, 0.5) };
}

export const FONTS = {
  sans: undefined as string | undefined,
  serif: Platform.select({ ios: 'Georgia', default: 'serif' }),
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }),
};
export type FontKey = keyof typeof FONTS;

export const AVATARS = ['user','smile','heart','star','zap','flame','sparkles','leaf','coffee','globe','palette','cpu','camera','music','code','briefcase'] as const;
export type AvatarKey = (typeof AVATARS)[number];

export type CardData = {
  name: string;
  title: string;
  icon: AvatarKey;
  about: string; // creator writes @handles here
  links: { label: string; url: string }[];
  handles: Record<string, PlatformKey>;
  urls: Record<string, string>; // link per handle when its platform is "other"
  ratio: '3:2' | '2:3';
  primary: string;
  secondary: string;
  font: FontKey;
  showQr: boolean;
};

export const DEFAULT_CARD: CardData = {
  name: 'Alex Rivera',
  title: 'Maker and tinkerer',
  icon: 'zap',
  about: 'Building small things that blink. Say hi @alexmakes',
  links: [{ label: 'Portfolio', url: 'alexrivera.dev' }],
  handles: { alexmakes: 'instagram' },
  urls: {},
  ratio: '3:2',
  primary: THEMES.graphite.primary,
  secondary: THEMES.graphite.secondary,
  font: 'sans',
  showQr: true,
};

export function cardSize(ratio: CardData['ratio'], screenW: number) {
  if (ratio === '3:2') {
    const width = Math.min(screenW - 32, 380);
    return { width, height: Math.round((width * 2) / 3) };
  }
  const width = Math.min(screenW - 96, 280);
  return { width, height: Math.round((width * 3) / 2) };
}

// "@name" preceded by start/whitespace (so emails don't match), max 3.
export function extractHandles(text: string): string[] {
  const out: string[] = [];
  const re = /(^|\s)@([A-Za-z0-9_.]{2,30})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const h = m[2].replace(/\.+$/, '');
    if (h.length >= 2 && !out.includes(h)) out.push(h);
  }
  return out.slice(0, 3);
}

export function safeUrl(raw: string) {
  const u = raw.trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(u)) return u;
  return `https://${u.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')}`;
}

/** Where a tear opens. Empty string when an "Other" handle has no link yet. */
export function cardUrl(card: CardData, handle: string, platform: PlatformKey) {
  if (platform === 'other') {
    const u = (card.urls[handle] ?? '').trim();
    return u ? safeUrl(u) : '';
  }
  return PLATFORMS[platform].url(handle);
}

// Links must be https so anyone can open them in Chrome or Safari. On the website we use its own address;
// in a native build set EXPO_PUBLIC_WEB_URL (for example https://your-app.vercel.app) in the environment.
export function shareBase() {
  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    return window.location.origin;
  }
  const env = process.env.EXPO_PUBLIC_WEB_URL;
  return env ? env.replace(/\/+$/, '') : 'cardlink:/';
}

// The link carries the card itself (no backend). Swap this for a short
// hosted id later if you want smaller, more scannable QR codes.
export function cardToLink(c: CardData) {
  const found = extractHandles(c.about);
  const hs = Object.fromEntries(found.map((h) => [h, c.handles[h] ?? 'instagram']));
  const us = Object.fromEntries(found.filter((h) => hs[h] === 'other' && c.urls[h]).map((h) => [h, c.urls[h]]));
  const p = [c.name, c.title, c.icon, c.about, c.links, hs, c.ratio === '3:2' ? 0 : 1, c.primary, c.secondary, c.font, c.showQr ? 1 : 0, us];
  return `${shareBase()}/card?d=${encodeURIComponent(JSON.stringify(p))}`;
}

export function linkToCard(d?: string): CardData | null {
  try {
    const p = JSON.parse(d ?? '');
    if (!Array.isArray(p)) return null;
    const [name, title, icon, about, links, handles, ratio, primary, secondary, font, qr, urls] = p;
    return {
      name: String(name ?? '').slice(0, 40),
      title: String(title ?? '').slice(0, 60),
      icon: (AVATARS as readonly string[]).includes(icon) ? (icon as AvatarKey) : 'user',
      about: String(about ?? '').slice(0, 200),
      links: (Array.isArray(links) ? links : []).slice(0, 3).map((l: any) => ({
        label: String(l?.label ?? '').slice(0, 30),
        url: String(l?.url ?? '').slice(0, 200),
      })),
      handles: Object.fromEntries(
        Object.entries(handles ?? {}).filter(([, v]) => typeof v === 'string' && v in PLATFORMS)
      ) as CardData['handles'],
      urls: Object.fromEntries(
        Object.entries(urls ?? {}).map(([k, v]) => [k, String(v).slice(0, 200)])
      ),
      ratio: ratio === 1 ? '2:3' : '3:2',
      primary: isHex(primary) ? primary : THEMES.graphite.primary,
      secondary: isHex(secondary) ? secondary : THEMES.graphite.secondary,
      font: font in FONTS ? font : 'sans',
      showQr: qr === 1,
    };
  } catch {
    return null;
  }
}

/** hex <-> HSL (h 0-360, s and l 0-100) for the colour picker. */
export function hexToHsl(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l * 100];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return [h, s * 100, l * 100];
}

export function hslToHex(h: number, s: number, l: number): string {
  const S = s / 100, L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}
