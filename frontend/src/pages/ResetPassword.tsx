import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BeetleMark from '../component/brand/BeetleMark';
import { ErrorBox } from '../component/ui/Feedback';
import { primaryButton, textLink } from '../component/ui/buttonStyles';
import { fieldClass, fieldLabel } from '../component/ui/fieldStyles';

/**
 * Landing page for the password-reset email link. Supabase puts a recovery session in the URL,
 * which supabase-js picks up automatically; the user then chooses a new password here.
 */
const ResetPassword: React.FC = () => {
  const { t } = useTranslation();
  const { session, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError(t('login_page.err_password_short'));
    if (password !== confirm) return setError(t('reset_page.err_mismatch'));
    setError('');
    setSaving(true);
    try {
      await updatePassword(password);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err?.message || t('login_page.err_generic'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="flex justify-center px-4 pb-20 pt-10 sm:pt-16">
      <div className="w-full max-w-sm">
        <BeetleMark className="h-10 w-10 text-accent-strong" />
        <h1 className="mt-4 font-display text-3xl font-bold text-ink">{t('reset_page.title')}</h1>
        {!session ? (
          <p className="mt-4 text-sm text-muted">
            {t('reset_page.invalid')}{' '}
            <Link to="/login" className={textLink}>
              {t('reset_page.request_new')}
            </Link>
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="new-password" className={fieldLabel}>
                {t('reset_page.new_password')}
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby="new-password-hint"
                className={fieldClass()}
              />
              <p id="new-password-hint" className="mt-1 text-xs text-muted">
                {t('login_page.password_hint')}
              </p>
            </div>
            <div>
              <label htmlFor="confirm-password" className={fieldLabel}>
                {t('reset_page.confirm_password')}
              </label>
              <input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={fieldClass()} />
            </div>
            {error && <ErrorBox>{error}</ErrorBox>}
            <button disabled={saving} className={`${primaryButton} !mt-6`}>
              {saving ? t('login_page.wait') : t('reset_page.submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
