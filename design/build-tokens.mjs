// Generates tokens.css from tokens.json. Run: node design/build-tokens.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url);
const t = JSON.parse(readFileSync(new URL('tokens.json', dir), 'utf8'));
const val = (v) => (typeof v === 'object' ? v.dark : v);
const lines = [];
for (const c of t.color.tokens) lines.push(`  --${c.name}: ${val(c.value)};`);
for (const [k, v] of Object.entries(t.type.families)) lines.push(`  --font-${k}: ${v};`);
for (const g of [t.spacing, t.radius, t.shadow, t.motion]) for (const s of g.tokens) lines.push(`  --${s.name}: ${val(s.value)};`);
const styles = [];
for (const g of t.type.groups) for (const s of g.styles) {
  const upper = g.family === 'display' || s.name === 'field-label';
  styles.push(`.t-${s.name} { font: ${s.fontWeight} ${s.fontSize}/${s.lineHeight} var(--font-${g.family});${s.letterSpacing ? ` letter-spacing: ${s.letterSpacing};` : ''}${upper ? ' text-transform: uppercase;' : ''}${g.family === 'figure' ? ' font-variant-numeric: tabular-nums;' : ''} }`);
}
writeFileSync(new URL('tokens.css', dir), `/* Generated from tokens.json by build-tokens.mjs. Do not edit. */\n:root {\n  color-scheme: dark;\n${lines.join('\n')}\n}\n\n${styles.join('\n')}\n`);
