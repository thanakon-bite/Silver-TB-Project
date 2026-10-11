import { makeI18n } from '../test/renderPage';
import { tierLabel } from './format';

test('a Shipping Tier reads naturally in English and Thai, singular included', () => {
  const i18n = makeI18n();
  const en = i18n.getFixedT('en');
  const th = i18n.getFixedT('th');
  expect(tierLabel({ min_units: 1, max_units: null, fee: 50 }, en)).toBe('1 item or more');
  expect(tierLabel({ min_units: 6, max_units: null, fee: 80 }, en)).toBe('6 items or more');
  expect(tierLabel({ min_units: 2, max_units: 5, fee: 50 }, en)).toBe('2–5 items');
  expect(tierLabel({ min_units: 1, max_units: 1, fee: 10 }, en)).toBe('1 item');
  expect(tierLabel({ min_units: 6, max_units: null, fee: 80 }, th)).toBe('6 ชิ้นขึ้นไป');
});
