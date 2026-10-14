import React from 'react';
import { useTranslation } from 'react-i18next';
import ThaiAddressPicker, { ThaiAddressValue } from './ThaiAddressPicker';
import { fieldClass, fieldError, fieldLabel } from './fieldStyles';
import type { Address } from '../../lib/types';

export interface AddressFormValue extends ThaiAddressValue {
  label: string;
  recipient_name: string;
  phone: string;
  address_line: string;
}

export const emptyAddress = (defaults: Partial<AddressFormValue> = {}): AddressFormValue => ({
  label: '',
  recipient_name: '',
  phone: '',
  address_line: '',
  province_id: null,
  district_id: null,
  subdistrict_id: null,
  postal_code: '',
  ...defaults,
});

export const addressToForm = (a: Address): AddressFormValue => ({
  label: a.label || '',
  recipient_name: a.recipient_name,
  phone: a.phone,
  address_line: a.address_line,
  province_id: a.province_id,
  district_id: a.district_id,
  subdistrict_id: a.subdistrict_id,
  postal_code: a.postal_code,
});

/**
 * Same rules the backend enforces — shown early so customers aren't surprised.
 * Values are i18n keys; AddressForm translates them when rendering.
 */
export function validateAddress(v: AddressFormValue): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.recipient_name.trim()) e.recipient_name = 'address_form.err_recipient';
  if (!/^(\+66|0)[0-9]{8,9}$/.test(v.phone.replace(/[\s-]/g, ''))) e.phone = 'address_form.err_phone';
  if (!v.address_line.trim()) e.address_line = 'address_form.err_address_line';
  if (!v.subdistrict_id) e.subdistrict_id = 'address_form.err_subdistrict';
  if (!/^[0-9]{5}$/.test(v.postal_code)) e.postal_code = 'address_form.err_postal';
  return e;
}

/** Drops the errors of fields that changed, so a fixed field stops showing red right away. */
export function pruneErrors(errors: Record<string, string>, prev: AddressFormValue, next: AddressFormValue) {
  const changed = (Object.keys(errors) as (keyof AddressFormValue)[]).filter((k) => prev[k] !== next[k]);
  if (!changed.length) return errors;
  const rest = { ...errors };
  changed.forEach((k) => delete rest[k]);
  return rest;
}

export const toAddressPayload = (v: AddressFormValue) => ({
  label: v.label.trim() || undefined,
  recipient_name: v.recipient_name.trim(),
  phone: v.phone.trim(),
  address_line: v.address_line.trim(),
  subdistrict_id: v.subdistrict_id,
  postal_code: v.postal_code,
});

interface Props {
  value: AddressFormValue;
  onChange: (v: AddressFormValue) => void;
  errors?: Record<string, string>;
  showLabel?: boolean;
}



const AddressForm: React.FC<Props> = ({ value, onChange, errors = {}, showLabel = false }) => {
  const { t } = useTranslation();
  const set = (k: keyof AddressFormValue) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...value, [k]: e.target.value });
  const label = fieldLabel;
  const input = fieldClass;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="addr-name">{t('address_form.recipient')}</label>
          <input id="addr-name" autoComplete="name" value={value.recipient_name} onChange={set('recipient_name')} className={input(errors.recipient_name)} />
          {errors.recipient_name && <p role="alert" className={fieldError}>{t(errors.recipient_name)}</p>}
        </div>
        <div>
          <label className={label} htmlFor="addr-phone">{t('address_form.phone')}</label>
          <input id="addr-phone" type="tel" autoComplete="tel" placeholder="0812345678" value={value.phone} onChange={set('phone')} className={input(errors.phone)} />
          {errors.phone && <p role="alert" className={fieldError}>{t(errors.phone)}</p>}
        </div>
      </div>

      <div>
        <label className={label} htmlFor="addr-line">{t('address_form.address_line')}</label>
        <textarea
          id="addr-line"
          autoComplete="street-address"
          rows={2}
          placeholder={t('address_form.address_placeholder')}
          value={value.address_line}
          onChange={set('address_line')}
          className={input(errors.address_line)}
        />
        {errors.address_line && <p role="alert" className={fieldError}>{t(errors.address_line)}</p>}
      </div>

      <ThaiAddressPicker
        value={value}
        onChange={(geo) => onChange({ ...value, ...geo })}
        errors={{ subdistrict_id: errors.subdistrict_id, postal_code: errors.postal_code }}
      />

      {showLabel && (
        <div>
          <label className={label} htmlFor="addr-label">{t('address_form.label')}</label>
          <input id="addr-label" placeholder={t('address_form.label_placeholder')} maxLength={50} value={value.label} onChange={set('label')} className={input()} />
        </div>
      )}
    </div>
  );
};

export default AddressForm;
