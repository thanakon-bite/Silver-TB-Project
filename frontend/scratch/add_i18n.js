const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');
const filesToTranslate = [
  'pages/Home.tsx',
  'pages/Products.tsx',
  'pages/Cart.tsx',
  'pages/Checkout.tsx',
  'pages/Login.tsx',
  'pages/AdminDashboard.tsx',
  'pages/Favorites.tsx',
  'component/layout/Footer.tsx'
];

const dictionary = {
  'Premium Exotic Beetles': 'hero_subtitle',
  'The premier destination for exotic beetle enthusiasts. Professionally bred, health-guaranteed, and shipped safely across Thailand.': 'hero_desc',
  'Explore Collection': 'explore_collection',
  'Follow on Facebook': 'follow_facebook',
  'Beetles in stock': 'stock_label',
  'Know Your Beetle': 'know_your_beetle',
  'Community': 'community',
  'Join Our Community': 'join_community',
  'Ready to Start Your Collection?': 'ready_to_start',
  'Shop Now': 'shop_now',
  'Add to Cart': 'add_to_cart',
  'Added to Cart!': 'added_to_cart',
  'Out of Stock': 'out_of_stock',
  'Remove': 'remove',
  'Checkout': 'checkout',
  'Subtotal': 'subtotal',
  'Total': 'total',
  'Price': 'price',
  'Quantity': 'quantity',
  'Shopping Cart': 'shopping_cart',
  'Your cart is empty': 'cart_empty',
  'Continue Shopping': 'continue_shopping',
  'Order Summary': 'order_summary',
  'Shipping': 'shipping',
  'Free': 'free',
  'Shipping Information': 'shipping_info',
  'Full Name': 'full_name',
  'Address': 'address',
  'City': 'city',
  'Postal Code': 'postal_code',
  'Phone': 'phone',
  'Confirm Order': 'confirm_order',
  'Sign In to Your Account': 'sign_in_title',
  'Email address': 'email_address',
  'Password': 'password',
  'Sign in': 'sign_in',
  'All Products': 'all_products',
  'Search products...': 'search_products',
  'Categories': 'categories',
  'All': 'all',
  'Quick Links': 'quick_links',
  'Home': 'home',
  'Products': 'products',
  'About Us': 'about_us',
  'Contact': 'contact',
  'Customer Service': 'customer_service',
  'Shipping Policy': 'shipping_policy',
  'Terms & Conditions': 'terms_conditions',
  'Privacy Policy': 'privacy_policy',
  'FAQ': 'faq',
  'Orders': 'orders',
  'Add Product': 'add_product',
  'Edit Product': 'edit_product',
  'Product': 'product',
  'Category': 'category',
  'Stock': 'stock',
  'Status': 'status',
  'Actions': 'actions',
  'Best Seller': 'best_seller',
  'Active': 'active',
  'Inactive': 'inactive',
  'No products found.': 'no_products_found',
  'Name': 'name',
  'Description': 'description',
  'Image URL (Optional)': 'image_url_optional',
  'Update Product': 'update_product',
  'Save Product': 'save_product',
  'ID / Date': 'id_date',
  'Customer': 'customer',
  'Payment': 'payment',
  'Pending': 'pending',
  'Confirmed': 'confirmed',
  'Shipped': 'shipped',
  'Delivered': 'delivered',
  'Cancelled': 'cancelled',
  'No orders found.': 'no_orders_found',
  '1. Shipping Details': 'shipping_details_step',
  'Full Shipping Address': 'full_shipping_address',
  'Proceed to Payment': 'proceed_to_payment',
  '2. Payment': 'payment_step',
  'Processing...': 'processing',
  '← Back to Shipping': 'back_to_shipping',
  'Shop All Beetles': 'shop_all_beetles',
  'Premium exotic beetles, professionally bred': 'premium_exotic_beetles_desc',
  'Search beetles...': 'search_beetles',
  'Filters': 'filters',
  'Showing ': 'showing',
  ' beetles': 'beetles',
  'No beetles found': 'no_beetles_found',
  'Clear filters': 'clear_filters',
  'Sold Out': 'sold_out',
  'in stock': 'in_stock',
  'available': 'available',
  'Views:': 'views'
};

for (const relFile of filesToTranslate) {
  const file = path.join(srcDir, relFile);
  if (!fs.existsSync(file)) continue;

  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Replace text in JSX
  for (const [text, key] of Object.entries(dictionary)) {
    // Escape regex special chars in text
    const escapedText = text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    
    // Replace text inside >...< 
    const jsxRegex = new RegExp(`>\\s*${escapedText}\\s*<`, 'g');
    content = content.replace(jsxRegex, `>{t('${key}')}<`);

    // Replace text inside placeholder="..."
    const placeholderRegex = new RegExp(`placeholder="${escapedText}"`, 'g');
    content = content.replace(placeholderRegex, `placeholder={t('${key}')}`);
    
    // Replace text inside title="..."
    const titleRegex = new RegExp(`title="${escapedText}"`, 'g');
    content = content.replace(titleRegex, `title={t('${key}')}`);
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Translated file: ${relFile}`);
  }
}

console.log('Translation injection done.');
