/**
 * An in-memory stand-in for the service-role Supabase client, enough for route tests: tables are
 * arrays of rows (joins stored on the row), filters run in memory, select columns are ignored, and
 * rpc / auth answers come from the test. Install it before requiring the server.
 */
const path = require('node:path');

function createFake() {
  const tables = {};
  const rpcCalls = [];
  const rpcHandlers = {};
  const users = {}; // token -> { id, email }

  const field = (row, col) => {
    if (col.includes('->>')) {
      const [json, key] = col.split('->>');
      const v = row[json]?.[key];
      return v === undefined || v === null ? v : String(v);
    }
    return row[col];
  };

  class Query {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.action = 'select';
      this.wantCount = false;
      this.head = false;
      this.one = null;
      this.returning = false;
    }
    select(_cols, opts = {}) {
      if (this.action === 'select') {
        this.wantCount = opts.count === 'exact';
        this.head = Boolean(opts.head);
      } else this.returning = true;
      return this;
    }
    update(values) {
      this.action = 'update';
      this.values = values;
      return this;
    }
    delete() {
      this.action = 'delete';
      return this;
    }
    insert(values) {
      this.action = 'insert';
      this.values = values;
      return this;
    }
    eq(col, v) {
      this.filters.push((r) => field(r, col) === v);
      return this;
    }
    in(col, list) {
      this.filters.push((r) => list.includes(field(r, col)));
      return this;
    }
    is(col, v) {
      this.filters.push((r) => (field(r, col) ?? null) === v);
      return this;
    }
    lte(col, v) {
      this.filters.push((r) => field(r, col) <= v);
      return this;
    }
    gte(col, v) {
      this.filters.push((r) => field(r, col) >= v);
      return this;
    }
    order() {
      return this;
    }
    range() {
      return this;
    }
    limit() {
      return this;
    }
    maybeSingle() {
      this.one = 'maybe';
      return this;
    }
    single() {
      this.one = 'single';
      return this;
    }
    run() {
      const rows = (tables[this.table] ||= []);
      const hit = rows.filter((r) => this.filters.every((f) => f(r)));
      let data = hit;
      if (this.action === 'update') hit.forEach((r) => Object.assign(r, this.values));
      if (this.action === 'delete') tables[this.table] = rows.filter((r) => !hit.includes(r));
      if (this.action === 'insert') {
        data = [].concat(this.values);
        rows.push(...data);
      }
      if (this.action !== 'select' && !this.returning) data = null;
      if (data && this.one) data = data[0] ?? null;
      if (this.head) data = null;
      return { data, error: null, count: this.wantCount ? hit.length : null };
    }
    then(resolve, reject) {
      return Promise.resolve(this.run()).then(resolve, reject);
    }
  }

  const client = {
    from: (table) => new Query(table),
    rpc: async (name, args) => {
      rpcCalls.push({ name, args });
      return rpcHandlers[name] ? rpcHandlers[name](args) : { data: null, error: null };
    },
    auth: {
      getUser: async (token) => (users[token] ? { data: { user: users[token] }, error: null } : { data: { user: null }, error: { message: 'bad token' } }),
    },
    storage: { from: () => ({}) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
  };

  return { client, tables, rpcCalls, rpcHandlers, users };
}

/** Puts the fake where src/config/supabase.js would be loaded from, and returns it. */
function installFakeSupabase() {
  const fake = createFake();
  const file = path.resolve(__dirname, '../../src/config/supabase.js');
  require.cache[file] = { id: file, filename: file, loaded: true, exports: fake.client };
  return fake;
}

module.exports = { installFakeSupabase };
