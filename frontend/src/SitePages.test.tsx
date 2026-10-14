import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './test/renderPage';
import { api } from './lib/api';

jest.mock('./lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

jest.mock('./lib/api', () => {
  const actual = jest.requireActual('./lib/api');
  return { ...actual, api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() } };
});

/** The public backend a guest sees: free shipping and an empty shop. */
function backend(overrides: Record<string, unknown | Error> = {}) {
  const responses: Record<string, unknown> = {
    '/rules/shipping': { tiers: [], free_threshold: null, fallback_fee: 0 },
    '/products?limit=100': { products: [] },
    ...overrides,
  };
  (api.get as jest.Mock).mockImplementation((path: string) => {
    if (!(path in responses)) return Promise.reject(new Error(`unexpected GET ${path}`));
    const r = responses[path];
    return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  backend();
});

const footer = () => screen.getByRole('contentinfo');

test('the footer links a guest to the shop, the shipping policy and the FAQ, but not to Favorites', async () => {
  renderApp('/');

  const links = within(footer());
  expect(await links.findByRole('link', { name: 'เลือกซื้อสินค้าทั้งหมด' })).toHaveAttribute('href', '/');
  expect(links.queryByRole('link', { name: 'รายการโปรด' })).not.toBeInTheDocument();
  expect(links.getByRole('link', { name: 'นโยบายจัดส่ง' })).toHaveAttribute('href', '/shipping');
  expect(links.getByRole('link', { name: 'คำถามที่พบบ่อย' })).toHaveAttribute('href', '/faq');
  expect(links.getByRole('link', { name: 'ติดต่อเรา' })).toHaveAttribute('href', '/contact');
});

test('the contact page lets a shopper call, email or message the shop', async () => {
  renderApp('/contact');

  const main = within(screen.getByRole('main'));
  expect(await main.findByRole('heading', { level: 1, name: 'ติดต่อเรา' })).toBeInTheDocument();
  expect(main.getByRole('link', { name: /095 681 2084/ })).toHaveAttribute('href', 'tel:0956812084');
  expect(main.getByRole('link', { name: /silverthiefbug\.official@gmail\.com/ })).toHaveAttribute('href', 'mailto:silverthiefbug.official@gmail.com');
  for (const channel of [/Facebook/, /Instagram/, /TikTok/]) {
    expect(main.getByRole('link', { name: channel })).toHaveAttribute('target', '_blank');
  }
  expect(main.queryByText(/กำลังจัดทำ/)).not.toBeInTheDocument();
});

describe('the shipping policy', () => {
  const page = async () => {
    renderApp('/shipping');
    const main = within(screen.getByRole('main'));
    await main.findByRole('heading', { level: 1, name: 'นโยบายจัดส่ง' });
    return main;
  };

  test('says shipping is free when the Shipping Fee is zero', async () => {
    const main = await page();
    expect(await within(main.getByRole('region', { name: 'ค่าจัดส่ง' })).findByText(/ฟรี/)).toBeInTheDocument();
  });

  test('states the flat Shipping Fee when no tiers are set up', async () => {
    backend({ '/rules/shipping': { tiers: [], free_threshold: null, fallback_fee: 60 } });
    const main = await page();
    expect(await within(main.getByRole('region', { name: 'ค่าจัดส่ง' })).findByText(/฿60/)).toBeInTheDocument();
  });

  test('lists every Shipping Tier and the Free Shipping Threshold', async () => {
    backend({
      '/rules/shipping': {
        tiers: [
          { min_units: 1, max_units: 1, fee: 10 },
          { min_units: 2, max_units: 5, fee: 50 },
          { min_units: 6, max_units: null, fee: 80 },
        ],
        free_threshold: 1000,
        fallback_fee: 0,
      },
    });
    const region = within((await page()).getByRole('region', { name: 'ค่าจัดส่ง' }));
    expect(await region.findByText('1 ชิ้น')).toBeInTheDocument();
    expect(region.getByText('2–5 ชิ้น')).toBeInTheDocument();
    expect(region.getByText('6 ชิ้นขึ้นไป')).toBeInTheDocument();
    expect(region.getByText('฿80')).toBeInTheDocument();
    expect(region.getByText(/ส่งฟรีเมื่อซื้อสินค้าครบ ฿1,000/)).toBeInTheDocument();
  });

  test('still explains shipping when the Shipping Fee cannot be loaded', async () => {
    backend({ '/rules/shipping': new Error('offline') });
    const main = await page();
    expect(await main.findByText(/ค่าจัดส่งจะแสดงในขั้นตอนชำระเงิน/)).toBeInTheDocument();
    expect(main.getByText(/จันทร์–พุธ/)).toBeInTheDocument();
  });

  test('explains Shipping Days, the Live Arrival Guarantee and what it does not cover', async () => {
    const main = await page();
    expect(main.getByText(/จันทร์–พุธ/)).toBeInTheDocument();
    expect(main.getByRole('heading', { name: 'รับประกันถึงมือมีชีวิต' })).toBeInTheDocument();
    expect(main.getByText(/ภายใน 2 ชั่วโมง/)).toBeInTheDocument();
    expect(main.getByText(/ไม่อยู่รับพัสดุ/)).toBeInTheDocument();
    expect(main.getByText(/ตายหลังแกะกล่อง/)).toBeInTheDocument();
    expect(main.queryByText(/30 วัน/)).not.toBeInTheDocument();
  });
});

describe('the Live Arrival Guarantee', () => {
  const product = (id: string, name: string, category: string) => ({
    id, name, description: null, price: 3200, available: 2, category, attributes: {}, images: [], is_best_seller: false, views: 0,
  });

  test('the about page promises arrival alive, not a 30-day survival', async () => {
    renderApp('/about');
    const main = within(screen.getByRole('main'));
    expect(await main.findByRole('heading', { name: 'รับประกันถึงมือมีชีวิต' })).toBeInTheDocument();
    expect(main.queryByText(/30 วัน/)).not.toBeInTheDocument();
  });

  test("a live beetle's details link to the guarantee terms; goods do not", async () => {
    backend({ '/products?limit=100': { products: [product('b1', 'Chalcosoma atlas', 'beetle'), product('f1', 'Beetle jelly', 'food')] } });
    renderApp('/');

    userEvent.click(await screen.findByRole('button', { name: 'Chalcosoma atlas' }));
    const beetle = within(await screen.findByRole('dialog'));
    expect(beetle.getByRole('link', { name: /รับประกันถึงมือมีชีวิต/ })).toHaveAttribute('href', '/shipping#guarantee');

    userEvent.click(beetle.getByRole('button', { name: 'ปิด' }));
    userEvent.click(await screen.findByRole('button', { name: 'Beetle jelly' }));
    const food = within(await screen.findByRole('dialog', { name: 'Beetle jelly' }));
    expect(food.queryByRole('link', { name: /รับประกันถึงมือมีชีวิต/ })).not.toBeInTheDocument();
  });
});

describe('the FAQ', () => {
  test('answers ordering, shipping and account questions, one at a time', async () => {
    renderApp('/faq');
    const main = within(screen.getByRole('main'));
    expect(await main.findByRole('heading', { level: 1, name: 'คำถามที่พบบ่อย' })).toBeInTheDocument();
    for (const group of ['สั่งซื้อและชำระเงิน', 'จัดส่งและรับประกัน', 'บัญชี']) {
      expect(main.getByRole('heading', { name: group })).toBeInTheDocument();
    }

    const question = main.getAllByRole('group').find((g) => within(g).queryByText('จ่ายเงินได้ช่องทางไหน'))!;
    expect(question).not.toHaveAttribute('open');
    userEvent.click(main.getByText('จ่ายเงินได้ช่องทางไหน'));
    expect(question).toHaveAttribute('open');
    expect(within(question).getByText(/พร้อมเพย์/)).toBeInTheDocument();
  });

  test('does not publish care advice the owner has not checked yet', async () => {
    renderApp('/faq');
    const main = within(screen.getByRole('main'));
    await main.findByRole('heading', { level: 1, name: 'คำถามที่พบบ่อย' });
    expect(main.queryByText('ด้วงมาถึงแล้วต้องทำอะไรก่อน')).not.toBeInTheDocument();
  });
});

describe('Terms and Privacy, until the seller is named', () => {
  test('the footer does not link to them', async () => {
    renderApp('/');
    const links = within(footer());
    await links.findByRole('link', { name: 'นโยบายจัดส่ง' });
    expect(links.queryByRole('link', { name: 'ข้อกำหนดการให้บริการ' })).not.toBeInTheDocument();
    expect(links.queryByRole('link', { name: 'นโยบายความเป็นส่วนตัว' })).not.toBeInTheDocument();
  });

  test.each(['/terms', '/privacy'])('visiting %s lands on the shop', async (url) => {
    renderApp(url);
    expect(await screen.findByRole('heading', { level: 1, name: 'Silver Thief Bug' })).toBeInTheDocument();
  });
});

describe('footer details', () => {
  test('"สมัครสมาชิก" opens the sign-up form', async () => {
    renderApp('/');
    userEvent.click(await within(footer()).findByRole('link', { name: 'สมัครสมาชิก' }));
    expect(await screen.findByLabelText('ชื่อ-นามสกุล')).toBeInTheDocument();
  });

  test('sign-up mode and a redirect work together in the URL', async () => {
    renderApp('/login?mode=signup&redirect=/favorites');
    expect(await screen.findByLabelText('ชื่อ-นามสกุล')).toBeInTheDocument();
  });

  test('the plain sign-in page still opens on signing in', async () => {
    renderApp('/login');
    expect(await screen.findByRole('heading', { level: 1, name: 'ยินดีต้อนรับกลับ' })).toBeInTheDocument();
    expect(screen.queryByLabelText('ชื่อ-นามสกุล')).not.toBeInTheDocument();
  });

  test("the footer names the About page and gives the shop's full address", async () => {
    renderApp('/');
    const links = within(footer());
    expect(await links.findByRole('link', { name: 'เกี่ยวกับเรา' })).toHaveAttribute('href', '/about');
    expect(links.getByRole('link', { name: '1 ต.ลำนารายณ์ อ.ชัยบาดาล จ.ลพบุรี 15130' })).toBeInTheDocument();
  });
});

test('"สมัครสมาชิก" switches to the sign-up form even from the sign-in page', async () => {
  renderApp('/login');
  await screen.findByRole('heading', { level: 1, name: 'ยินดีต้อนรับกลับ' });
  userEvent.click(within(footer()).getByRole('link', { name: 'สมัครสมาชิก' }));
  expect(await screen.findByLabelText('ชื่อ-นามสกุล')).toBeInTheDocument();
});
