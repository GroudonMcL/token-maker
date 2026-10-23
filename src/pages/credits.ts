// The asset credits for the About page (DESIGN.md §12), read straight from
// ASSETS-CREDITS.md so the two can never disagree.
import creditsMarkdown from '../../ASSETS-CREDITS.md?raw';

/** A piece of a table cell: plain text, `code`, or a [link](https://…). */
export type CreditPart = { text: string; href?: string; code?: boolean };

export interface CreditRow {
  asset: CreditPart[];
  source: CreditPart[];
  licence: CreditPart[];
}

/** Splits a Markdown table cell into text, code and https links (nothing else is needed). */
export function parseCell(cell: string): CreditPart[] {
  const parts: CreditPart[] = [];
  const re = /\[([^\]]+)\]\((https:\/\/[^)\s]+)\)|`([^`]+)`/g;
  let last = 0;
  for (const m of cell.matchAll(re)) {
    if (m.index > last) parts.push({ text: cell.slice(last, m.index) });
    if (m[1] !== undefined) parts.push({ text: m[1], href: m[2] });
    else parts.push({ text: m[3]!, code: true });
    last = m.index + m[0].length;
  }
  if (last < cell.length) parts.push({ text: cell.slice(last) });
  return parts.map((p) => (p.href || p.code ? p : { text: p.text.replace(/\\\|/g, '|') }));
}

/** The rows of the first table in a Markdown file (header and divider skipped). */
export function parseCredits(markdown: string): CreditRow[] {
  const lines = markdown.split(/\r?\n/).filter((l) => l.trim().startsWith('|'));
  return lines
    .slice(2)
    .map((l) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim()))
    .filter((cells) => cells.length >= 3)
    .map(([asset, source, licence]) => ({ asset: parseCell(asset!), source: parseCell(source!), licence: parseCell(licence!) }));
}

export const CREDITS: readonly CreditRow[] = parseCredits(creditsMarkdown);
