const supabase = require('../config/supabase');

/**
 * Verifies the Supabase Auth access token sent by the frontend (Authorization: Bearer <jwt>)
 * and loads the caller's profile (role comes from the database, never from the token).
 *
 * supabase.auth.getUser(jwt) validates the token with Supabase Auth and does NOT store a
 * session on the shared service-role client.
 */
const authenticate = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Please sign in to continue' });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Your session has expired — please sign in again' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, full_name, phone, deactivated_at')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) return next(profileError);
    if (!profile) return res.status(403).json({ error: 'Account profile not found' });
    // A removed Member who has orders is Deactivated (CONTEXT.md): their old sessions stop working too.
    if (profile.deactivated_at) return res.status(403).json({ error: 'This account has been deactivated', code: 'ACCOUNT_DEACTIVATED' });

    delete profile.deactivated_at;
    req.user = { ...profile, email: data.user.email };
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * For public endpoints that answer a signed-in Customer differently: a valid token sets req.user,
 * anything else (no token, expired, deactivated) carries on as a guest.
 */
const optionalAuth = async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return next();
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) {
      const { data: profile } = await supabase.from('profiles').select('id, role, deactivated_at').eq('id', data.user.id).maybeSingle();
      if (profile && !profile.deactivated_at) req.user = { id: profile.id, role: profile.role };
    }
  } catch {
    /* a guest, then */
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = { authenticate, optionalAuth, requireAdmin };
