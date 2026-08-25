// Embeds the chart's own brand font (Poppins, --font-body) as a base64 data: URI directly
// into exported chart SVG/PNG files, so they render in the correct typeface regardless of
// what's installed on whatever system eventually opens them. Without this, an exported
// chart's <text> elements have no font-family of their own at all — on screen they only
// ever inherit Poppins from this app's own `body { font-family: var(--font-body) }` rule
// (app.css) via normal CSS cascade, which doesn't travel with a cloned, serialized SVG once
// it's a standalone file — so today they silently fall back to whatever default font the
// viewing application/OS happens to use.
//
// Fetches from the SAME Google Fonts CDN theme/fonts.ts already loads (constitution's
// existing "static Google Fonts CDN requests for font files" privacy carve-out — this is an
// additional font asset from the exact same already-trusted host, not project data) rather
// than vendoring a font file into the repo — brand.yml declares `source: google` for these
// typefaces, so fetching at request time is the same sourcing choice the CSS <link> already
// made, just reused for a second purpose. Cached in memory after the first successful fetch
// so repeated exports in one session don't re-fetch.

const GOOGLE_FONTS_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Poppins:wght@400&display=swap";

let cachedFontFaceCss: Promise<string> | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Google's CSS2 API returns one @font-face block per unicode-range subset (cyrillic,
 * vietnamese, latin-ext, latin, ...) — chart text is plain English labels/numbers, so only
 * the base Latin block (unicode-range including U+0000-00FF) is needed, keeping the
 * embedded payload to one font file instead of every subset Google offers. */
function extractLatinFontFaceUrl(cssText: string): string | null {
  const blocks = cssText.split("@font-face");
  for (const block of blocks) {
    if (!/U\+0000-00FF/i.test(block)) continue;
    const match = block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/);
    if (match) return match[1];
  }
  // Fallback: whatever @font-face URL appears first, rather than embedding nothing just
  // because the unicode-range marker this function looks for isn't present.
  const anyMatch = cssText.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/);
  return anyMatch ? anyMatch[1] : null;
}

async function fetchFontFaceCss(): Promise<string> {
  try {
    const cssResponse = await fetch(GOOGLE_FONTS_CSS_URL);
    if (!cssResponse.ok) return "";
    const cssText = await cssResponse.text();
    const fontUrl = extractLatinFontFaceUrl(cssText);
    if (!fontUrl) return "";

    const fontResponse = await fetch(fontUrl);
    if (!fontResponse.ok) return "";
    const buffer = await fontResponse.arrayBuffer();
    const dataUri = `data:font/woff2;base64,${arrayBufferToBase64(buffer)}`;
    return `@font-face{font-family:'Poppins';font-weight:400;font-style:normal;src:url(${dataUri}) format('woff2');}`;
  } catch {
    return ""; // offline, blocked, or the API shape changed — export still proceeds, just
    // without an embedded font (falls back to the system stack, same as before this fix
    // existed) rather than failing the whole export over a font nicety.
  }
}

/** Returns raw `@font-face{...}` CSS text embedding Poppins regular as a data URI, or `""`
 * if the fetch failed for any reason. Cached after the first call (success or failure —
 * a failure this session is very unlikely to succeed on retry, and this must never block or
 * meaningfully delay an export). */
export function fetchEmbeddedFontFaceCss(): Promise<string> {
  cachedFontFaceCss ??= fetchFontFaceCss();
  return cachedFontFaceCss;
}
