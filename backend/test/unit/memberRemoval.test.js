const test = require('node:test');
const assert = require('node:assert/strict');
const { decideMemberRemoval } = require('../../src/lib/memberRemoval');

const customer = { id: 'u1', role: 'user', deactivated_at: null };
const admin = { id: 'a2', role: 'admin', deactivated_at: null };

test('a Member with no orders is deleted outright', () => {
  assert.deepEqual(decideMemberRemoval({ actorId: 'a1', target: customer, orderCount: 0, activeAdmins: 1 }), { ok: true, action: 'delete' });
});

test('a Member with orders is Deactivated so their orders stay', () => {
  assert.deepEqual(decideMemberRemoval({ actorId: 'a1', target: customer, orderCount: 3, activeAdmins: 1 }), { ok: true, action: 'deactivate' });
});

test('nobody removes themselves', () => {
  const r = decideMemberRemoval({ actorId: 'a2', target: admin, orderCount: 0, activeAdmins: 2 });
  assert.deepEqual([r.ok, r.code], [false, 'CANNOT_REMOVE_SELF']);
});

test('the last Admin can never be removed', () => {
  const r = decideMemberRemoval({ actorId: 'a1', target: admin, orderCount: 0, activeAdmins: 1 });
  assert.deepEqual([r.ok, r.code], [false, 'LAST_ADMIN']);
  assert.equal(decideMemberRemoval({ actorId: 'a1', target: admin, orderCount: 0, activeAdmins: 2 }).ok, true);
});

test('an already Deactivated Member with orders cannot be removed again', () => {
  const r = decideMemberRemoval({ actorId: 'a1', target: { ...customer, deactivated_at: '2026-10-01' }, orderCount: 2, activeAdmins: 1 });
  assert.deepEqual([r.ok, r.code], [false, 'ALREADY_DEACTIVATED']);
});
