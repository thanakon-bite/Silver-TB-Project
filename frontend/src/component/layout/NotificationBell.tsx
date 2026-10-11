import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Bell } from 'lucide-react';
import { api } from '../../lib/api';
import { cancelReasonText, localDateTime } from '../../lib/format';
import { iconButton } from '../ui/buttonStyles';

export interface AppNotification {
  id: string;
  type: 'awaiting_payment' | 'shipping' | 'confirm_request' | 'cancelled' | 'promotion';
  order_id: string | null;
  data: { order_number?: string; tracking_number?: string; carrier?: string; cancel_reason?: string; refunded?: boolean; name_th?: string; name_en?: string };
  read_at: string | null;
  created_at: string;
}

const POLL_MS = 60_000;

interface NotificationPage {
  notifications: AppNotification[];
  unread: number;
  has_more?: boolean;
}

/**
 * A signed-in Member's Notifications (CONTEXT.md), fetched once and then about every minute while
 * the tab is visible. Navbar owns one of these and hands it to each bell it draws.
 */
export function useNotifications(enabled: boolean) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Older pages the Member opened stay while the poll refreshes the newest page.
  const olderLoaded = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<NotificationPage>('/notifications');
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
    const timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, load]);

  const markRead = (n: AppNotification) => {
    if (n.read_at) return;
    setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    setUnread((u) => Math.max(0, u - 1));
    api.post(`/notifications/${n.id}/read`, {}).catch(() => {});
  };

  const markAllRead = () => {
    setItems((list) => list.map((x) => (x.read_at ? x : { ...x, read_at: new Date().toISOString() })));
    setUnread(0);
    api.post('/notifications/read-all', {}).catch(() => {});
  };

  return { items, unread, hasMore, loadingMore, loadMore, markRead, markAllRead };
}

export type NotificationsState = ReturnType<typeof useNotifications>;

/** Title and detail line for one Notification, in the reader's language. */
function describe(n: AppNotification, t: TFunction, isThai: boolean): { title: string; body?: string; to: string } {
  const number = n.data.order_number || '';
  const toOrder = n.order_id ? `/orders/${n.order_id}` : '/orders';
  switch (n.type) {
    case 'awaiting_payment':
      return { title: t('notifications.awaiting_payment', { number }), body: t('notifications.awaiting_payment_body'), to: toOrder };
    case 'shipping':
      return {
        title: t('notifications.shipping', { number }),
        body: n.data.tracking_number ? t('notifications.shipping_body', { tracking: n.data.tracking_number }) : undefined,
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
    case 'promotion': {
      const name = (isThai ? n.data.name_th : n.data.name_en || n.data.name_th) || '';
      return { title: t('notifications.promotion', { name }), body: t('notifications.promotion_body'), to: '/' };
    }
    default:
      return { title: '', to: '/' };
  }
}

const NotificationBell: React.FC<{ state: NotificationsState; className?: string }> = ({ state, className = '' }) => {
  const { t, i18n } = useTranslation();
  const isThai = (i18n.language || 'th').startsWith('th');
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const { items, unread, hasMore, loadingMore, loadMore, markRead, markAllRead } = state;

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
        onClick={() => setOpen((o) => !o)}
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
                const d = describe(n, t, isThai);
                return (
                  <li key={n.id}>
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
