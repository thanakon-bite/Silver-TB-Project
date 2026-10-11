import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './test/renderPage';
import { api, API_WRITE_EVENT } from './lib/api';

/** The Realtime subscription the bell opened: its filter, and the callback a changed row calls. */
let mockRealtime: { filter?: string; onChange?: () => void; removed: boolean } = { removed: false };
const mockChannel = {
  on: (_event: string, opts: { filter?: string }, cb: () => void) => {
    mockRealtime.filter = opts.filter;
    mockRealtime.onChange = cb;
    return mockChannel;
  },
  subscribe: () => mockChannel,
};

/** Who is signed in for the next render: null for a guest. */
let mockMember: { id: string; email: string; full_name: string; role: 'user' | 'admin' } | null = null;

jest.mock('./lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: mockMember ? { access_token: 'test-token' } : null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => Promise.resolve({ error: null }),
    },
    channel: () => mockChannel,
    removeChannel: () => {
      mockRealtime.removed = true;
    },
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
      upsert: () => Promise.resolve({ error: null }),
    }),
  },
}));

jest.mock('./lib/api', () => {
  const actual = jest.requireActual('./lib/api');
  return { ...actual, api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() } };
});

const customer = { id: 'u1', email: 'mali@example.com', full_name: 'มาลี ใจดี', role: 'user' as const };

const note = (id: string, type: string, data: Record<string, unknown>, read_at: string | null = null) => ({
  id, type, order_id: 'o1', data, read_at, created_at: '2026-10-11T03:00:00Z',
});

let feed: { notifications: ReturnType<typeof note>[]; unread: number; has_more?: boolean };
let older: { notifications: ReturnType<typeof note>[]; unread: number; has_more?: boolean } | null = null;

function backend() {
  (api.get as jest.Mock).mockImplementation((path: string) => {
    if (path === '/auth/me') return mockMember ? Promise.resolve(mockMember) : Promise.reject(new Error('no session'));
    if (path === '/notifications') return Promise.resolve(feed);
    if (path.startsWith('/notifications?before=') && older) return Promise.resolve(older);
    if (path.startsWith('/products')) return Promise.resolve({ products: [], total: 0 });
    if (path === '/rules/shipping') return Promise.resolve({ tiers: [], free_threshold: null, fallback_fee: 0 });
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
  (api.post as jest.Mock).mockResolvedValue({ ok: true });
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  mockMember = null;
  mockRealtime = { removed: false };
  older = null;
  feed = {
    notifications: [
      note('n1', 'shipping', { order_number: 'STB-261010-00007', tracking_number: 'KEX9', carrier: 'Kerry Express' }),
      note('n2', 'cancelled', { order_number: 'STB-261010-00006', cancel_reason: 'สินค้าหมด' }),
      note('n3', 'confirm_request', { order_number: 'STB-261010-00005' }, '2026-10-11T04:00:00Z'),
      note('n4', 'awaiting_payment', { order_number: 'STB-261010-00004' }, '2026-10-11T04:00:00Z'),
    ],
    unread: 2,
  };
  backend();
});

test('guests have no bell', async () => {
  renderApp('/');
  await screen.findAllByRole('navigation', { name: 'เมนูหลัก' });
  expect(screen.queryByRole('button', { name: /การแจ้งเตือน/ })).not.toBeInTheDocument();
});

test('a signed-in Customer sees the unread count and every kind of order notification in Thai', async () => {
  mockMember = customer;
  renderApp('/');

  const bell = (await screen.findAllByRole('button', { name: 'การแจ้งเตือน (ยังไม่อ่าน 2)' }))[0];
  userEvent.click(bell);
  const panel = within(screen.getByRole('region', { name: 'การแจ้งเตือน' }));
  expect(panel.getByText('ออเดอร์ STB-261010-00007 ได้รับการจัดส่งแล้ว')).toBeInTheDocument();
  expect(panel.getByText('Kerry Express · หมายเลขพัสดุ KEX9')).toBeInTheDocument();
  expect(panel.getByText(/STB-261010-00006 ถูกยกเลิก/)).toBeInTheDocument();
  expect(panel.getByText(/สินค้าหมด/)).toBeInTheDocument();
  expect(panel.getByText(/ได้รับ STB-261010-00005 แล้วหรือยัง/)).toBeInTheDocument();
  expect(panel.getByText(/STB-261010-00004 รอชำระเงิน/)).toBeInTheDocument();
});

test('opening a notification marks it read and goes to its order', async () => {
  mockMember = customer;
  renderApp('/');
  userEvent.click((await screen.findAllByRole('button', { name: /การแจ้งเตือน/ }))[0]);

  userEvent.click(screen.getByRole('link', { name: /ออเดอร์ STB-261010-00007 ได้รับการจัดส่งแล้ว/ }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/notifications/n1/read', {}));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/orders/o1'));
});

test('"อ่านทั้งหมด" clears the count', async () => {
  mockMember = customer;
  renderApp('/');
  userEvent.click((await screen.findAllByRole('button', { name: /ยังไม่อ่าน 2/ }))[0]);
  userEvent.click(screen.getByRole('button', { name: 'อ่านทั้งหมด' }));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/notifications/read-all', {}));
  expect((await screen.findAllByRole('button', { name: 'การแจ้งเตือน' }))[0]).toBeInTheDocument();
});

test('a started Promotion is announced in the reader’s language and leads to its products', async () => {
  mockMember = customer;
  feed = {
    notifications: [{ id: 'n7', type: 'promotion', order_id: null, data: { promotion_id: 'pr1', name_th: 'ลดต้นหนาว', name_en: 'Early winter sale' }, read_at: null, created_at: '2026-10-11T03:00:00Z' } as any],
    unread: 1,
  };
  renderApp('/orders');
  userEvent.click((await screen.findAllByRole('button', { name: /ยังไม่อ่าน 1/ }))[0]);
  const link = screen.getByRole('link', { name: /โปรโมชันเริ่มแล้ว: ลดต้นหนาว/ });
  expect(link).toHaveAttribute('href', '/?promotion=pr1');
});

test('new notifications arrive without reloading', async () => {
  jest.useFakeTimers();
  try {
    mockMember = customer;
    feed = { notifications: [], unread: 0 };
    renderApp('/');
    await screen.findAllByRole('button', { name: 'การแจ้งเตือน' });

    feed = { notifications: [note('n9', 'shipping', { order_number: 'STB-261010-00009', tracking_number: 'KEX1' })], unread: 1 };
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect((await screen.findAllByRole('button', { name: 'การแจ้งเตือน (ยังไม่อ่าน 1)' }))[0]).toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});

test('older notifications load a page at a time', async () => {
  mockMember = customer;
  feed = { ...feed, has_more: true };
  older = {
    notifications: [{ ...note('n0', 'shipping', { order_number: 'STB-261009-00001', tracking_number: 'KEX0' }, '2026-10-10T04:00:00Z'), created_at: '2026-10-10T03:00:00Z' }],
    unread: 2,
    has_more: false,
  };
  renderApp('/');
  userEvent.click((await screen.findAllByRole('button', { name: /ยังไม่อ่าน 2/ }))[0]);
  const panel = within(screen.getByRole('region', { name: 'การแจ้งเตือน' }));
  expect(panel.queryByText(/STB-261009-00001/)).not.toBeInTheDocument();

  userEvent.click(panel.getByRole('button', { name: 'ดูการแจ้งเตือนก่อนหน้า' }));
  expect(await panel.findByText(/STB-261009-00001 ได้รับการจัดส่งแล้ว/)).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/notifications?before=2026-10-11T03%3A00%3A00Z&before_id=n4');
  expect(panel.getByText(/STB-261010-00007 ได้รับการจัดส่งแล้ว/)).toBeInTheDocument();
  expect(panel.queryByRole('button', { name: 'ดูการแจ้งเตือนก่อนหน้า' })).not.toBeInTheDocument();
});

describe('the bell refreshes at once', () => {
  const feedCalls = () => (api.get as jest.Mock).mock.calls.filter(([p]) => p === '/notifications').length;
  const shipped = () => ({ notifications: [note('n9', 'shipping', { order_number: 'STB-261010-00009', tracking_number: 'KEX1' })], unread: 1 });

  test('a Notification made elsewhere (an Admin shipping the order) shows through Realtime, for this Member only', async () => {
    mockMember = customer;
    feed = { notifications: [], unread: 0 };
    renderApp('/');
    await screen.findAllByRole('button', { name: 'การแจ้งเตือน' });
    await waitFor(() => expect(mockRealtime.onChange).toBeDefined());
    expect(mockRealtime.filter).toBe('user_id=eq.u1');

    feed = shipped();
    act(() => mockRealtime.onChange!());
    expect((await screen.findAllByRole('button', { name: 'การแจ้งเตือน (ยังไม่อ่าน 1)' }))[0]).toBeInTheDocument();
  });

  test("the Member's own action refreshes the bell; marking read or pricing the Cart does not", async () => {
    mockMember = customer;
    feed = { notifications: [], unread: 0 };
    renderApp('/');
    await screen.findAllByRole('button', { name: 'การแจ้งเตือน' });
    await waitFor(() => expect(feedCalls()).toBe(1));

    act(() => {
      window.dispatchEvent(new CustomEvent(API_WRITE_EVENT, { detail: { path: '/notifications/n1/read' } }));
      window.dispatchEvent(new CustomEvent(API_WRITE_EVENT, { detail: { path: '/orders/price-preview' } }));
    });
    await new Promise((r) => setTimeout(r, 400));
    expect(feedCalls()).toBe(1);

    feed = shipped();
    act(() => {
      window.dispatchEvent(new CustomEvent(API_WRITE_EVENT, { detail: { path: '/orders/o1/confirm' } }));
    });
    expect((await screen.findAllByRole('button', { name: 'การแจ้งเตือน (ยังไม่อ่าน 1)' }))[0]).toBeInTheDocument();
    expect(feedCalls()).toBe(2);
  });

  test('coming back to the tab and opening the bell fetch the newest', async () => {
    mockMember = customer;
    feed = { notifications: [], unread: 0 };
    renderApp('/');
    await screen.findAllByRole('button', { name: 'การแจ้งเตือน' });
    await waitFor(() => expect(feedCalls()).toBe(1));

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(feedCalls()).toBe(2));

    feed = shipped();
    userEvent.click(screen.getAllByRole('button', { name: 'การแจ้งเตือน' })[0]);
    const panel = within(screen.getByRole('region', { name: 'การแจ้งเตือน' }));
    expect(await panel.findByText(/STB-261010-00009/)).toBeInTheDocument();
  });

  test('closing the app closes the Realtime subscription', async () => {
    mockMember = customer;
    const { unmount } = renderApp('/');
    await waitFor(() => expect(mockRealtime.onChange).toBeDefined());
    unmount();
    expect(mockRealtime.removed).toBe(true);
  });
});

describe('the new kinds of Notification', () => {
  test('Confirmed by the shop or automatically reads in Thai and opens the order', async () => {
    mockMember = customer;
    feed = {
      notifications: [
        note('c1', 'confirmed_by_admin', { order_number: 'STB-261010-00011' }),
        note('c2', 'confirmed_auto', { order_number: 'STB-261010-00012' }),
      ],
      unread: 2,
    };
    renderApp('/');
    userEvent.click((await screen.findAllByRole('button', { name: /ยังไม่อ่าน 2/ }))[0]);
    const panel = within(screen.getByRole('region', { name: 'การแจ้งเตือน' }));
    expect(panel.getByRole('link', { name: /ร้านยืนยันว่าคุณได้รับ STB-261010-00011 แล้ว/ })).toHaveAttribute('href', '/orders/o1');
    expect(panel.getByRole('link', { name: /ระบบยืนยันรับสินค้า STB-261010-00012 ให้อัตโนมัติ/ })).toBeInTheDocument();
  });

  test("an Admin's Confirmed notifications name the customer and open the order on the admin page", async () => {
    mockMember = { ...customer, role: 'admin' };
    feed = {
      notifications: [
        note('a1', 'admin_confirmed_by_customer', { order_number: 'STB-261010-00013', customer: 'มาลี ใจดี' }),
        note('a2', 'admin_confirmed_auto', { order_number: 'STB-261010-00014', customer: 'สมชาย' }),
      ],
      unread: 2,
    };
    renderApp('/');
    userEvent.click((await screen.findAllByRole('button', { name: /ยังไม่อ่าน 2/ }))[0]);
    const panel = within(screen.getByRole('region', { name: 'การแจ้งเตือน' }));
    const byCustomer = panel.getByRole('link', { name: /ลูกค้ายืนยันได้รับ STB-261010-00013 แล้ว/ });
    expect(byCustomer).toHaveAttribute('href', '/admin?order=o1');
    expect(within(byCustomer).getByText('ลูกค้า: มาลี ใจดี')).toBeInTheDocument();
    expect(panel.getByRole('link', { name: /STB-261010-00014 ยืนยันรับสินค้าอัตโนมัติ/ })).toBeInTheDocument();
  });

  test('a coming Promotion says its dates in Thai and leads to its products', async () => {
    mockMember = customer;
    feed = {
      notifications: [
        {
          id: 'p1', type: 'promotion_new', order_id: null, promotion_id: 'pr5',
          data: { promotion_id: 'pr5', name_th: 'ลดปีใหม่', name_en: 'New year sale', starts_at: '2026-12-25T17:00:00.000Z', ends_at: '2027-01-05T16:59:59.999Z' },
          read_at: null, created_at: '2026-10-11T03:00:00Z',
        } as any,
      ],
      unread: 1,
    };
    renderApp('/');
    userEvent.click((await screen.findAllByRole('button', { name: /ยังไม่อ่าน 1/ }))[0]);
    const link = screen.getByRole('link', { name: /โปรโมชันใหม่กำลังมา: ลดปีใหม่/ });
    expect(link).toHaveAttribute('href', '/?promotion=pr5');
    expect(within(link).getByText(/ใช้ได้ 26 .+ – 5 .+/)).toBeInTheDocument();
  });

  test('the Tracking Number has a copy button beside the link', async () => {
    mockMember = customer;
    const writeText = jest.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderApp('/');
    userEvent.click((await screen.findAllByRole('button', { name: /ยังไม่อ่าน 2/ }))[0]);
    const panel = within(screen.getByRole('region', { name: 'การแจ้งเตือน' }));
    userEvent.click(panel.getByRole('button', { name: 'คัดลอกหมายเลขพัสดุ KEX9' }));
    expect(writeText).toHaveBeenCalledWith('KEX9');
    expect(await panel.findByRole('button', { name: 'คัดลอกแล้ว' })).toBeInTheDocument();
    // Copying does not open the order or mark it read
    expect(api.post).not.toHaveBeenCalledWith('/notifications/n1/read', {});
  });
});
