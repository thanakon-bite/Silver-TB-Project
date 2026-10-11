import { api } from './api';

let mockToken: string | null = null;

jest.mock('./supabaseClient', () => ({
  supabase: { auth: { getSession: () => Promise.resolve({ data: { session: mockToken ? { access_token: mockToken } : null } }) } },
}));

const fetchMock = jest.fn();

beforeEach(() => {
  mockToken = null;
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('[]') });
  (global as any).fetch = fetchMock;
});

const headersOf = (call: number) => fetchMock.mock.calls[call][1].headers as Record<string, string>;

test('a signed-in shopper asks for running Promotions with their token, so used-up ones are left out', async () => {
  mockToken = 'customer-token';
  await api.get('/rules/promotions');
  expect(fetchMock.mock.calls[0][0]).toMatch(/\/rules\/promotions$/);
  expect(headersOf(0).Authorization).toBe('Bearer customer-token');
});

test('a guest asks without a token', async () => {
  await api.get('/rules/promotions');
  expect(headersOf(0).Authorization).toBeUndefined();
});
