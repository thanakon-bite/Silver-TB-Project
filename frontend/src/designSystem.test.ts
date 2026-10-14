/**
 * design.md is the rule: colours come from role tokens only, there are no gradients, and a
 * destructive action is never a solid button. These are checked on the source so a breach fails
 * the build instead of waiting for a review.
 */
import fs from 'fs';
import path from 'path';

const SRC = __dirname;

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'test' ? [] : sources(full);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [full] : [];
  });
}

function breaches(rule: RegExp): string[] {
  return sources(SRC).flatMap((file) =>
    fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((line, i) => (rule.test(line) ? [`${path.relative(SRC, file)}:${i + 1}`] : []))
  );
}

test('destructive actions are never a solid danger button', () => {
  expect(breaches(/\bbg-danger(?!\/)\b/)).toEqual([]);
});

test('no gradients', () => {
  expect(breaches(/\bbg-(gradient|linear|radial)-|\b(from|via)-(black|white|\[)/)).toEqual([]);
});

test('colours come from tokens: no raw black/white or arbitrary colour values', () => {
  expect(breaches(/\b(bg|text|border|ring|outline|from|via|to|fill|stroke)-(black|white)\b|\b(bg|text|border|ring|outline|fill|stroke)-\[(#|rgb|oklch|hsl)/)).toEqual([]);
});

test('icon buttons use the shared iconButton instead of a hand-rolled p-2 rounded-lg', () => {
  expect(breaches(/className="[^"]*\b(rounded-lg p-2|p-2 [^"]*rounded-lg)\b/)).toEqual([]);
});

test('fields and notices are rounded-xl: no field restyled round, no rounded-lg notice or select', () => {
  // Badges and pills may be rounded-full; fields use fieldClass() as it is
  expect(breaches(/fieldClass\(\)\}[^`]*\brounded-(full|lg)\b|rounded-lg bg-accent-strong\/10|rounded-lg border border-line bg-paper px-2/)).toEqual([]);
});
