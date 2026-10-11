import React from 'react';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShopHero from './ShopHero';
import { renderPage } from '../../test/renderPage';

jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

const setReducedMotion = (reduce: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
};

const visit = () => renderPage(<ShopHero productsId="shop" />, { path: '/' });
const visibleSlide = () => screen.getAllByRole('group', { name: /สไลด์/ }).find((s) => s.getAttribute('aria-hidden') !== 'true')!;

beforeEach(() => {
  jest.useFakeTimers();
  setReducedMotion(false);
});
afterEach(() => {
  jest.useRealTimers();
});

test('four slides of beetle photos, one per Category, each leading to its Category', () => {
  visit();
  const carousel = screen.getByRole('region', { name: 'Silver Thief Bug' });
  // Hidden slides have no accessible name, so they are found by their label attribute.
  const slides = within(carousel).getAllByRole('group', { hidden: true }).filter((g) => /สไลด์ \d จาก 4/.test(g.getAttribute('aria-label') || ''));
  expect(slides).toHaveLength(4);
  const hrefs = slides.map((s) => within(s).getAllByRole('link', { hidden: true })[0].getAttribute('href'));
  expect(hrefs).toEqual(['/?category=beetle', '/?category=food', '/?category=log', '/?category=gear']);
  slides.forEach((s) => expect(within(s).getByRole('img', { hidden: true })).toHaveAttribute('alt'));
});

test('each photo is credited with its author and licence', () => {
  visit();
  expect(screen.getByText(/Basile Morin/)).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: /CC BY/, hidden: true }).length).toBeGreaterThanOrEqual(4);
});

test('slides change by themselves every 6 seconds and loop', () => {
  visit();
  expect(visibleSlide()).toHaveAccessibleName('สไลด์ 1 จาก 4');
  act(() => {
    jest.advanceTimersByTime(6000);
  });
  expect(visibleSlide()).toHaveAccessibleName('สไลด์ 2 จาก 4');
  act(() => {
    jest.advanceTimersByTime(18000);
  });
  expect(visibleSlide()).toHaveAccessibleName('สไลด์ 1 จาก 4');
});

test('pointing at the Hero pauses it; dots and arrows move by hand', () => {
  visit();
  const carousel = screen.getByRole('region', { name: 'Silver Thief Bug' });
  userEvent.hover(carousel);
  act(() => {
    jest.advanceTimersByTime(12000);
  });
  expect(visibleSlide()).toHaveAccessibleName('สไลด์ 1 จาก 4');

  userEvent.click(screen.getByRole('button', { name: 'ไปสไลด์ 3' }));
  expect(visibleSlide()).toHaveAccessibleName('สไลด์ 3 จาก 4');
  expect(screen.getByRole('button', { name: 'ไปสไลด์ 3' })).toHaveAttribute('aria-current', 'true');
  userEvent.click(screen.getByRole('button', { name: 'สไลด์ถัดไป' }));
  expect(visibleSlide()).toHaveAccessibleName('สไลด์ 4 จาก 4');
  userEvent.click(screen.getByRole('button', { name: 'สไลด์ก่อนหน้า' }));
  expect(visibleSlide()).toHaveAccessibleName('สไลด์ 3 จาก 4');
});

test('with reduced motion the slides never move by themselves', () => {
  setReducedMotion(true);
  visit();
  act(() => {
    jest.advanceTimersByTime(30000);
  });
  expect(visibleSlide()).toHaveAccessibleName('สไลด์ 1 จาก 4');
});

