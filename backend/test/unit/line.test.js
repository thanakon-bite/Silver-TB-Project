process.env.SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-key';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const line = require('../../src/lib/line');
const { formatAddress } = require('../../src/lib/thaiAddress');

test('verifySignature accepts a valid LINE signature and rejects tampering', () => {
  const secret = 'channel-secret';
  const body = Buffer.from(JSON.stringify({ events: [] }));
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64');
  assert.equal(line.verifySignature(body, sig, secret), true);
  assert.equal(line.verifySignature(Buffer.from('{"events":[1]}'), sig, secret), false);
  assert.equal(line.verifySignature(body, 'bogus', secret), false);
  assert.equal(line.verifySignature(body, sig, ''), false);
});

const order = {
  id: 'o1',
  order_number: 'STB-261010-00001',
  total: 8550,
  shipping_fee: 50,
  paid_at: '2026-10-10T03:00:00Z',
  shipping_address: {
    recipient_name: 'สมชาย ใจดี',
    phone: '0812345678',
    address_line: '99/1 ถ.สุขุมวิท',
    subdistrict: 'คลองเตย',
    district: 'คลองเตย',
    province: 'กรุงเทพมหานคร',
    province_id: 1,
    postal_code: '10110',
  },
};

test('order paid message contains order number, items, total and shipping details', () => {
  const text = line.buildOrderPaidMessage(order, [{ product_name: 'Dynastes hercules', quantity: 1, unit_price: 8500 }], {
    frontendUrl: 'https://shop.example',
  });
  assert.match(text, /STB-261010-00001/);
  assert.match(text, /Dynastes hercules x1/);
  assert.match(text, /฿8,550/);
  assert.match(text, /สมชาย ใจดี \(0812345678\)/);
  assert.match(text, /แขวงคลองเตย เขตคลองเตย/);
  assert.match(text, /10110/);
  assert.match(text, /https:\/\/shop\.example\/admin\?order=o1/);
});

test('formatAddress uses ต./อ./จ. outside Bangkok', () => {
  const text = formatAddress({ ...order.shipping_address, province: 'เชียงใหม่', province_id: 38, subdistrict: 'ศรีภูมิ', district: 'เมืองเชียงใหม่', postal_code: '50200' });
  assert.match(text, /ต\.ศรีภูมิ อ\.เมืองเชียงใหม่/);
  assert.match(text, /จ\.เชียงใหม่ 50200/);
  assert.equal(formatAddress('legacy text address'), 'legacy text address');
});
