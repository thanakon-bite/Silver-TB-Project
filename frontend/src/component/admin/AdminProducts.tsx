import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Edit2, Upload, X, Minus, Search, ArrowLeft, ArrowRight } from 'lucide-react';
import Swal from 'sweetalert2';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabaseClient';
import { baht, uuidv4 } from '../../lib/format';
import { BEETLE_SEXES, BEETLE_STAGES, PRODUCT_CATEGORIES, type BeetleAttributes, type Product, type ProductCategory } from '../../lib/types';
import Modal from '../common/Modal';
import Pager, { PAGE_SIZE } from './Pager';

const BUCKET = 'product-images';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DEFAULT_FAMILIES = ['Rhinoceros', 'Stag', 'Flower'];
export const CATEGORY_LABELS: Record<ProductCategory, string> = { beetle: 'Beetle', food: 'Food', log: 'Logs & substrate', gear: 'Gear' };

type Attrs = { family: string; species: string; locality: string; sex: string; stage: string; size_mm: string };
const emptyAttrs = (): Attrs => ({ family: '', species: '', locality: '', sex: '', stage: '', size_mm: '' });

type Form = {
  name: string;
  name_th: string;
  description: string;
  description_th: string;
  price: string;
  stock: string;
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
  stock: '0',
  category: 'beetle',
  attrs: emptyAttrs(),
  images: [],
  is_best_seller: false,
  is_active: true,
});

type ActiveFilter = '' | 'true' | 'false';

/** On/off for one product: on means shoppers can see and buy it. */
const ActiveSwitch: React.FC<{ product: Product; onToggle: (p: Product) => void }> = ({ product, onToggle }) => (
  <button
    type="button"
    role="switch"
    aria-checked={product.is_active}
    aria-label={`Show ${product.name} in the shop`}
    onClick={() => onToggle(product)}
    className="inline-flex items-center gap-2 text-xs font-semibold"
  >
    <span
      aria-hidden
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors motion-reduce:transition-none ${product.is_active ? 'bg-success' : 'bg-line'}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-paper shadow transition-transform motion-reduce:transition-none ${
          product.is_active ? 'translate-x-[1.125rem]' : 'translate-x-0.5'
        }`}
      />
    </span>
    <span className={product.is_active ? 'text-success' : 'text-muted'}>{product.is_active ? 'Active' : 'Inactive'}</span>
  </button>
);

const AdminProducts: React.FC<{ initialFilter?: string }> = ({ initialFilter }) => {
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
      Swal.fire('Error', err.message, 'error');
    }
  }, [page, search, lowOnly, active]);

  useEffect(() => {
    const t = setTimeout(fetchProducts, 250);
    return () => clearTimeout(t);
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
            stock: String(p.stock),
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
    if (bad) return Swal.fire('Invalid image', 'Use JPG, PNG or WebP files up to 5 MB.', 'error');
    if (form.images.length + list.length > 10) return Swal.fire('Too many images', 'A product can have up to 10 images.', 'error');

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
      Swal.fire('Upload failed', err.message, 'error');
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
      if (editing === 'new') await api.post('/products', { ...payload, stock: Number(form.stock) });
      else if (editing) await api.patch(`/products/${editing.id}`, payload);
      setEditing(null);
      fetchProducts();
      Swal.fire({ icon: 'success', title: 'Saved', timer: 900, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const adjustStock = async (p: Product, sign: 1 | -1) => {
    const { value } = await Swal.fire({
      title: `${sign > 0 ? 'Add' : 'Remove'} stock — ${p.name}`,
      text: `Current stock: ${p.stock}`,
      input: 'number',
      inputValue: 1,
      inputAttributes: { min: '1', step: '1' },
      showCancelButton: true,
    });
    const n = Number(value);
    if (!value || !Number.isInteger(n) || n <= 0) return;
    try {
      const updated = await api.post<Product>(`/products/${p.id}/stock`, { delta: sign * n });
      setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, stock: updated.stock } : x)));
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
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
      Swal.fire('Error', err.message, 'error');
    }
  };

  const input = 'w-full border border-line rounded-lg px-3 py-2 focus:ring-2 focus:ring-accent-strong/40 outline-none';

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 justify-between mb-4">
        <div className="flex flex-wrap gap-3 items-center flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="Search products" aria-label="Search products" className={`${input} pl-9`} />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted whitespace-nowrap">
            <input type="checkbox" className="accent-accent-strong" checked={lowOnly} onChange={(e) => { setPage(1); setLowOnly(e.target.checked); }} />
            Low stock only
          </label>
          <label htmlFor="product-status" className="text-sm text-muted">Status</label>
          <select
            id="product-status"
            value={active}
            onChange={(e) => {
              setPage(1);
              setActive(e.target.value as ActiveFilter);
            }}
            className="border border-line rounded-lg px-3 py-2 text-sm bg-paper outline-none focus:ring-2 focus:ring-accent-strong/40"
          >
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        <button onClick={() => open('new')} className="flex items-center justify-center gap-2 px-4 py-2 bg-accent-strong text-accent-ink font-bold rounded-lg hover:opacity-90">
          <Plus className="w-4 h-4" /> Add product
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-sunken text-muted">
              <th className="p-3 font-semibold">Product</th>
              <th className="p-3 font-semibold">Category</th>
              <th className="p-3 font-semibold text-right">Price</th>
              <th className="p-3 font-semibold text-center">Stock</th>
              <th className="p-3 font-semibold">Status</th>
              <th className="p-3 font-semibold">Actions</th>
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
                      {p.is_best_seller && <div className="text-xs text-accent-strong">Best seller</div>}
                    </div>
                  </div>
                </td>
                <td className="p-3 text-muted">
                  {CATEGORY_LABELS[p.category] || p.category}
                  {p.attributes?.family && <div className="text-xs text-muted">{p.attributes.family}</div>}
                </td>
                <td className="p-3 text-ink text-right">{baht(p.price)}</td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-1">
                    <button aria-label="Remove stock" onClick={() => adjustStock(p, -1)} className="p-1 rounded border border-line hover:border-accent-strong" disabled={p.stock === 0}>
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className={`w-10 text-center font-semibold ${p.stock === 0 ? 'text-danger' : p.stock <= 2 ? 'text-accent-strong' : 'text-ink'}`}>{p.stock}</span>
                    <button aria-label="Add stock" onClick={() => adjustStock(p, 1)} className="p-1 rounded border border-line hover:border-accent-strong">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </td>
                <td className="p-3">
                  <ActiveSwitch product={p} onToggle={toggleActive} />
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button aria-label={`Edit ${p.name}`} onClick={() => open(p)} className="p-2 text-ink hover:bg-sunken rounded-lg">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted">No products found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pager page={page} total={total} onPage={setPage} />

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add product' : 'Edit product'} maxWidth="2xl">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1 text-ink">Name</label>
              <input required maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1 text-ink">Name (Thai)</label>
              <input maxLength={200} value={form.name_th} onChange={(e) => setForm({ ...form, name_th: e.target.value })} className={input} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1 text-ink">Description</label>
              <textarea maxLength={5000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${input} min-h-[100px]`} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1 text-ink">Description (Thai)</label>
              <textarea maxLength={5000} value={form.description_th} onChange={(e) => setForm({ ...form, description_th: e.target.value })} className={`${input} min-h-[80px]`} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-ink">Price (฿)</label>
              <input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={input} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-ink">{editing === 'new' ? 'Initial stock' : 'Stock'}</label>
              {editing === 'new' ? (
                <input required type="number" min="0" step="1" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className={input} />
              ) : (
                <p className="py-2 text-sm text-muted">{form.stock} — adjust with +/− in the table</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-ink">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ProductCategory })} className={input}>
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-4 mt-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-ink">
                <input type="checkbox" checked={form.is_best_seller} onChange={(e) => setForm({ ...form, is_best_seller: e.target.checked })} className="accent-accent-strong w-4 h-4" />
                Best seller
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-ink">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-accent-strong w-4 h-4" />
                Available in shop
              </label>
            </div>
          </div>

          {form.category === 'beetle' && (
            <fieldset className="grid grid-cols-2 gap-4 rounded-xl border border-line p-4">
              <legend className="px-1 text-sm font-semibold text-ink">Beetle details</legend>
              <div>
                <label className="block text-sm font-medium mb-1 text-ink">Family</label>
                <input list="beetle-families" maxLength={50} value={form.attrs.family} onChange={(e) => setAttr('family', e.target.value)} className={input} />
                <datalist id="beetle-families">
                  {families.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-ink">Species</label>
                <input maxLength={120} value={form.attrs.species} onChange={(e) => setAttr('species', e.target.value)} placeholder="Dynastes hercules" className={input} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-ink">Locality</label>
                <input maxLength={120} value={form.attrs.locality} onChange={(e) => setAttr('locality', e.target.value)} className={input} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-ink">Size (mm)</label>
                <input type="number" min="0.1" max="300" step="0.1" value={form.attrs.size_mm} onChange={(e) => setAttr('size_mm', e.target.value)} className={input} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-ink">Sex</label>
                <select value={form.attrs.sex} onChange={(e) => setAttr('sex', e.target.value)} className={input}>
                  <option value="">—</option>
                  {BEETLE_SEXES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-ink">Stage</label>
                <select value={form.attrs.stage} onChange={(e) => setAttr('stage', e.target.value)} className={input}>
                  <option value="">—</option>
                  {BEETLE_STAGES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </fieldset>
          )}

          <div>
            <label className="block text-sm font-medium mb-2 text-ink">Images (first image is the cover)</label>
            <div className="flex flex-wrap gap-3">
              {form.images.map((url, i) => (
                <div key={url} className="relative w-24 h-24 rounded-lg overflow-hidden border border-line group">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                    <button type="button" aria-label="Move left" onClick={() => moveImage(i, -1)} className="p-1 text-white"><ArrowLeft className="w-3 h-3" /></button>
                    <button type="button" aria-label="Remove image" onClick={() => setForm((f) => ({ ...f, images: f.images.filter((u) => u !== url) }))} className="p-1 text-white"><X className="w-3 h-3" /></button>
                    <button type="button" aria-label="Move right" onClick={() => moveImage(i, 1)} className="p-1 text-white"><ArrowRight className="w-3 h-3" /></button>
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
                <span className="text-xs mt-1">{uploading ? 'Uploading…' : 'Upload'}</span>
              </button>
              <input ref={fileInput} type="file" accept={IMAGE_TYPES.join(',')} multiple hidden onChange={(e) => uploadImages(e.target.files)} />
            </div>
            <p className="text-xs text-muted mt-2">JPG, PNG or WebP · up to 5 MB each · max 10 images</p>
          </div>

          <button type="submit" disabled={saving || uploading} className="w-full mt-2 py-3 bg-accent-strong text-accent-ink font-bold rounded-xl hover:opacity-90 disabled:opacity-50">
            {saving ? 'Saving…' : editing === 'new' ? 'Create product' : 'Save changes'}
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default AdminProducts;
