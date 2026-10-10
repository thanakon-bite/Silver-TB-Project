import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './test/renderPage';
import { api, ApiError } from './lib/api';

jest.mock('./lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 'test-token' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }),
  },
}));

jest.mock('./lib/api', () => {
  const actual = jest.requireActual('./lib/api');
  return { ...actual, api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() } };
});

// Alerts need browser APIs jsdom lacks; what matters here is what the page itself shows.
jest.mock('sweetalert2', () => ({ __esModule: true, default: { fire: jest.fn(() => Promise.resolve({})) } }));

// Canvas does not exist in jsdom; every chart's table view carries the same numbers.
jest.mock('react-chartjs-2', () => ({ Bar: () => null, Doughnut: () => null }));

const admin = { id: 'a1', email: 'owner@example.com', full_name: 'เจ้าของร้าน', role: 'admin' };

const stats = (overrides = {}) => ({
  revenue_total: 6400,
  orders_by_status: { pending: 1, paid: 2, shipped: 3, delivered: 4, cancelled: 0 },
  products_by_category: { beetle: 5, food: 2, log: 1, gear: 0 },
  to_fulfil: 2,
  needs_attention: 0,
  customers: 7,
  low_stock: [{ id: 'p1', name: 'Atlas beetle', stock: 0 }],
  daily: [{ date: '2026-10-10', revenue: 3200, orders: 1 }],
  ...overrides,
});

const product = (id: string, name: string, is_active = true) => ({
  id, name, name_th: null, description: null, description_th: null, price: 3200, stock: 5, category: 'beetle',
  attributes: {}, images: [], is_best_seller: false, is_active, views: 0, created_at: '2026-10-01T00:00:00Z',
});

const member = (id: string, full_name: string, role: 'user' | 'admin' = 'user') => ({
  id, full_name, email: `${id}@example.com`, phone: null, role, created_at: '2026-10-01T00:00:00Z', orders: 0, total_spent: 0,
});

/** The admin API: each test overrides the parts it is about. Paths are matched without their query. */
function backend(overrides: Record<string, unknown> = {}) {
  const responses: Record<string, unknown> = {
    '/auth/me': admin,
    '/admin/stats': stats(),
    '/orders/admin/all': { orders: [], total: 25, page: 1, limit: 10 },
    '/products/admin/all': { products: [product('p1', 'Atlas beetle')], total: 1, page: 1, limit: 10 },
    '/admin/customers': { customers: [member('a1', 'เจ้าของร้าน', 'admin'), member('u1', 'มาลี')], total: 2, page: 1, limit: 10 },
    ...overrides,
  };
  (api.get as jest.Mock).mockImplementation((path: string) => {
    const key = path.split('?')[0];
    return key in responses ? Promise.resolve(responses[key]) : Promise.reject(new Error(`unexpected GET ${path}`));
  });
}

const getCalls = (prefix: string) => (api.get as jest.Mock).mock.calls.map(([p]) => p as string).filter((p) => p.startsWith(prefix));

beforeEach(() => {
  jest.clearAllMocks();
  backend();
});

const openTab = async (name: string) => {
  userEvent.click(await screen.findByRole('tab', { name }));
};

describe('Overview', () => {
  test('shows orders by status, products by category and low stock as tables on request', async () => {
    renderApp('/admin');
    const status = await screen.findByRole('region', { name: 'Orders by status' });
    userEvent.click(within(status).getByRole('button', { name: 'Table' }));
    expect(within(status).getByRole('row', { name: /Shipped 3/ })).toBeInTheDocument();

    const categories = screen.getByRole('region', { name: 'Products by category' });
    userEvent.click(within(categories).getByRole('button', { name: 'Table' }));
    expect(within(categories).getByRole('row', { name: /Beetle 5/ })).toBeInTheDocument();

    const low = screen.getByRole('region', { name: /Running low/ });
    userEvent.click(within(low).getByRole('button', { name: 'Table' }));
    expect(within(low).getByRole('row', { name: /Atlas beetle Sold out/ })).toBeInTheDocument();
  });

  test('says so when there is nothing to chart', async () => {
    backend({
      '/admin/stats': stats({
        orders_by_status: { pending: 0, paid: 0, shipped: 0, delivered: 0, cancelled: 0 },
        products_by_category: { beetle: 0, food: 0, log: 0, gear: 0 },
        low_stock: [],
        daily: [{ date: '2026-10-10', revenue: 0, orders: 0 }],
      }),
    });
    renderApp('/admin');
    expect(await screen.findByText('No orders yet.')).toBeInTheDocument();
    expect(screen.getByText('No active products yet.')).toBeInTheDocument();
    expect(screen.getByText('All active products are well stocked.')).toBeInTheDocument();
    expect(screen.getByText('No paid orders in the last 14 days.')).toBeInTheDocument();
  });

  test('a status in the legend opens Orders filtered to it', async () => {
    renderApp('/admin');
    const status = await screen.findByRole('region', { name: 'Orders by status' });
    userEvent.click(within(status).getByRole('button', { name: /Shipped/ }));
    await waitFor(() => expect(getCalls('/orders/admin/all').some((p) => p.includes('status=shipped'))).toBe(true));
  });
});

test('Orders shows 10 per page with a pager', async () => {
  renderApp('/admin');
  await openTab('Orders');
  await waitFor(() => expect(screen.getByText(/items/)).toHaveTextContent('Page 1 of 3 · 25 items'));
  await waitFor(() => expect(getCalls('/orders/admin/all').at(-1)).toContain('limit=10'));
  userEvent.click(screen.getByRole('button', { name: /Next/ }));
  await waitFor(() => expect(getCalls('/orders/admin/all').at(-1)).toContain('page=2'));
});

describe('Products & stock', () => {
  test('a switch turns a product off for the shop', async () => {
    (api.patch as jest.Mock).mockResolvedValue({});
    renderApp('/admin');
    await openTab('Products & stock');
    const toggle = await screen.findByRole('switch', { name: 'Show Atlas beetle in the shop' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    userEvent.click(toggle);
    expect(api.patch).toHaveBeenCalledWith('/products/p1', { is_active: false });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
  });

  test('the switch flips back when saving fails', async () => {
    (api.patch as jest.Mock).mockRejectedValue(new Error('offline'));
    renderApp('/admin');
    await openTab('Products & stock');
    const toggle = await screen.findByRole('switch', { name: 'Show Atlas beetle in the shop' });
    userEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
  });

  test('the status filter asks for inactive products from page 1, 10 at a time', async () => {
    renderApp('/admin');
    await openTab('Products & stock');
    await screen.findByRole('switch', { name: /Atlas beetle/ });
    userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Inactive');
    await waitFor(() => expect(getCalls('/products/admin/all').at(-1)).toMatch(/^(?=.*active=false)(?=.*page=1&)(?=.*limit=10)/));
  });
});

describe('Members', () => {
  test('creating a Member sends an invitation with their details and role', async () => {
    (api.post as jest.Mock).mockResolvedValue(member('u9', 'สมชาย'));
    renderApp('/admin');
    await openTab('Members');
    userEvent.click(await screen.findByRole('button', { name: /New member/ }));
    const dialog = within(await screen.findByRole('dialog', { name: 'New member' }));
    userEvent.type(dialog.getByLabelText('Full name'), 'สมชาย');
    userEvent.type(dialog.getByLabelText('Email'), 'somchai@example.com');
    userEvent.selectOptions(dialog.getByLabelText('Role'), 'admin');
    userEvent.click(dialog.getByRole('button', { name: 'Send invitation' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/customers', { full_name: 'สมชาย', email: 'somchai@example.com', phone: undefined, role: 'admin' })
    );
  });

  test('an email that is already registered is explained in the form', async () => {
    (api.post as jest.Mock).mockRejectedValue(new ApiError('A member with this email already exists', 409, 'EMAIL_TAKEN'));
    renderApp('/admin');
    await openTab('Members');
    userEvent.click(await screen.findByRole('button', { name: /New member/ }));
    const dialog = within(await screen.findByRole('dialog', { name: 'New member' }));
    userEvent.type(dialog.getByLabelText('Full name'), 'มาลี');
    userEvent.type(dialog.getByLabelText('Email'), 'u1@example.com');
    userEvent.click(dialog.getByRole('button', { name: 'Send invitation' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('A member with this email already exists.');
  });

  test('the pencil edits only the role, and never on your own row', async () => {
    (api.patch as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' });
    renderApp('/admin');
    await openTab('Members');
    await screen.findByText('มาลี');
    expect(screen.queryByRole('button', { name: 'Edit เจ้าของร้าน' })).not.toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: 'Edit มาลี' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'มาลี' }));
    expect(dialog.getByText('u1@example.com')).toBeInTheDocument();
    expect(dialog.queryAllByRole('textbox')).toHaveLength(0);
    userEvent.selectOptions(dialog.getByLabelText('Role'), 'admin');
    userEvent.click(dialog.getByRole('button', { name: 'Save role' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin/customers/u1/role', { role: 'admin' }));
  });

  test('a new search starts again at page 1', async () => {
    backend({ '/admin/customers': { customers: [member('u1', 'มาลี')], total: 25, page: 1, limit: 10 } });
    renderApp('/admin');
    await openTab('Members');
    await screen.findByText('มาลี');
    userEvent.click(screen.getByRole('button', { name: /Next/ }));
    await waitFor(() => expect(getCalls('/admin/customers').at(-1)).toContain('page=2'));
    userEvent.type(screen.getByLabelText('Search members'), 'มา');
    await waitFor(() => expect(getCalls('/admin/customers').at(-1)).toMatch(/^(?=.*page=1&)(?=.*search=)/));
  });

  test('the list shows 10 per page', async () => {
    renderApp('/admin');
    await openTab('Members');
    await screen.findByText('มาลี');
    expect(getCalls('/admin/customers').at(-1)).toContain('limit=10');
    expect(screen.getByText(/items/)).toHaveTextContent('Page 1 of 1 · 2 items');
  });
});
