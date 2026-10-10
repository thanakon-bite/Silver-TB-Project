/** Input, label and error styles shared by the address form fields. Role tokens switch with dark mode. */
export const fieldClass = (err?: string) =>
  `w-full px-3 py-2.5 rounded-xl border bg-paper text-ink placeholder:text-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent-strong/40 disabled:bg-sunken disabled:text-muted ${
    err ? 'border-danger' : 'border-line'
  }`;
export const fieldLabel = 'block text-sm font-medium text-ink mb-1.5';
export const fieldError = 'text-danger text-xs mt-1';
