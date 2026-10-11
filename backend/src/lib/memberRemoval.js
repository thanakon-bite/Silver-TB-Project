/**
 * What removing a Member from the admin page does (CONTEXT.md: Member):
 * no orders → delete outright; orders → Deactivate (cannot sign in, orders kept).
 * Nobody removes themselves, and the last active Admin is never removed.
 *
 * @param {{ actorId: string, target: { id: string, role: string, deactivated_at: string|null }, orderCount: number, activeAdmins: number }} input
 * @returns {{ ok: true, action: 'delete' | 'deactivate' } | { ok: false, code: string, reason: string }}
 */
function decideMemberRemoval({ actorId, target, orderCount, activeAdmins }) {
  if (target.id === actorId) return { ok: false, code: 'CANNOT_REMOVE_SELF', reason: 'You cannot remove yourself' };
  if (target.role === 'admin' && !target.deactivated_at && activeAdmins <= 1) {
    return { ok: false, code: 'LAST_ADMIN', reason: 'The last admin cannot be removed' };
  }
  if (orderCount > 0) {
    if (target.deactivated_at) return { ok: false, code: 'ALREADY_DEACTIVATED', reason: 'This member is already deactivated' };
    return { ok: true, action: 'deactivate' };
  }
  return { ok: true, action: 'delete' };
}

module.exports = { decideMemberRemoval };
