import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { GeoOption } from '../../lib/types';
import { fieldClass, fieldError, fieldLabel } from './fieldStyles';

export interface ThaiAddressValue {
  province_id: number | null;
  district_id: number | null;
  subdistrict_id: number | null;
  postal_code: string;
}

interface Props {
  value: ThaiAddressValue;
  onChange: (value: ThaiAddressValue) => void;
  errors?: Partial<Record<'subdistrict_id' | 'postal_code', string>>;
}

interface PostalMatch {
  subdistrict_id: number;
  subdistrict: string;
  district_id: number;
  district: string;
  province_id: number;
  province: string;
  default_postal_code: string;
}

// Module-level cache: geography never changes during a session
const cache = new Map<string, GeoOption[]>();
async function load(path: string): Promise<GeoOption[]> {
  if (!cache.has(path)) cache.set(path, await api.get<GeoOption[]>(path));
  return cache.get(path)!;
}

const selectClass = fieldClass;

/**
 * Cascading Province (จังหวัด) → District (อำเภอ/เขต) → Subdistrict (ตำบล/แขวง) selects.
 * Choosing a subdistrict auto-fills the postal code. Typing a postal code first offers matching
 * subdistricts and fills in the three dropdowns.
 */
const ThaiAddressPicker: React.FC<Props> = ({ value, onChange, errors = {} }) => {
  const { t } = useTranslation();
  const [provinces, setProvinces] = useState<GeoOption[]>([]);
  const [districts, setDistricts] = useState<GeoOption[]>([]);
  const [subdistricts, setSubdistricts] = useState<GeoOption[]>([]);
  const [postalMatches, setPostalMatches] = useState<PostalMatch[]>([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    load('/geo/provinces')
      .then(setProvinces)
      .catch(() => setLoadError('address_form.provinces_error'));
  }, []);

  useEffect(() => {
    if (!value.province_id) return setDistricts([]);
    load(`/geo/provinces/${value.province_id}/districts`).then(setDistricts).catch(() => setDistricts([]));
  }, [value.province_id]);

  useEffect(() => {
    if (!value.district_id) return setSubdistricts([]);
    load(`/geo/districts/${value.district_id}/subdistricts`).then(setSubdistricts).catch(() => setSubdistricts([]));
  }, [value.district_id]);

  const handlePostal = async (code: string) => {
    const digits = code.replace(/\D/g, '').slice(0, 5);
    onChange({ ...value, postal_code: digits });
    setPostalMatches([]);
    if (digits.length === 5 && !value.subdistrict_id) {
      try {
        const matches = await api.get<PostalMatch[]>(`/geo/postal/${digits}`);
        if (matches.length === 1) applyMatch(matches[0], digits);
        else setPostalMatches(matches);
      } catch {
        /* lookup is a convenience only */
      }
    }
  };

  const applyMatch = (m: PostalMatch, postal?: string) => {
    onChange({
      province_id: m.province_id,
      district_id: m.district_id,
      subdistrict_id: m.subdistrict_id,
      postal_code: postal || m.default_postal_code,
    });
    setPostalMatches([]);
  };

  const label = fieldLabel;

  return (
    <div className="space-y-3">
      {loadError && <p className="text-sm text-danger">{t(loadError)}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="addr-province">{t('address_form.province')}</label>
          <select
            id="addr-province"
            className={selectClass()}
            value={value.province_id ?? ''}
            onChange={(e) =>
              onChange({ province_id: Number(e.target.value) || null, district_id: null, subdistrict_id: null, postal_code: '' })
            }
          >
            <option value="">{t('address_form.choose_province')}</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name_th} ({p.name_en})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="addr-district">{t('address_form.district')}</label>
          <select
            id="addr-district"
            className={selectClass()}
            disabled={!value.province_id}
            value={value.district_id ?? ''}
            onChange={(e) => onChange({ ...value, district_id: Number(e.target.value) || null, subdistrict_id: null, postal_code: '' })}
          >
            <option value="">{t('address_form.choose_district')}</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name_th}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="addr-subdistrict">{t('address_form.subdistrict')}</label>
          <select
            id="addr-subdistrict"
            className={selectClass(errors.subdistrict_id)}
            disabled={!value.district_id}
            value={value.subdistrict_id ?? ''}
            onChange={(e) => {
              const id = Number(e.target.value) || null;
              const sub = subdistricts.find((s) => s.id === id);
              onChange({ ...value, subdistrict_id: id, postal_code: sub?.postal_code || '' });
            }}
          >
            <option value="">{t('address_form.choose_subdistrict')}</option>
            {subdistricts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name_th}
              </option>
            ))}
          </select>
          {errors.subdistrict_id && <p role="alert" className={fieldError}>{t(errors.subdistrict_id)}</p>}
        </div>

        <div>
          <label className={label} htmlFor="addr-postal">{t('address_form.postal_code')}</label>
          <input
            id="addr-postal"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            placeholder="10110"
            value={value.postal_code}
            onChange={(e) => handlePostal(e.target.value)}
            className={selectClass(errors.postal_code)}
          />
          {errors.postal_code && <p role="alert" className={fieldError}>{t(errors.postal_code)}</p>}
        </div>
      </div>

      {postalMatches.length > 1 && (
        <div className="rounded-xl border border-line bg-sunken p-3">
          <p className="text-xs font-semibold text-muted mb-2">{t('address_form.choose_for_postal', { code: value.postal_code })}</p>
          <div className="flex flex-wrap gap-2">
            {postalMatches.map((m) => (
              <button
                type="button"
                key={m.subdistrict_id}
                onClick={() => applyMatch(m, value.postal_code)}
                className="text-xs px-3 py-1.5 rounded-full bg-paper text-ink border border-line hover:border-accent-strong hover:text-accent-strong"
              >
                {m.subdistrict} · {m.district} · {m.province}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThaiAddressPicker;
