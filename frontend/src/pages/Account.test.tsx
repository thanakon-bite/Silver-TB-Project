import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/renderPage';
import { api } from '../lib/api';

// The password checks go to Supabase Auth from the browser; these stand-ins record what was asked.
const mockAuth = {
  signInWithPassword: jest.fn(),
  updateUser: jest.fn(),
  resetPasswordForEmail: jest.fn(),
};

jest.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 'test-token' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => Promise.resolve({ error: null }),
      signInWithPassword: (...args: unknown[]) => mockAuth.signInWithPassword(...args),
      updateUser: (...args: unknown[]) => mockAuth.updateUser(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockAuth.resetPasswordForEmail(...args),
    },
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
      upsert: () => Promise.resolve({ error: null }),
    }),
  },
}));

jest.mock('../lib/api', () => {
  const actual = jest.requireActual('../lib/api');
  return { ...actual, api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() } };
});

const customer = { id: 'u1', email: 'mali@example.com', full_name: 'มาลี ใจดี', phone: '', role: 'user' };

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  (api.get as jest.Mock).mockImplementation((path: string) => {
    if (path === '/auth/me') return Promise.resolve(customer);
    if (path === '/addresses') return Promise.resolve([]);
    if (path === '/notifications') return Promise.resolve({ notifications: [], unread: 0 });
    if (path.startsWith('/products')) return Promise.resolve({ products: [] });
    if (path === '/rules/promotions') return Promise.resolve([]);
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
  mockAuth.signInWithPassword.mockResolvedValue({ data: { session: { access_token: 'test-token' } }, error: null });
  mockAuth.updateUser.mockResolvedValue({ data: {}, error: null });
  mockAuth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
});

const passwordForm = async () => {
  renderApp('/account');
  return within(await screen.findByRole('form', { name: 'เปลี่ยนรหัสผ่าน' }));
};

const fill = (form: ReturnType<typeof within>, current: string, next: string, again = next) => {
  userEvent.type(form.getByLabelText('รหัสผ่านปัจจุบัน'), current);
  userEvent.type(form.getByLabelText('รหัสผ่านใหม่'), next);
  userEvent.type(form.getByLabelText('ยืนยันรหัสผ่านใหม่'), again);
  userEvent.click(form.getByRole('button', { name: 'เปลี่ยนรหัสผ่าน' }));
};

test('a Customer changes their password after proving the current one', async () => {
  const form = await passwordForm();
  fill(form, 'old-secret', 'new-secret-1');
  await waitFor(() => expect(mockAuth.updateUser).toHaveBeenCalledWith({ password: 'new-secret-1' }));
  expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({ email: 'mali@example.com', password: 'old-secret' });
  expect(await form.findByText('เปลี่ยนรหัสผ่านแล้ว')).toBeInTheDocument();
  // The fields are cleared so the password does not stay on screen
  expect(form.getByLabelText('รหัสผ่านใหม่')).toHaveValue('');
});

test('a wrong current password changes nothing and says so', async () => {
  mockAuth.signInWithPassword.mockResolvedValue({ data: { session: null }, error: { message: 'Invalid login credentials' } });
  const form = await passwordForm();
  fill(form, 'guess', 'new-secret-1');
  expect(await form.findByText('รหัสผ่านปัจจุบันไม่ถูกต้อง')).toBeInTheDocument();
  expect(mockAuth.updateUser).not.toHaveBeenCalled();
});

test('a short or mismatched new password is refused before anything is sent', async () => {
  const form = await passwordForm();
  fill(form, 'old-secret', 'short');
  expect(await form.findByText('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')).toBeInTheDocument();
  userEvent.clear(form.getByLabelText('รหัสผ่านใหม่'));
  userEvent.clear(form.getByLabelText('ยืนยันรหัสผ่านใหม่'));
  userEvent.clear(form.getByLabelText('รหัสผ่านปัจจุบัน'));
  fill(form, 'old-secret', 'new-secret-1', 'new-secret-2');
  expect(await form.findByText('รหัสผ่านทั้งสองช่องไม่ตรงกัน')).toBeInTheDocument();
  expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
  expect(mockAuth.updateUser).not.toHaveBeenCalled();
});

test('forgot the current password: a reset link goes to their own email', async () => {
  const form = await passwordForm();
  userEvent.click(form.getByRole('button', { name: 'ลืมรหัสผ่านปัจจุบัน? ส่งลิงก์ตั้งรหัสใหม่ทางอีเมล' }));
  await waitFor(() =>
    expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith('mali@example.com', { redirectTo: `${window.location.origin}/reset-password` })
  );
  expect(await form.findByText('ส่งลิงก์ไปที่ mali@example.com แล้ว')).toBeInTheDocument();
});
