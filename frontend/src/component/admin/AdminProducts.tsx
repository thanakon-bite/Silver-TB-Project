import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Edit2, Upload, X, Minus, Search, Star, ArrowLeft, ArrowRight } from 'lucide-react';
import Swal from 'sweetalert2';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabaseClient';
import { baht, uuidv4 } from '../../lib/format';
import { BEETLE_SEXES, BEETLE_STAGES, PRODUCT_CATEGORIES, type BeetleAttributes, type Product, type ProductCategory } from '../../lib/types';
import Modal from '../common/Modal';
import { showAdminError } from './adminError';
import Pager, { PAGE_SIZE } from './Pager';

const BUCKET = 'product-images';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DEFAULT_FAMILIES = ['Rhinoceros', 'Stag', 'Flower'];

type Attrs = { family: string; species: string; locality: string; sex: string; stage: string; size_mm: string };
const emptyAttrs = (): Attrs => ({ family: '', species: '', locality: '', sex: '', stage: '', size_mm: '' });

type Form = {
  name: string;
  name_th: string;
  description: string;
  description_th: string;
  price: string;
  on_hand: string;
  category: ProductCategory;
  attrs: Attrs;
  images: string[];
  is_best_seller: boolean;
  is_active: boolean;
};

const emptyForm = (): Form => ({
  name: '',
  name_th: '',
  description: '',
  description_th: '',
  price: '',
  on_hand: '0',
  category: 'beetle',
  attrs: emptyAttrs(),
  images: [],
  is_best_seller: false,
  is_active: true,
});

type ActiveFilter = '' | 'true' | 'false';

/** On/off for one product: on means shoppers can see and buy it. */
const ActiveSwitch: React.FC<{ product: Product; onToggle: (p: Product) => void }> = ({ product, onToggle }) => {
  const { t } = useTranslation();
  return (
  <button
    type="button"
    role="switch"
    aria-checked={product.is_active}
    aria-label={t('admin.products.show_in_shop', { name: product.name })}
    onClick={() => onToggle(product)}
    className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold"
  >
    {/* Track 36px, knob 16px with 2px inset: off sits at 2px, on at 18px, so the knob never leaves the track. */}
    <span
      aria-hidden
      className={`relative inline-block h-5 w-9 shrink-0 overflow-hidden rounded-full transition-colors motion-reduce:transition-none ${product.is_active ? 'bg-success' : 'bg-line'}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-paper shadow transition-transform motion-reduce:transition-none ${
          product.is_active ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </span>
    <span className={`w-14 ${product.is_active ? 'text-success' : 'text-muted'}`}>{product.is_active ? t('admin.products.active') : t('admin.products.inactive')}</span>
  </button>
  );
};

const AdminProducts: React.FC<{ initialFilter?: string }> = ({ initialFilter }) => {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(initialFilter === 'low');
  const [active, setActive] = useState<ActiveFilter>('');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [form, setForm] = useState<Form>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const fetchProducts = useCallback(async () => {
    const q = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (search) q.set('search', search);
    if (lowOnly) q.set('low_stock', 'true');
    if (active) q.set('active', active);
    try {
      const data = await api.get<{ products: Product[]; total: number }>(`/products/admin/all?${q}`);
      setProducts(data.products || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      showAdminError(err, t);
    }
  }, [page, search, lowOnly, active, t]);

  useEffect(() => {
    const timer = setTimeout(fetchProducts, 250);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  const families = Array.from(new Set([...DEFAULT_FAMILIES, ...products.map((p) => p.attributes?.family).filter(Boolean) as string[]]));
  const setAttr = (key: keyof Attrs, value: string) => setForm((f) => ({ ...f, attrs: { ...f.attrs, [key]: value } }));

  const open = (p: Product | 'new') => {
    setEditing(p);
    setForm(
      p === 'new'
        ? emptyForm()
        : {
            name: p.name,
            name_th: p.name_th || '',
            description: p.description || '',
            description_th: p.description_th || '',
            price: String(p.price),
            on_hand: String(p.on_hand ?? 0),
            category: p.category,
            attrs: {
              family: p.attributes?.family || '',
              species: p.attributes?.species || '',
              locality: p.attributes?.locality || '',
              sex: p.attributes?.sex || '',
              stage: p.attributes?.stage || '',
              size_mm: p.attributes?.size_mm ? String(p.attributes.size_mm) : '',
            },
            images: p.images || [],
            is_best_seller: p.is_best_seller,
            is_active: p.is_active,
          }
    );
  };

  const uploadImages = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    const bad = list.find((f) => !IMAGE_TYPES.includes(f.type) || f.size > MAX_IMAGE_BYTES);
    if (bad) return Swal.fire(t('admin.products.invalid_image'), t('admin.products.image_rules'), 'error');
    if (form.images.length + list.length > 10) return Swal.fire(t('admin.products.too_many'), t('admin.products.too_many_text'), 'error');

    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of list) {
        const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `products/${uuidv4()}.${ext}`;
        // RLS on storage.objects only lets admins write to this bucket
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000' });
        if (error) throw error;
        urls.push(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
      }
      setForm((f) => ({ ...f, images: [...f.images, ...urls] }));
    } catch (err: any) {
      Swal.fire(t('admin.products.upload_failed'), err.message, 'error');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const moveImage = (i: number, dir: -1 | 1) =>
    setForm((f) => {
      const imgs = [...f.images];
      const j = i + dir;
      if (j < 0 || j >= imgs.length) return f;
      [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
      return { ...f, images: imgs };
    });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    // Beetle Attributes only apply to beetles; empty fields are left out
    const attributes: BeetleAttributes =
      form.category === 'beetle'
        ? (Object.fromEntries(
            Object.entries(form.attrs)
              .filter(([, val]) => val.trim() !== '')
              .map(([k, val]) => [k, k === 'size_mm' ? Number(val) : val.trim()])
          ) as BeetleAttributes)
        : {};
    const payload = {
      name: form.name,
      name_th: form.name_th,
      description: form.description,
      description_th: form.description_th,
      price: Number(form.price),
      category: form.category,
      attributes,
      images: form.images,
      is_best_seller: form.is_best_seller,
      is_active: form.is_active,
    };
    try {
      if (editing === 'new') await api.post('/products', { ...payload, on_hand: Number(form.on_hand) });
      else if (editing) await api.patch(`/products/${editing.id}`, payload);
      setEditing(null);
      fetchProducts();
      Swal.fire({ icon: 'success', title: t('admin.common.saved'), timer: 900, showConfirmButton: false });
    } catch (err: any) {
      showAdminError(err, t);
    } finally {
      setSaving(false);
    }
  };

  const adjustStock = async (p: Product, sign: 1 | -1) => {
    const { value } = await Swal.fire({
      title: `${sign > 0 ? t('admin.products.receive') : t('admin.products.correct')} — ${p.name}`,
      text: t('admin.products.adjust_text', { on_hand: p.on_hand ?? 0, available: p.available }),
      input: 'number',
      inputValue: 1,
      inputAttributes: { min: '1', step: '1' },
      showCancelButton: true,
    });
    const n = Number(value);
    if (!value || !Number.isInteger(n) || n <= 0) return;
    try {
      const updated = await api.post<Product>(`/products/${p.id}/stock`, { delta: sign * n });
      setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, on_hand: updated.on_hand, available: updated.available } : x)));
    } catch (err: any) {
      showAdminError(err, t);
    }
  };

  // Saves at once; the row flips back if the server refuses, so the list never lies about what shoppers see.
  const toggleActive = async (p: Product) => {
    const is_active = !p.is_active;
    const flip = (value: boolean) => setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, is_active: value } : x)));
    flip(is_active);
    try {
      await api.patch(`/products/${p.id}`, { is_active });
    } catch (err: any) {
      flip(!is_active);
      showAdminError(err, t);
    }
  };

  // Same as the switch: saves at once, flips back if the server refuses.
  const toggleBestSeller = async (p: Product) => {
    const is_best_seller = !p.is_best_seller;
    const flip = (value: boolean) => setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, is_best_seller: value } : x)));
    flip(is_best_seller);
    try {
      await api.patch(`/products/${p.id}`, { is_best_seller });
    } catch (err: any) {
      flip(!is_best_seller);
      showAdminError(err, t);
    }
  };

  const input = 'w-full border border-line rounded-lg px-3 py-2 focus:ring-2 focus:ring-accent-strong/40 outline-none';

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 justify-between mb-4">
        <div className="flex flex-wrap gap-3 items-center flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder={t('admin.products.search')} aria-label={t('admin.products.search')} className={`${input} pl-9`} />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted whitespace-nowrap">
            <input type="checkbox" className="accent-accent-strong" checked={lowOnly} onChange={(e) => { setPage(1); setLowOnly(e.target.checked); }} />
            {t('admin.products.low_only')}
          </label>
          <label htmlFor="product-status" className="text-sm text-muted">{t('admin.common.status')}</label>
          <select
            id="product-status"
            value={active}
            onChange={(e) => {
              setPage(1);
              setActive(e.target.value as ActiveFilter);
            }}
            className="border border-line rounded-lg px-3 py-2 text-sm bg-paper outline-none focus:ring-2 focus:ring-accent-strong/40"
          >
            <option value="">{t('admin.common.all_statuses')}</option>
            <option value="true">{t('admin.products.active')}</option>
            <option value="false">{t('admin.products.inactive')}</option>
          </select>
        </div>
        <button onClick={() => open('new')} className="flex items-center justify-center gap-2 px-4 py-2 bg-accent-strong text-accent-ink font-bold rounded-lg hover:opacity-90">
          <Plus className="w-4 h-4" /> {t('admin.products.add')}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-sunken text-muted">
              <th className="p-3 font-semibold">{t('admin.common.product')}</th>
              <th className="p-3 font-semibold">{t('category')}</th>
              <th className="p-3 font-semibold text-right">{t('admin.products.price')}</th>
              <th className="p-3 font-semibold text-center" title={t('admin.products.on_hand_hint')}>Onhand</th>
              <th className="p-3 font-semibold text-center" title={t('admin.products.available_hint')}>Stockmove</th>
              <th className="p-3 font-semibold text-center" title={t('admin.products.in_transit_hint')}>{t('admin.products.in_transit')}</th>
              <th className="p-3 font-semibold">{t('admin.common.status')}</th>
              <th className="p-3 font-semibold">{t('admin.common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-line hover:bg-sunken">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-sunken overflow-hidden flex items-center justify-center shrink-0">
                      {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" /> : '🪲'}
                    </div>
                    <div>
                      <div className="font-semibold text-ink">{p.name}</div>

                    </div>
                  </div>
                </td>
                <td className="p-3 text-muted">
                  {t(p.category)}
                  {p.attributes?.family && <div className="text-xs text-muted">{p.attributes.family}</div>}
                </td>
                <td className="p-3 text-ink text-right">{baht(p.price)}</td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-1">
                    <button aria-label={t('admin.products.correct')} onClick={() => adjustStock(p, -1)} className="p-1 rounded border border-line hover:border-accent-strong" disabled={p.available === 0}>
                      <Minus className="w-3 h-3" />
                    </button>
                    <span aria-label="Onhand" className="w-10 text-center font-semibold font-mono tabular-nums text-ink">{p.on_hand ?? 0}</span>
                    <button aria-label={t('admin.products.receive')} onClick={() => adjustStock(p, 1)} className="p-1 rounded border border-line hover:border-accent-strong">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </td>
                <td className="p-3 text-center">
                  <span aria-label="Stockmove" className={`font-semibold font-mono tabular-nums ${p.available === 0 ? 'text-danger' : p.available <= 2 ? 'text-accent-strong' : 'text-ink'}`}>{p.available}</span>
                </td>
                <td className="p-3 text-center">
                  <span aria-label={t('admin.products.in_transit')} className="font-mono tabular-nums text-muted">{p.in_transit ?? 0}</span>
                </td>
                <td className="p-3 whitespace-nowrap">
                  <ActiveSwitch product={p} onToggle={toggleActive} />
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      aria-label={t('admin.products.best_seller_for', { name: p.name })}
                      aria-pressed={!!p.is_best_seller}
                      title={p.is_best_seller ? t('best_seller') : t('admin.products.mark_best_seller')}
                      onClick={() => toggleBestSeller(p)}
                      className="p-2 rounded-lg hover:bg-sunken"
                    >
                      <Star className={`w-4 h-4 ${p.is_best_seller ? 'fill-accent-strong text-accent-strong' : 'text-muted'}`} />
                    </button>
                    <button aria-label={t('admin.products.edit_named', { name: p.name })} onClick={() => open(p)} className="p-2 text-ink hover:bg-sunken rounded-lg">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted">{t('admin.products.none')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pager page={page} total={total} onPage={setPage} />

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? t('admin.products.add') : t('admin.products.edit')} maxWidth="2xl">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1 text-ink">{t('admin.products.name_en')}</label>
              <input required maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1 text-ink">{t('admin.products.name_th')}</label>
              <input maxLength={200} value={form.name_th} onChange={(e) => setForm({ ...form, name_th: e.target.value })} className={input} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1 text-ink">{t('admin.products.desc_en')}</label>
              <textarea maxLength={5000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${input} min-h-[100px]`} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1 text-ink">{t('admin.products.desc_th')}</label>
              <textarea maxLength={5000} value={form.description_th} onChange={(e) => setForm({ ...form, description_th: e.target.value })} className={`${input} min-h-[80px]`} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-ink">{t('admin.products.price_baht')}</label>
              <input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={input} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-ink">{editing === 'new' ? t('admin.products.initial_on_hand') : 'Onhand'}</label>
              {editing === 'new' ? (
                <input required type="number" min="0" step="1" value={form.on_hand} onChange={(e) => setForm({ ...form, on_hand: e.target.value })} className={input} />
              ) : (
                <p className="py-2 text-sm text-muted">{t('admin.products.on_hand_note', { n: form.on_hand })}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-ink">{t('category')}</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ProductCategory })} className={input}>
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{t(c)}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-4 mt-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-ink">
                <input type="checkbox" checked={form.is_best_seller} onChange={(e) => setForm({ ...form, is_best_seller: e.target.checked })} className="accent-accent-strong w-4 h-4" />
                {t('best_seller')}
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-ink">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-accent-strong w-4 h-4" />
                {t('admin.products.in_shop')}
              </label>
            </div>
          </div>

          {form.category === 'beetle' && (
            <fieldset className="grid grid-cols-2 gap-4 rounded-xl border border-line p-4">
              <legend className="px-1 text-sm font-semibold text-ink">{t('admin.products.beetle_details')}</legend>
              <div>
                <label className="block text-sm font-medium mb-1 text-ink">{t('products_page.family')}</label>
                <input list="beetle-families" maxLength={50} value={form.attrs.family} onChange={(e) => setAttr('family', e.target.value)} className={input} />
                <datalist id="beetle-families">
                  {families.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-ink">{t('species')}</label>
                <input maxLength={120} value={form.attrs.species} onChange={(e) => setAttr('species', e.target.value)} placeholder="Dynastes hercules" className={input} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-ink">{t('locality')}</label>
                <input maxLength={120} value={form.attrs.locality} onChange={(e) => setAttr('locality', e.target.value)} className={input} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-ink">{t('size')} (mm)</label>
                <input type="number" min="0.1" max="300" step="0.1" value={form.attrs.size_mm} onChange={(e) => setAttr('size_mm', e.target.value)} className={input} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-ink">{t('sex')}</label>
                <select value={form.attrs.sex} onChange={(e) => setAttr('sex', e.target.value)} className={input}>
                  <option value="">—</option>
                  {BEETLE_SEXES.map((s) => (
                    <option key={s} value={s}>{t(`sex_${s}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-ink">{t('stage')}</label>
                <select value={form.attrs.stage} onChange={(e) => setAttr('stage', e.target.value)} className={input}>
                  <option value="">—</option>
                  {BEETLE_STAGES.map((s) => (
                    <option key={s} value={s}>{t(`stage_${s}`)}</option>
                  ))}
                </select>
              </div>
            </fieldset>
          )}

          <div>
            <label className="block text-sm font-medium mb-2 text-ink">{t('admin.products.images')}</label>
            <div className="flex flex-wrap gap-3">
              {form.images.map((url, i) => (
                <div key={url} className="relative w-24 h-24 rounded-lg overflow-hidden border border-line group">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 flex justify-between bg-scrim/60 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                    <button type="button" aria-label={t('admin.products.move_left')} onClick={() => moveImage(i, -1)} className="p-1 text-on-scrim"><ArrowLeft className="w-3 h-3" /></button>
                    <button type="button" aria-label={t('admin.products.remove_image')} onClick={() => setForm((f) => ({ ...f, images: f.images.filter((u) => u !== url) }))} className="p-1 text-on-scrim"><X className="w-3 h-3" /></button>
                    <button type="button" aria-label={t('admin.products.move_right')} onClick={() => moveImage(i, 1)} className="p-1 text-on-scrim"><ArrowRight className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploading || form.images.length >= 10}
                className="w-24 h-24 rounded-lg border-2 border-dashed border-line flex flex-col items-center justify-center text-muted hover:border-accent-strong hover:text-accent-strong disabled:opacity-50"
              >
                <Upload className="w-5 h-5" />
                <span className="text-xs mt-1">{uploading ? t('admin.products.uploading') : t('admin.products.upload')}</span>
              </button>
              <input ref={fileInput} type="file" accept={IMAGE_TYPES.join(',')} multiple hidden onChange={(e) => uploadImages(e.target.files)} />
            </div>
            <p className="text-xs text-muted mt-2">{t('admin.products.image_hint')}</p>
          </div>

          <button type="submit" disabled={saving || uploading} className="w-full mt-2 py-3 bg-accent-strong text-accent-ink font-bold rounded-xl hover:opacity-90 disabled:opacity-50">
            {saving ? t('admin.common.saving') : editing === 'new' ? t('admin.products.create') : t('admin.products.save_changes')}
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default AdminProducts;
