import React from 'react';
import ThaiAddressPicker, { ThaiAddressValue } from './ThaiAddressPicker';
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

/** Same rules the backend enforces — shown early so customers aren't surprised. */
export function validateAddress(v: AddressFormValue): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.recipient_name.trim()) e.recipient_name = 'Recipient name is required';
  if (!/^(\+66|0)[0-9]{8,9}$/.test(v.phone.replace(/[\s-]/g, ''))) e.phone = 'Enter a Thai phone number, e.g. 0812345678';
  if (!v.address_line.trim()) e.address_line = 'House number, street, building…';
  if (!v.subdistrict_id) e.subdistrict_id = 'Choose province, district and subdistrict';
  if (!/^[0-9]{5}$/.test(v.postal_code)) e.postal_code = 'Postal code must be 5 digits';
  return e;
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

const input = (err?: string) =>
  `w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-orange/50 ${
    err ? 'border-red-400' : 'border-gray-200'
  }`;

const AddressForm: React.FC<Props> = ({ value, onChange, errors = {}, showLabel = false }) => {
  const set = (k: keyof AddressFormValue) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...value, [k]: e.target.value });
  const label = 'block text-sm font-medium text-gray-700 mb-1.5';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="addr-name">ชื่อผู้รับ / Recipient</label>
          <input id="addr-name" autoComplete="name" value={value.recipient_name} onChange={set('recipient_name')} className={input(errors.recipient_name)} />
          {errors.recipient_name && <p className="text-red-500 text-xs mt-1">{errors.recipient_name}</p>}
        </div>
        <div>
          <label className={label} htmlFor="addr-phone">เบอร์โทร / Phone</label>
          <input id="addr-phone" type="tel" autoComplete="tel" placeholder="0812345678" value={value.phone} onChange={set('phone')} className={input(errors.phone)} />
          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
        </div>
      </div>

      <div>
        <label className={label} htmlFor="addr-line">ที่อยู่ / Address</label>
        <textarea
          id="addr-line"
          autoComplete="street-address"
          rows={2}
          placeholder="บ้านเลขที่ หมู่ ซอย ถนน อาคาร…"
          value={value.address_line}
          onChange={set('address_line')}
          className={input(errors.address_line)}
        />
        {errors.address_line && <p className="text-red-500 text-xs mt-1">{errors.address_line}</p>}
      </div>

      <ThaiAddressPicker
        value={value}
        onChange={(geo) => onChange({ ...value, ...geo })}
        errors={{ subdistrict_id: errors.subdistrict_id, postal_code: errors.postal_code }}
      />

      {showLabel && (
        <div>
          <label className={label} htmlFor="addr-label">Label (optional)</label>
          <input id="addr-label" placeholder="Home, Office…" maxLength={50} value={value.label} onChange={set('label')} className={input()} />
        </div>
      )}
    </div>
  );
};

export default AddressForm;
