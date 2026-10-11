import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Bell, Check, Copy } from 'lucide-react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { api, API_WRITE_EVENT, type ApiWrite } from '../../lib/api';
import { supabase } from '../../lib/supabaseClient';
import { cancelReasonText, localDate, localDateTime } from '../../lib/format';
import { iconButton } from '../ui/buttonStyles';

export interface AppNotification {
  id: string;
  type:
    | 'awaiting_payment'
    | 'shipping'
    | 'confirm_request'
    | 'cancelled'
    | 'confirmed_by_admin'
    | 'confirmed_auto'
    | 'admin_confirmed_by_customer'
    | 'admin_confirmed_auto'
    | 'promotion_new'
    | 'promotion';
  order_id: string | null;
  promotion_id?: string | null;
  data: {
    order_number?: string;
    tracking_number?: string;
    carrier?: string;
    cancel_reason?: string;
    refunded?: boolean;
    customer?: string;
    name_th?: string;
    name_en?: string;
    promotion_id?: string;
    starts_at?: string;
    ends_at?: string;
  };
  read_at: string | null;
  created_at: string;
}

/** A safety net only: Realtime, the Member's own actions and coming back to the tab refresh sooner. */
const POLL_MS = 60_000;
/** Several triggers at once (a Realtime row plus the action that caused it) make one request. */
const REFRESH_DELAY_MS = 300;
/** Writes that cannot create a Notification for this Member: marking read, pricing the Cart. */
const QUIET_WRITES = ['/notifications', '/orders/price-preview'];

interface NotificationPage {
  notifications: AppNotification[];
  unread: number;
  has_more?: boolean;
}

/**
 * A signed-in Member's Notifications (CONTEXT.md). They refresh at once when Supabase Realtime reports a
 * new or changed row for this Member, after any of their own actions succeeds, when they come back to the
 * tab and when they open the bell; a poll about every minute covers a dropped Realtime connection.
 * Navbar owns one of these and hands it to each bell it draws.
 */
export function useNotifications(userId: string | null) {
  const enabled = Boolean(userId);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Older pages the Member opened stay while the poll refreshes the newest page.
  const olderLoaded = useRef(false);
  // Only the newest request may update the list: a reply that left before the Member marked
  // something read would bring the old unread state back.
  const generation = useRef(0);

  const load = useCallback(async () => {
    const mine = ++generation.current;
    try {
      const data = await api.get<NotificationPage>('/notifications');
      if (mine !== generation.current) return;
      const latest = data.notifications || [];
      setUnread(data.unread || 0);
      if (!olderLoaded.current) {
        setItems(latest);
        setHasMore(Boolean(data.has_more));
        return;
      }
      setItems((list) => {
        const ids = new Set(latest.map((n) => n.id));
        const oldest = latest[latest.length - 1];
        const rest = list.filter((n) => !ids.has(n.id) && (!oldest || n.created_at <= oldest.created_at));
        return [...latest, ...rest];
      });
    } catch {
      /* offline or signed out: keep what we have, try again next time */
    }
  }, []);

  const loadMore = async () => {
    const last = items[items.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await api.get<NotificationPage>(
        `/notifications?before=${encodeURIComponent(last.created_at)}&before_id=${last.id}`
      );
      olderLoaded.current = true;
      setItems((list) => {
        const ids = new Set(list.map((n) => n.id));
        return [...list, ...(data.notifications || []).filter((n) => !ids.has(n.id))];
      });
      setHasMore(Boolean(data.has_more));
      setUnread(data.unread || 0);
    } catch {
      /* keep the button so the Member can try again */
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setUnread(0);
      setHasMore(false);
      olderLoaded.current = false;
      return;
    }
    load();
    const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';
    let soon: ReturnType<typeof setTimeout> | undefined;
    const refreshSoon = () => {
      clearTimeout(soon);
      soon = setTimeout(load, REFRESH_DELAY_MS);
    };
    const timer = setInterval(() => visible() && load(), POLL_MS);
    const onBack = () => visible() && refreshSoon();
    const onWrite = (e: Event) => {
      const path = (e as CustomEvent<ApiWrite>).detail?.path || '';
      if (!QUIET_WRITES.some((p) => path.startsWith(p))) refreshSoon();
    };
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('focus', onBack);
    window.addEventListener(API_WRITE_EVENT, onWrite);

    // Realtime sends only rows this Member may read (RLS), filtered to theirs; migration 006 publishes the table
    let channel: RealtimeChannel | null = null;
    try {
      if (typeof supabase.channel === 'function') {
        channel = supabase
          .channel(`notifications:${userId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, refreshSoon)
          .subscribe();
      }
    } catch {
      /* no Realtime: the poll and the other triggers still refresh */
    }

    return () => {
      clearInterval(timer);
      clearTimeout(soon);
      document.removeEventListener('visibilitychange', onBack);
      window.removeEventListener('focus', onBack);
      window.removeEventListener(API_WRITE_EVENT, onWrite);
      if (channel) supabase.removeChannel(channel);
    };
  }, [enabled, userId, load]);

  const markRead = (n: AppNotification) => {
    if (n.read_at) return;
    generation.current++;
    setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    setUnread((u) => Math.max(0, u - 1));
    api.post(`/notifications/${n.id}/read`, {}).catch(() => {});
  };

  const markAllRead = () => {
    generation.current++;
    setItems((list) => list.map((x) => (x.read_at ? x : { ...x, read_at: new Date().toISOString() })));
    setUnread(0);
    api.post('/notifications/read-all', {}).catch(() => {});
  };

  return { items, unread, hasMore, loadingMore, loadMore, markRead, markAllRead, refresh: load };
}

export type NotificationsState = ReturnType<typeof useNotifications>;

/** Title and detail line for one Notification, in the reader's language. */
function describe(n: AppNotification, t: TFunction, isThai: boolean, lang: string): { title: string; body?: string; to: string } {
  const number = n.data.order_number || '';
  const toOrder = n.order_id ? `/orders/${n.order_id}` : '/orders';
  // Notifications for Admins open the order on the admin page
  const toAdminOrder = n.order_id ? `/admin?order=${n.order_id}` : '/admin';
  const promotionId = n.promotion_id || n.data.promotion_id;
  const toPromotion = promotionId ? `/?promotion=${promotionId}` : '/';
  const promoName = (isThai ? n.data.name_th : n.data.name_en || n.data.name_th) || '';
  switch (n.type) {
    case 'awaiting_payment':
      return { title: t('notifications.awaiting_payment', { number }), body: t('notifications.awaiting_payment_body'), to: toOrder };
    case 'shipping':
      return {
        title: t('notifications.shipping', { number }),
        body: n.data.tracking_number
          ? n.data.carrier
            ? t('notifications.shipping_body_carrier', { carrier: n.data.carrier, tracking: n.data.tracking_number })
            : t('notifications.shipping_body', { tracking: n.data.tracking_number })
          : undefined,
        to: toOrder,
      };
    case 'confirm_request':
      return { title: t('notifications.confirm_request', { number }), body: t('notifications.confirm_request_body'), to: toOrder };
    case 'cancelled':
      return {
        title: t('notifications.cancelled', { number }),
        body: n.data.cancel_reason ? t('notifications.cancelled_body', { reason: cancelReasonText(n.data.cancel_reason, t) }) : undefined,
        to: toOrder,
      };
    case 'confirmed_by_admin':
      return { title: t('notifications.confirmed_by_admin', { number }), body: t('notifications.confirmed_body'), to: toOrder };
    case 'confirmed_auto':
      return { title: t('notifications.confirmed_auto', { number }), body: t('notifications.confirmed_body'), to: toOrder };
    case 'admin_confirmed_by_customer':
      return { title: t('notifications.admin_confirmed_by_customer', { number }), body: n.data.customer ? t('notifications.admin_confirmed_body', { customer: n.data.customer }) : undefined, to: toAdminOrder };
    case 'admin_confirmed_auto':
      return { title: t('notifications.admin_confirmed_auto', { number }), body: n.data.customer ? t('notifications.admin_confirmed_body', { customer: n.data.customer }) : undefined, to: toAdminOrder };
    case 'promotion_new':
      return {
        title: t('notifications.promotion_new', { name: promoName }),
        body: t('notifications.promotion_new_body', { from: localDate(n.data.starts_at, lang), to: localDate(n.data.ends_at, lang) }),
        to: toPromotion,
      };
    case 'promotion':
      return { title: t('notifications.promotion', { name: promoName }), body: t('notifications.promotion_body'), to: toPromotion };
    default:
      return { title: '', to: '/' };
  }
}

/** Copies a Tracking Number to paste into the carrier's site; sits beside the link, never inside it. */
const CopyTracking: React.FC<{ tracking: string }> = ({ tracking }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    Promise.resolve(navigator.clipboard?.writeText(tracking))
      .then(() => setCopied(true))
      .catch(() => {});
  };
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? t('notifications.copied') : t('notifications.copy_tracking', { tracking })}
      className={`${iconButton} absolute right-2 top-2`}
    >
      {copied ? <Check className="h-4 w-4 text-accent-strong" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
    </button>
  );
};

const NotificationBell: React.FC<{ state: NotificationsState; className?: string }> = ({ state, className = '' }) => {
  const { t, i18n } = useTranslation();
  const isThai = (i18n.language || 'th').startsWith('th');
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const { items, unread, hasMore, loadingMore, loadMore, markRead, markAllRead, refresh } = state;
  const toggle = () => {
    // Opening the bell shows the newest, whatever the last refresh caught
    if (!open) refresh();
    setOpen((o) => !o);
  };

  // Clicking elsewhere or pressing Escape closes the panel.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapper.current && !wrapper.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const label = unread > 0 ? t('notifications.bell_unread', { count: unread }) : t('notifications.title');

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={toggle}
        className={`${iconButton} relative ${className}`}
        aria-label={label}
        aria-expanded={open}
        title={t('notifications.title')}
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-strong px-1 font-mono text-[10px] font-medium tabular-nums text-accent-ink"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <section
          aria-label={t('notifications.title')}
          className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-paper shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-display text-base font-bold text-ink">{t('notifications.title')}</h2>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="text-sm font-medium text-accent-strong underline-offset-4 hover:underline">
                {t('notifications.read_all')}
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">{t('notifications.empty')}</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
              {items.map((n) => {
                const d = describe(n, t, isThai, i18n.language);
                return (
                  <li key={n.id} className="relative">
                    <Link
                      to={d.to}
                      onClick={() => {
                        markRead(n);
                        setOpen(false);
                      }}
                      className={`flex gap-3 px-4 py-3 hover:bg-sunken ${n.read_at ? '' : 'bg-accent-strong/5'}`}
                    >
                      <span
                        aria-hidden
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? 'bg-transparent' : 'bg-accent-strong'}`}
                      />
                      <span className="min-w-0">
                        <span className={`block text-sm ${n.read_at ? 'text-ink' : 'font-semibold text-ink'}`}>{d.title}</span>
                        {d.body && <span className="block text-sm text-muted">{d.body}</span>}
                        <span className="block font-mono text-xs tabular-nums text-muted">{localDateTime(n.created_at, i18n.language)}</span>
                      </span>
                    </Link>
                    {n.type === 'shipping' && n.data.tracking_number && <CopyTracking tracking={n.data.tracking_number} />}
                  </li>
                );
              })}
              {hasMore && (
                <li className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="text-sm font-medium text-accent-strong underline-offset-4 hover:underline disabled:opacity-60"
                  >
                    {t('notifications.load_more')}
                  </button>
                </li>
              )}
            </ul>
          )}
        </section>
      )}
    </div>
  );
};

export default NotificationBell;
