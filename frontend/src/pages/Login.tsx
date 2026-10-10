import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, MailCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import BeetleMark from '../component/brand/BeetleMark';
import { ErrorBox, Notice } from '../component/ui/Feedback';
import { primaryButton, quietLink, textLink } from '../component/ui/buttonStyles';
import { fieldClass, fieldError, fieldLabel } from '../component/ui/fieldStyles';

type Mode = 'login' | 'signup' | 'forgot';

const Login: React.FC = () => {
  const { t } = useTranslation();
  const { login, signup, requestPasswordReset } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Only allow internal redirects (prevents open-redirect via ?redirect=https://evil)
  const rawRedirect = params.get('redirect') || '/';
  const redirectTo = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';

  // ?mode=signup opens the sign-up form (the footer's "สมัครสมาชิก" link); anything else signs in.
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signup' ? 'signup' : 'login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  /** A message that replaces the form's next step (confirmation email sent, reset link sent). */
  const [notice, setNotice] = useState('');

  const switchMode = (m: Mode) => {
    setMode(m);
    setErrors({});
    setServerError('');
    setNotice('');
  };

  // Following the link again while already on this page (e.g. from the footer) still switches the form.
  const urlMode = params.get('mode');
  useEffect(() => {
    if (urlMode !== 'signup') return;
    setMode('signup');
    setErrors({});
    setServerError('');
    setNotice('');
  }, [urlMode]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.email.trim()) e.email = t('login_page.err_email_required');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = t('login_page.err_email_format');
    if (mode !== 'forgot') {
      if (!form.password) e.password = t('login_page.err_password_required');
      else if (mode === 'signup' && form.password.length < 8) e.password = t('login_page.err_password_short');
    }
    if (mode === 'signup' && !form.full_name.trim()) e.full_name = t('login_page.err_name_required');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [e.target.name]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const email = form.email.trim();
      if (mode === 'forgot') {
        try {
          await requestPasswordReset(email);
        } catch {
          /* don't reveal whether the email exists */
        }
        setNotice(t('login_page.reset_sent'));
        return;
      }
      if (mode === 'login') {
        await login(email, form.password);
      } else {
        const { needsEmailConfirmation } = await signup(email, form.password, form.full_name.trim(), form.phone || undefined);
        if (needsEmailConfirmation) {
          setMode('login');
          setForm((f) => ({ ...f, password: '' }));
          setNotice(t('login_page.confirm_sent', { email }));
          return;
        }
      }
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      setServerError(err?.message || t('login_page.err_generic'));
    } finally {
      setLoading(false);
    }
  };

  const title = mode === 'signup' ? t('login_page.signup_title') : mode === 'forgot' ? t('login_page.forgot_title') : t('login_page.login_title');
  const submitLabel =
    mode === 'signup' ? t('login_page.signup_submit') : mode === 'forgot' ? t('login_page.forgot_submit') : t('login_page.login_submit');

  return (
    <div className="flex justify-center px-4 pb-20 pt-10 sm:pt-16">
      <div className="w-full max-w-sm">
        <BeetleMark className="h-10 w-10 text-accent-strong" />
        <h1 className="mt-4 font-display text-3xl font-bold text-ink">{title}</h1>
        {mode === 'forgot' && <p className="mt-2 text-sm text-muted">{t('login_page.forgot_text')}</p>}

        {mode !== 'forgot' && (
          <div className="mt-6 grid grid-cols-2 rounded-xl border border-line p-1" role="group" aria-label={t('login_page.mode')}>
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => switchMode(m)}
                className={`h-10 rounded-lg text-sm font-semibold transition-colors motion-reduce:transition-none ${
                  mode === m ? 'bg-sunken text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {m === 'login' ? t('login_page.tab_login') : t('login_page.tab_signup')}
              </button>
            ))}
          </div>
        )}

        {notice && (
          <Notice className="mt-6" icon={<MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />}>
            {notice}
          </Notice>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="full_name" className={fieldLabel}>
                {t('full_name')}
              </label>
              <input
                id="full_name"
                name="full_name"
                autoComplete="name"
                value={form.full_name}
                onChange={handleChange}
                aria-invalid={!!errors.full_name}
                aria-describedby={errors.full_name ? 'full_name-error' : undefined}
                className={fieldClass(errors.full_name)}
              />
              {errors.full_name && <p id="full_name-error" className={fieldError}>{errors.full_name}</p>}
            </div>
          )}

          <div>
            <label htmlFor="email" className={fieldLabel}>
              {t('email_address')}
            </label>
            <input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className={fieldClass(errors.email)}
            />
            {errors.email && <p id="email-error" className={fieldError}>{errors.email}</p>}
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="password" className={fieldLabel}>
                  {t('password')}
                </label>
                {mode === 'login' && (
                  <button type="button" onClick={() => switchMode('forgot')} className={`${textLink} text-xs`}>
                    {t('login_page.forgot_link')}
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={form.password}
                  onChange={handleChange}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : mode === 'signup' ? 'password-hint' : undefined}
                  className={`${fieldClass(errors.password)} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? t('login_page.hide_password') : t('login_page.show_password')}
                  aria-pressed={showPassword}
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:text-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                </button>
              </div>
              {errors.password ? (
                <p id="password-error" className={fieldError}>{errors.password}</p>
              ) : (
                mode === 'signup' && <p id="password-hint" className="mt-1 text-xs text-muted">{t('login_page.password_hint')}</p>
              )}
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label htmlFor="phone" className={fieldLabel}>
                {t('phone')} <span className="font-normal text-muted">({t('login_page.optional')})</span>
              </label>
              <input id="phone" type="tel" name="phone" autoComplete="tel" inputMode="tel" value={form.phone} onChange={handleChange} placeholder="0812345678" className={fieldClass()} />
            </div>
          )}

          {serverError && <ErrorBox title={t('login_page.err_title')}>{serverError}</ErrorBox>}

          <button type="submit" disabled={loading} className={`${primaryButton} !mt-6`}>
            {loading ? t('login_page.wait') : submitLabel}
          </button>
        </form>

        <p className="mt-6 text-sm">
          {mode === 'forgot' ? (
            <button type="button" onClick={() => switchMode('login')} className={quietLink}>
              ← {t('login_page.back_to_login')}
            </button>
          ) : (
            <Link to="/" className={quietLink}>
              ← {t('login_page.back_to_store')}
            </Link>
          )}
        </p>
      </div>
    </div>
  );
};

export default Login;
