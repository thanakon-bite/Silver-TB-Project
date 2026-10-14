import Swal from 'sweetalert2';
import type { TFunction } from 'i18next';
import { errorMessage } from '../../lib/errorMessage';

/** The one way an admin screen reports a failed request: the shop's wording for known error codes, else the server's message. */
export function showAdminError(err: unknown, t: TFunction) {
  return Swal.fire(t('admin.common.error'), errorMessage(err, t), 'error');
}
