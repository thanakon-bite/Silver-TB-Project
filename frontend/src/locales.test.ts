import th from '../public/locales/th/translation.json';
import en from '../public/locales/en/translation.json';

/** Every key path in a translation tree, e.g. "order_status.shipping". */
const keys = (obj: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`]
  );

// English plurals live under count_one / count_other; Thai has one form. Compare the base key.
const base = (k: string) => k.replace(/_(zero|one|two|few|many|other)$/, '');

test('Thai and English have exactly the same keys, so no screen falls back to the other language', () => {
  const thKeys = new Set(keys(th).map(base));
  const enKeys = new Set(keys(en).map(base));
  expect(Array.from(thKeys).filter((k) => !enKeys.has(k))).toEqual([]);
  expect(Array.from(enKeys).filter((k) => !thKeys.has(k))).toEqual([]);
});

test('no Thai string is left empty', () => {
  const empty = keys(th).filter((k) => k.split('.').reduce<any>((o, p) => o?.[p], th) === '');
  expect(empty).toEqual([]);
});

/** Every string in a translation tree with its key path (arrays included). */
const strings = (obj: unknown, prefix = ''): [string, string][] =>
  typeof obj === 'string'
    ? [[prefix, obj]]
    : obj && typeof obj === 'object'
      ? Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => strings(v, prefix ? `${prefix}.${k}` : k))
      : [];

test('English uses the CONTEXT.md names, not the words it says to avoid', () => {
  // Shipping (not "Shipped"), Confirmed (not "Completed"), Redemption (not "usage"/"uses").
  const avoided = /\bShipped\b|has shipped|as shipped|\bCompleted\b|\b[Uu]sage\b|\b[Uu]ses\b(?= (per|·))|\d+\}\} uses\b/;
  expect(strings(en).filter(([, s]) => avoided.test(s)).map(([k]) => k)).toEqual([]);
});
