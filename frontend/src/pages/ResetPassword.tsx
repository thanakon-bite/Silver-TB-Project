import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '../contexts/AuthContext';

/**
 * Landing page for the password-reset email link. Supabase puts a recovery session in the URL,
 * which supabase-js picks up automatically; the user then chooses a new password here.
 */
const ResetPassword: React.FC = () => {
  const { session, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('Password must be at least 8 characters');
    if (password !== confirm) return setError('Passwords do not match');
    setSaving(true);
    try {
      await updatePassword(password);
      await Swal.fire({ icon: 'success', title: 'Password updated', timer: 1200, showConfirmButton: false });
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-premium-gradient">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Lock className="w-6 h-6 text-orange" /> Choose a new password
        </h1>
        {!session ? (
          <p className="text-sm text-gray-600 mt-4">
            This reset link is invalid or has expired. <Link to="/login" className="text-orange underline">Request a new one</Link>.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4 mt-6">
            <input
              type="password"
              autoComplete="new-password"
              placeholder="New password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange/50"
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange/50"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button disabled={saving} className="w-full py-3 bg-orange-gradient text-white font-bold rounded-xl disabled:opacity-50">
              {saving ? 'Saving…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
