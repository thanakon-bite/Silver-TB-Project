import React, { useCallback } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';

const Spinner = () => {
  const { t } = useTranslation();
  return (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="w-10 h-10 border-2 border-line border-t-accent-strong rounded-full animate-spin motion-reduce:animate-none" role="status" aria-label={t('loading')} />
  </div>
  );
};

/** Signed-in users only. Sends guests to /login and brings them back afterwards. */
export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  return <>{children}</>;
};

/**
 * For actions that need an account (Cart, Favorites belong to signed-in Customers). Returns true when the action may go
 * ahead; for a guest it goes straight to /login and returns false, so they come back here afterwards.
 */
export const useRequireSignIn = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    if (user) return true;
    navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`);
    return false;
  }, [user, navigate, location.pathname, location.search]);
};

/**
 * Admins only. This only hides the UI — every admin API endpoint is also protected
 * server-side (requireAdmin) and by RLS in the database.
 */
export const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login?redirect=%2Fadmin" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export { Spinner };
