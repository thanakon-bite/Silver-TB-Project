import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Bug, Mail, Lock, User, Phone, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';

type Mode = 'login' | 'signup';

const Login: React.FC = () => {
  const { login, signup, requestPasswordReset } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Only allow internal redirects (prevents open-redirect via ?redirect=https://evil)
  const rawRedirect = params.get('redirect') || '/';
  const redirectTo = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';

  const [mode, setMode] = useState<Mode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email format';
    if (!form.password) e.password = 'Password is required';
    else if (mode === 'signup' && form.password.length < 8) e.password = 'Password must be at least 8 characters';
    if (mode === 'signup') {
      if (!form.full_name.trim()) e.full_name = 'Full name is required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [e.target.name]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email.trim(), form.password);
        await Swal.fire({ icon: 'success', title: 'Welcome back!', timer: 1200, showConfirmButton: false });
      } else {
        const { needsEmailConfirmation } = await signup(form.email.trim(), form.password, form.full_name.trim(), form.phone || undefined);
        if (needsEmailConfirmation) {
          await Swal.fire({
            icon: 'info',
            title: 'Check your email',
            text: `We sent a confirmation link to ${form.email.trim()}. Click it, then sign in.`,
          });
          setMode('login');
          setForm((f) => ({ ...f, password: '' }));
          return;
        }
        await Swal.fire({ icon: 'success', title: 'Account created!', text: 'Welcome to Silver Thief Bug 🪲', timer: 1500, showConfirmButton: false });
      }
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message || 'Something went wrong' });
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    const { value: email } = await Swal.fire({
      title: 'Reset your password',
      input: 'email',
      inputValue: form.email,
      inputPlaceholder: 'you@example.com',
      showCancelButton: true,
      confirmButtonColor: '#FF922B',
      confirmButtonText: 'Send reset link',
    });
    if (!email) return;
    try {
      await requestPasswordReset(email);
    } catch {
      /* don't reveal whether the email exists */
    }
    Swal.fire({ icon: 'success', title: 'Check your email', text: 'If an account exists for that email, a reset link is on its way.' });
  };

  return (
    <div className="min-h-screen bg-premium-gradient flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 px-8 py-10 text-center">
            <Link to="/" className="inline-flex items-center gap-2 mb-3">
              <Bug className="w-8 h-8 text-orange" />
              <span className="text-2xl font-bold">
                <span className="text-silver-metallic italic">Silver</span>
                <span className="text-orange">Thief</span>
                <span className="text-white">Bug</span>
              </span>
            </Link>
            <p className="text-gray-400 text-sm">Premium Exotic Beetle Store</p>
          </div>

          {/* Toggle */}
          <div className="flex border-b border-gray-100">
            {(['login', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setErrors({}); }}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  mode === m
                    ? 'text-orange border-b-2 border-orange'
                    : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    name="full_name"
                    value={form.full_name}
                    onChange={handleChange}
                    placeholder="Your full name"
                    className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange/50 ${errors.full_name ? 'border-red-400' : 'border-gray-200'}`}
                  />
                </div>
                {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name}</p>}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange/50 ${errors.email ? 'border-red-400' : 'border-gray-200'}`}
                />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-10 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange/50 ${errors.password ? 'border-red-400' : 'border-gray-200'}`}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone <span className="text-gray-400">(optional)</span></label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+66 88 123 4567"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange/50"
                  />
                </div>
              </div>
            )}

            {mode === 'login' && (
              <div className="text-right -mt-2">
                <button type="button" onClick={handleForgot} className="text-xs text-gray-500 hover:text-orange">
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-orange-gradient text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 shadow-lg"
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          <Link to="/" className="hover:text-orange transition-colors">← Back to store</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
