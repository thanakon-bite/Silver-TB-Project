import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Send } from 'lucide-react';
import Swal from 'sweetalert2';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { baht, localDateTime } from '../../lib/format';
import { primaryButtonInline } from '../ui/buttonStyles';

interface LineStatus {
  configured: boolean;
  webhook_secret_set: boolean;
  source: 'env' | 'none';
  targets: string[];
}

interface PaymentEvent {
  id: string;
  type: string;
  result: string | null;
  amount: number | null;
  currency: string | null;
  created_at: string;
  orders: { order_number: string } | null;
}

const Check: React.FC<{ ok: boolean; children: React.ReactNode }> = ({ ok, children }) => (
  <li className="flex items-center gap-2">
    {ok ? <CheckCircle2 className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-danger" />}
    <span className={ok ? 'text-ink' : 'text-ink font-medium'}>{children}</span>
  </li>
);

const AdminSettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [line, setLine] = useState<LineStatus | null>(null);
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get<LineStatus>('/notifications/line/status').then(setLine).catch(() => setLine(null));
    api.get<PaymentEvent[]>('/admin/payments?limit=30').then(setEvents).catch(() => setEvents([]));
  }, []);

  const test = async () => {
    setSending(true);
    try {
      await api.post('/notifications/line/test', {});
      Swal.fire({ icon: 'success', title: t('admin.settings.test_sent'), text: t('admin.settings.check_line') });
    } catch (err: any) {
      Swal.fire(t('admin.settings.test_failed'), err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="rounded-2xl border border-line p-5 space-y-4">
        <h3 className="font-semibold text-ink">{t('admin.settings.line_title')}</h3>
        {!line ? (
          <p className="text-sm text-muted">{t('loading')}</p>
        ) : (
          <>
            <ul className="space-y-2 text-sm">
              <Check ok={line.configured}>{t('admin.settings.token_set')}</Check>
              <Check ok={line.webhook_secret_set}>{t('admin.settings.secret_set')}</Check>
              <Check ok={line.targets.length > 0}>
                {line.source === 'env' && t('admin.settings.sending_to', { targets: line.targets.join(', ') })}
                {line.source === 'none' && t('admin.settings.no_recipient')}
              </Check>
            </ul>
            {line.source === 'none' && (
              <p className="text-sm text-muted bg-sunken rounded-lg p-3">
                {t('admin.settings.how_to_set')} <code className="text-xs">LINE_OWNER_USER_ID</code>
              </p>
            )}
            <button
              onClick={test}
              disabled={sending || !line.configured || line.targets.length === 0}
              className={primaryButtonInline}
            >
              <Send className="w-4 h-4" /> {sending ? t('admin.settings.sending') : t('admin.settings.send_test')}
            </button>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-line p-5">
        <h3 className="font-semibold text-ink mb-3">{t('admin.settings.stripe_events')}</h3>
        {events.length === 0 ? (
          <p className="text-sm text-muted">{t('admin.settings.no_events')}</p>
        ) : (
          <ul className="divide-y divide-line text-sm max-h-96 overflow-y-auto">
            {events.map((e) => (
              <li key={e.id} className="py-2 flex justify-between gap-3">
                <div>
                  <div className="font-medium text-ink">{e.type}</div>
                  <div className="text-xs text-muted">
                    {localDateTime(e.created_at, i18n.language)} · {e.orders?.order_number || '—'} · {e.result}
                  </div>
                </div>
                {e.amount != null && <span className="text-ink">{baht(e.amount / 100)}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AdminSettings;
