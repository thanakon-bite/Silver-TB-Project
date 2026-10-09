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
      .select('id, role, full_name, phone')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) return next(profileError);
    if (!profile) return res.status(403).json({ error: 'Account profile not found' });

    req.user = { ...profile, email: data.user.email };
    next();
  } catch (err) {
    next(err);
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = { authenticate, requireAdmin };
