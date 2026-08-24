import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Contrast regression guard for the design tokens in `globals.css`.
 *
 * The palette originally shipped in this file was never actually
 * transcribed from the approved frames, and three of its text/background
 * pairs fell below WCAG 2.1 AA. That only surfaced in the browser
 * accessibility suite, which needs Postgres, the API, and a real browser.
 * This test recomputes the same ratios from the stylesheet alone, so the
 * defect class is caught by `pnpm test` on any machine.
 *
 * To cover a new token, add it to `TEXT_PAIRS` (or to `NON_TEXT_TOKENS` if
 * it is never painted behind or as text). The final test fails if a token is
 * declared and left out of both, so a new token cannot silently escape the
 * contrast check.
 */

const AA_NORMAL_TEXT = 4.5;

const cssPath = join(dirname(fileURLToPath(import.meta.url)), 'globals.css');

/** Parses the `@theme` block into `{ 'fg-secondary': '#656d7a', ... }`. */
function readColorTokens(): Record<string, string> {
  const css = readFileSync(cssPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const tokens: Record<string, string> = {};

  for (const [, name, value] of css.matchAll(
    /--color-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g,
  )) {
    tokens[name] = value.toLowerCase();
  }

  return tokens;
}

/** WCAG 2.1 relative luminance of an opaque `#rrggbb` colour. */
function relativeLuminance(hex: string): number {
  const int = Number.parseInt(hex.slice(1), 16);
  const channels = [(int >> 16) & 0xff, (int >> 8) & 0xff, int & 0xff];

  const [r, g, b] = channels.map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio, 1..21. */
function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [lighter, darker] = a > b ? [a, b] : [b, a];

  return (lighter + 0.05) / (darker + 0.05);
}

interface TokenPair {
  /** Token name without the `--color-` prefix. */
  fg: string;
  bg: string;
  /** Where the design actually paints this combination. */
  usage: string;
}

/**
 * Every text/background token pair the auth design uses. Pairs that the
 * design never produces are deliberately absent — `fg-secondary` on
 * `muted-surface` is only 4.069:1, but the secondary button draws `fg` on
 * that surface, never `fg-secondary`.
 */
const TEXT_PAIRS: TokenPair[] = [
  { fg: 'fg', bg: 'surface', usage: 'headings and body on cards' },
  { fg: 'fg', bg: 'app-bg', usage: 'body text on the page background' },
  { fg: 'fg', bg: 'muted-surface', usage: 'secondary button label' },
  { fg: 'fg-strong', bg: 'surface', usage: 'username in the shell header' },
  { fg: 'fg-strong', bg: 'app-bg', usage: 'username over the page background' },
  {
    fg: 'fg-secondary',
    bg: 'surface',
    usage: 'subtitles, help text, input placeholders, footnotes',
  },
  {
    fg: 'fg-secondary',
    bg: 'app-bg',
    usage: 'secondary text over the page background',
  },
  { fg: 'brand-fg', bg: 'brand', usage: 'primary button label and avatar' },
  { fg: 'danger', bg: 'danger-surface', usage: 'failure banner text' },
  {
    fg: 'field-error',
    bg: 'surface',
    usage: 'inline field error text and invalid input border',
  },
  { fg: 'success', bg: 'success-surface', usage: 'success banner text' },
];

/**
 * Disabled controls are exempt from the contrast minimum under WCAG 2.1
 * ("Contrast (Minimum)" excludes inactive components), so this is the one
 * pair allowed to fail. It is listed rather than skipped so that widening
 * the exemption is a visible edit.
 */
const EXEMPT_PAIR: TokenPair = {
  fg: 'disabled-fg',
  bg: 'disabled-surface',
  usage: 'disabled inputs and buttons (WCAG-exempt)',
};

/** Tokens that are never painted as, or directly behind, text. */
const NON_TEXT_TOKENS = ['line', 'disabled-line'];

/**
 * Text greys retired by the corrected palette. No lighter tier can clear
 * 4.5:1 on `app-bg`, so reintroducing one is always a defect.
 */
const RETIRED_TEXT_TOKENS = ['fg-tertiary'];

const tokens = readColorTokens();

function resolve(name: string): string {
  const value = tokens[name];
  expect(value, `--color-${name} is not declared in globals.css`).toBeDefined();
  return value;
}

describe('design tokens', () => {
  it.each(TEXT_PAIRS)(
    'renders $fg on $bg at AA ($usage)',
    ({ fg, bg, usage }) => {
      const foreground = resolve(fg);
      const background = resolve(bg);
      const ratio = contrastRatio(foreground, background);

      expect(
        ratio,
        `--color-${fg} (${foreground}) on --color-${bg} (${background}) is ` +
          `${ratio.toFixed(3)}:1, below the ${AA_NORMAL_TEXT}:1 minimum for ` +
          `${usage}`,
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    },
  );

  it('exempts only disabled controls from the contrast minimum', () => {
    const ratio = contrastRatio(
      resolve(EXEMPT_PAIR.fg),
      resolve(EXEMPT_PAIR.bg),
    );

    // Asserted in the failing direction on purpose: if this pair ever
    // clears AA the exemption is no longer needed and should be removed.
    expect(ratio).toBeLessThan(AA_NORMAL_TEXT);
  });

  it.each(RETIRED_TEXT_TOKENS)('does not reintroduce --color-%s', (name) => {
    expect(tokens).not.toHaveProperty(name);
  });

  it('checks every declared colour token', () => {
    const covered = new Set([
      ...TEXT_PAIRS.flatMap(({ fg, bg }) => [fg, bg]),
      EXEMPT_PAIR.fg,
      EXEMPT_PAIR.bg,
      ...NON_TEXT_TOKENS,
    ]);

    const uncovered = Object.keys(tokens).filter((name) => !covered.has(name));

    expect(
      uncovered,
      'add each token to TEXT_PAIRS or NON_TEXT_TOKENS so it cannot skip ' +
        'the contrast check',
    ).toEqual([]);
  });
});
