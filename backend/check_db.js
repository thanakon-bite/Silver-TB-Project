const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('URL:', supabaseUrl);
console.log('Key Found:', !!supabaseServiceKey);

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  try {
    const { data: products, error: pError, count: pCount } = await supabase
      .from('products')
      .select('*', { count: 'exact' });

    if (pError) console.error('Error fetching products:', pError);
    else console.log('Products found:', pCount);

    const { data: orders, error: oError, count: oCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact' });

    if (oError) console.error('Error fetching orders:', oError);
    else console.log('Orders found:', oCount);

    if (pCount === 0) {
      console.log('Database is empty. You might need to seed it.');
    }
  } catch (err) {
    console.error('System error:', err);
  }
}

check();
