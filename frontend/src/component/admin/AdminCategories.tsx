import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Swal from 'sweetalert2';
import { ArrowDown, ArrowUp, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useCatalogue, type Category, type Family } from '../../lib/catalogue';
import { showAdminError } from './adminError';
import { iconButton, primaryButtonInline } from '../ui/buttonStyles';

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const field = (id: string, label: string, value = '') =>
  `<label for="${id}" style="display:block;font-size:.875rem;margin-top:.5rem;text-align:left">${escape(label)}</label>` +
  `<input id="${id}" maxlength="60" value="${escape(value)}" class="swal2-input" style="margin:.25rem 0;width:100%" />`;
const read = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value.trim() || '';

/** Moves item i one place up (-1) or down (+1). */
const moved = <T,>(list: T[], i: number, by: -1 | 1) => {
  const next = [...list];
  [next[i], next[i + by]] = [next[i + by], next[i]];
  return next;
};

/**
 * The Admin's Categories (the shop's first filter) and beetle Families (its second), CONTEXT.md / ADR 0005.
 * The beetle Category can be renamed, never deleted; a Category or Family still used by a product cannot be deleted.
 */
const AdminCategories: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isThai = (i18n.language || 'th').startsWith('th');
  const { categories, families, reload } = useCatalogue();
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (err) {
      showAdminError(err, t);
    } finally {
      setBusy(false);
    }
  };

  const editCategory = async (c?: Category) => {
    const { value } = await Swal.fire<{ name_th: string; name_en: string }>({
      title: c ? t('admin.categories.rename_title') : t('admin.categories.add_title'),
      html: field('stb-cat-th', t('admin.categories.name_th'), c?.name_th) + field('stb-cat-en', t('admin.categories.name_en'), c?.name_en),
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: t('admin.common.save'),
      cancelButtonText: t('admin.common.cancel'),
      preConfirm: () => {
        const v = { name_th: read('stb-cat-th'), name_en: read('stb-cat-en') };
        if (!v.name_th || !v.name_en) {
          Swal.showValidationMessage(t('admin.categories.both_names'));
          return false;
        }
        return v;
      },
    });
    if (!value) return;
    await run(() => (c ? api.patch(`/categories/${c.slug}`, value) : api.post('/categories', value)));
  };

  const deleteCategory = async (c: Category) => {
    const ok = await Swal.fire({
      icon: 'warning',
      titleText: t('admin.categories.delete_title', { name: isThai ? c.name_th : c.name_en }),
      text: t('admin.categories.delete_text'),
      showCancelButton: true,
      confirmButtonText: t('admin.common.delete'),
      cancelButtonText: t('admin.common.cancel'),
    });
    if (ok.isConfirmed) await run(() => api.delete(`/categories/${c.slug}`));
  };

  const moveCategory = (i: number, by: -1 | 1) => run(() => api.post('/categories/reorder', { slugs: moved(categories, i, by).map((c) => c.slug) }));

  const editFamily = async (f?: Family) => {
    const { value } = await Swal.fire<string>({
      title: f ? t('admin.categories.family_rename_title') : t('admin.categories.family_add_title'),
      text: f ? t('admin.categories.family_rename_text') : undefined,
      input: 'text',
      inputValue: f?.name || '',
      inputAttributes: { maxlength: '60', 'aria-label': t('admin.categories.family_name') },
      showCancelButton: true,
      confirmButtonText: t('admin.common.save'),
      cancelButtonText: t('admin.common.cancel'),
      inputValidator: (v) => (!v.trim() ? t('admin.categories.family_needs_name') : null),
    });
    if (!value?.trim() || value.trim() === f?.name) return;
    await run(() => (f ? api.patch(`/categories/families/${f.id}`, { name: value.trim() }) : api.post('/categories/families', { name: value.trim() })));
  };

  const deleteFamily = async (f: Family) => {
    const ok = await Swal.fire({
      icon: 'warning',
      titleText: t('admin.categories.family_delete_title', { name: f.name }),
      text: t('admin.categories.family_delete_text'),
      showCancelButton: true,
      confirmButtonText: t('admin.common.delete'),
      cancelButtonText: t('admin.common.cancel'),
    });
    if (ok.isConfirmed) await run(() => api.delete(`/categories/families/${f.id}`));
  };

  const moveFamily = (i: number, by: -1 | 1) => run(() => api.post('/categories/families/reorder', { ids: moved(families, i, by).map((f) => f.id) }));

  const td = 'p-3 align-middle';
  const orderButtons = (i: number, count: number, move: (i: number, by: -1 | 1) => void, name: string) => (
    <>
      <button type="button" className={iconButton} disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={t('admin.categories.move_up', { name })}>
        <ArrowUp className="h-4 w-4" />
      </button>
      <button type="button" className={iconButton} disabled={busy || i === count - 1} onClick={() => move(i, 1)} aria-label={t('admin.categories.move_down', { name })}>
        <ArrowDown className="h-4 w-4" />
      </button>
    </>
  );

  return (
    <div className="space-y-10">
      <section aria-labelledby="cat-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="cat-heading" className="font-display text-xl font-bold text-ink">{t('admin.categories.heading')}</h2>
            <p className="text-sm text-muted">{t('admin.categories.note')}</p>
          </div>
          <button type="button" onClick={() => editCategory()} disabled={busy} className={primaryButtonInline}>
            <Plus className="h-4 w-4" aria-hidden /> {t('admin.categories.add')}
          </button>
        </div>
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-sunken text-muted">
              <th className="p-3 font-semibold">{t('admin.categories.name_th')}</th>
              <th className="p-3 font-semibold">{t('admin.categories.name_en')}</th>
              <th className="p-3 font-semibold">{t('admin.categories.slug')}</th>
              <th className="p-3 font-semibold">{t('admin.common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c, i) => (
              <tr key={c.slug} className="border-b border-line">
                <td className={`${td} text-ink`}>
                  {c.name_th}
                  {c.is_system && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs text-muted" title={t('admin.categories.system_hint')}>
                      <Lock className="h-3 w-3" aria-hidden /> {t('admin.categories.system')}
                    </span>
                  )}
                </td>
                <td className={`${td} text-ink`}>{c.name_en}</td>
                <td className={`${td} font-mono text-xs text-muted`}>{c.slug}</td>
                <td className={td}>
                  <div className="flex gap-1">
                    {orderButtons(i, categories.length, moveCategory, c.name_th)}
                    <button type="button" className={iconButton} disabled={busy} onClick={() => editCategory(c)} aria-label={t('admin.categories.rename', { name: c.name_th })}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    {!c.is_system && (
                      <button type="button" className={iconButton} disabled={busy} onClick={() => deleteCategory(c)} aria-label={t('admin.categories.delete', { name: c.name_th })}>
                        <Trash2 className="h-4 w-4 text-danger" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="family-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="family-heading" className="font-display text-xl font-bold text-ink">{t('admin.categories.families_heading')}</h2>
            <p className="text-sm text-muted">{t('admin.categories.families_note')}</p>
          </div>
          <button type="button" onClick={() => editFamily()} disabled={busy} className={primaryButtonInline}>
            <Plus className="h-4 w-4" aria-hidden /> {t('admin.categories.family_add')}
          </button>
        </div>
        {families.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">{t('admin.categories.no_families')}</p>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-sunken text-muted">
                <th className="p-3 font-semibold">{t('admin.categories.family_name')}</th>
                <th className="p-3 font-semibold">{t('admin.common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {families.map((f, i) => (
                <tr key={f.id} className="border-b border-line">
                  <td className={`${td} text-ink`}>{f.name}</td>
                  <td className={td}>
                    <div className="flex gap-1">
                      {orderButtons(i, families.length, moveFamily, f.name)}
                      <button type="button" className={iconButton} disabled={busy} onClick={() => editFamily(f)} aria-label={t('admin.categories.rename', { name: f.name })}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" className={iconButton} disabled={busy} onClick={() => deleteFamily(f)} aria-label={t('admin.categories.delete', { name: f.name })}>
                        <Trash2 className="h-4 w-4 text-danger" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default AdminCategories;
