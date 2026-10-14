/**
 * LINE Recipients (CONTEXT.md; ADR 0002, amended): the Official Account's 1:1 friends, learnt from its
 * webhook. Following the OA grants nothing; a friend gets order alerts only once an Admin ticks them.
 * Groups and rooms are ignored, since anyone can invite the bot to one.
 */
const supabase = require('../config/supabase');
const line = require('../lib/line');
const { conflict, notFound, unwrap } = require('../lib/http');

const LINE_USER_ID = /^U[0-9a-f]{32}$/;
const FRIEND_FIELDS = 'line_user_id, display_name, picture_url, followed_at, receives_alerts';

/** A friend followed the OA, or messaged it (which also catches friends from before the webhook). */
async function learnFriend(userId, { followed }) {
  const now = new Date().toISOString();
  const row = { line_user_id: userId, unfollowed_at: null, updated_at: now };
  if (followed) row.followed_at = now;
  const profile = await line.getProfile(userId).catch((err) => {
    console.error('LINE profile failed:', err.message);
    return null;
  });
  // A failed profile lookup keeps the name already known
  if (profile) Object.assign(row, { display_name: profile.displayName ?? null, picture_url: profile.pictureUrl ?? null });
  unwrap(await supabase.from('line_contacts').upsert(row, { onConflict: 'line_user_id' }));
}

/** Applies the webhook's events; one that fails is logged and the rest still run. */
async function handleWebhookEvents(events) {
  for (const event of Array.isArray(events) ? events : []) {
    const userId = event?.source?.type === 'user' ? event.source.userId : null;
    if (!userId || !LINE_USER_ID.test(userId)) continue;
    try {
      if (event.type === 'follow') await learnFriend(userId, { followed: true });
      else if (event.type === 'message') await learnFriend(userId, { followed: false });
      else if (event.type === 'unfollow') {
        const now = new Date().toISOString();
        unwrap(await supabase.from('line_contacts').update({ unfollowed_at: now, updated_at: now }).eq('line_user_id', userId));
      }
    } catch (err) {
      console.error(`LINE ${event.type} event failed:`, err.message);
    }
  }
}

/**
 * Pulls the followers list from LINE (for an OA whose webhook cannot reach the shop, e.g. a local
 * machine). Friends already known keep their tick and follow date. Returns how many it found.
 */
async function syncFollowers() {
  let ids;
  try {
    ids = await line.getFollowerIds();
  } catch (err) {
    if (err.response?.status === 403) {
      throw conflict('LINE lists followers only for verified or premium Official Accounts', 'LINE_FOLLOWERS_UNAVAILABLE');
    }
    throw err;
  }
  const friends = ids.filter((id) => LINE_USER_ID.test(id));
  for (const id of friends) await learnFriend(id, { followed: false });
  return friends.length;
}

/** The friends an Admin can pick from: everyone still following, newest first. */
async function listFriends() {
  return unwrap(
    await supabase.from('line_contacts').select(FRIEND_FIELDS).is('unfollowed_at', null).order('followed_at', { ascending: false })
  );
}

async function setReceivesAlerts(userId, receivesAlerts) {
  const rows = unwrap(
    await supabase
      .from('line_contacts')
      .update({ receives_alerts: receivesAlerts, updated_at: new Date().toISOString() })
      .eq('line_user_id', userId)
      .is('unfollowed_at', null)
      .select(FRIEND_FIELDS)
  );
  if (!rows?.length) throw notFound('This LINE friend is not following the Official Account');
  return rows[0];
}

/** The ticked friends still following: they get every order alert along with the env Owner. */
async function recipientIds() {
  const rows = unwrap(
    await supabase.from('line_contacts').select('line_user_id').eq('receives_alerts', true).is('unfollowed_at', null)
  );
  return (rows || []).map((r) => r.line_user_id);
}

module.exports = { LINE_USER_ID, handleWebhookEvents, syncFollowers, listFriends, setReceivesAlerts, recipientIds };
