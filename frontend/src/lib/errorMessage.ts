import type { TFunction } from 'i18next';
import { ApiError } from './api';

/**
 * What to tell the customer about a failed request: the shop's own wording for error codes it
 * knows (api_errors.<CODE> in the locale files), otherwise the server's message as sent.
 */
export function errorMessage(err: unknown, t: TFunction): string {
  if (err instanceof ApiError && err.code) {
    const key = `api_errors.${err.code}`;
    const text = t(key);
    if (text !== key) return text;
  }
  return err instanceof Error ? err.message : String(err);
}
