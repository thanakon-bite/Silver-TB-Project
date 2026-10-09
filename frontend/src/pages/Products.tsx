import React, { useState, useEffect, useCallback } from 'react';
import { Search, SlidersHorizontal, Heart, ShoppingCart, X, Star, Package } from 'lucide-react';
import { api } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../contexts/CartContext';
import { useFavorites } from '../contexts/FavoritesContext';
import Modal from '../component/common/Modal';
import Swal from 'sweetalert2';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  category: string;
  images: string[];
  is_best_seller: boolean;
  views: number;
}


const CATEGORIES = ['All', 'Rhinoceros', 'Stag', 'Flower'];
const SORT_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'name_asc', label: 'Name A–Z' },
];

const Products: React.FC = () => {
  const { addItem } = useCart();
  const { toggle, isFavorite } = useFavorites();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await api.get<{ products: Product[] }>('/products?limit=100');
        setProducts(data.products || []);
      } catch (err) {
        console.error('Failed to load products');
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('default');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const filtered = useCallback(() => {
    let list = products.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(search.toLowerCase());
      const matchCategory = category === 'All' || p.category === category;
      return matchSearch && matchCategory;
    });

    if (sort === 'price_asc') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'price_desc') list = [...list].sort((a, b) => b.price - a.price);
    if (sort === 'name_asc') list = [...list].sort((a, b) => a.name.localeCompare(b.name));

    return list;
  }, [products, search, category, sort]);

  const handleAddToCart = (product: Product) => {
    if (product.stock === 0) return;
    addItem({
      product_id: product.id,
      name: product.name,
      price: product.price,
      image: product.images?.[0] || '',
      max_quantity: product.stock,
    });
    Swal.fire({
      icon: 'success',
      title: 'Added to cart!',
      text: product.name,
      timer: 1000,
      showConfirmButton: false,
      position: 'top-end',
      toast: true,
    });
  };

  const displayedProducts = filtered();

  return (
    <div className="min-h-screen bg-silver-light">
      {/* Page header */}
      <div className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-5xl font-extrabold mb-2">
            <span className="border-l-8 border-orange pl-4">Shop All Beetles</span>
          </h1>
          <p className="text-gray-400 mt-3 ml-5">Premium exotic beetles, professionally bred</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Search & Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search beetles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange/50 shadow-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl border font-semibold text-sm shadow-sm transition-colors ${showFilters ? 'bg-orange text-white border-orange' : 'bg-white border-gray-200 text-gray-700 hover:border-orange'}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange/50 shadow-sm"
          >
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Category pills */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="flex flex-wrap gap-2 py-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                      category === cat
                        ? 'bg-orange text-white border-orange shadow-md shadow-orange/20'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-orange hover:text-orange'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results count */}
        <p className="text-sm text-gray-500 mb-6">
          Showing <span className="font-semibold text-gray-800">{displayedProducts.length}</span> beetles
        </p>

        {/* Grid */}
        {displayedProducts.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">No beetles found</p>
            <button onClick={() => { setSearch(''); setCategory('All'); }} className="mt-4 text-orange text-sm font-semibold hover:underline">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedProducts.map((product, idx) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden group"
              >
                {/* Image */}
                <div
                  className="relative h-56 bg-gradient-to-br from-gray-100 to-gray-200 cursor-pointer"
                  onClick={() => setSelectedProduct(product)}
                >
                  {product.images?.[0] ? (
                    <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-6xl group-hover:scale-110 transition-transform duration-300">
                      🪲
                    </div>
                  )}
                  {product.is_best_seller && (
                    <span className="absolute top-3 left-3 flex items-center gap-1 bg-orange text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
                      <Star className="w-3 h-3 fill-white" /> Best Seller
                    </span>
                  )}
                  {product.stock === 0 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white font-bold text-lg">Sold Out</span>
                    </div>
                  )}
                  {product.stock > 0 && product.stock <= 3 && (
                    <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                      Only {product.stock} left
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggle(product.id); }}
                    className="absolute bottom-3 right-3 p-2 rounded-full bg-white shadow-md hover:scale-110 transition-transform"
                  >
                    <Heart className={`w-4 h-4 ${isFavorite(product.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                  </button>
                </div>

                {/* Content */}
                <div className="p-5">
                  <span className="text-xs font-semibold text-orange uppercase tracking-wider">{product.category}</span>
                  <h3
                    className="font-bold text-gray-900 mt-1 mb-1.5 cursor-pointer hover:text-orange transition-colors line-clamp-1"
                    onClick={() => setSelectedProduct(product)}
                  >
                    {product.name}
                  </h3>
                  <p className="text-gray-500 text-sm line-clamp-2 mb-4">{product.description}</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-extrabold text-gray-900">฿{product.price.toLocaleString()}</p>
                      <p className="text-xs text-gray-400">{product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}</p>
                    </div>
                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={product.stock === 0}
                      className="flex items-center gap-2 px-4 py-2.5 bg-orange-gradient text-white rounded-xl font-semibold text-sm shadow-md shadow-orange/20 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      <Modal
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        title={selectedProduct?.name}
        maxWidth="2xl"
      >
        {selectedProduct && (
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-1/2 h-64 md:h-80 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center text-8xl flex-shrink-0">
              {selectedProduct.images?.[0] ? (
                <img src={selectedProduct.images[0]} alt={selectedProduct.name} className="w-full h-full object-cover rounded-xl" />
              ) : '🪲'}
            </div>
            <div className="flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-orange uppercase tracking-wider">{selectedProduct.category}</span>
                {selectedProduct.is_best_seller && (
                  <span className="ml-2 inline-flex items-center gap-1 bg-orange/10 text-orange text-xs font-bold px-2 py-0.5 rounded-full">
                    <Star className="w-3 h-3 fill-orange" /> Best Seller
                  </span>
                )}
                <p className="text-gray-600 mt-4 leading-relaxed text-sm">{selectedProduct.description}</p>
                <div className="mt-4 space-y-1.5 text-sm">
                  <div className="flex gap-2"><span className="text-gray-400 w-20">Stock:</span><span className="font-semibold text-gray-800">{selectedProduct.stock} available</span></div>
                  <div className="flex gap-2"><span className="text-gray-400 w-20">Views:</span><span className="font-semibold text-gray-800">{selectedProduct.views.toLocaleString()}</span></div>
                </div>
              </div>
              <div className="mt-6">
                <p className="text-3xl font-extrabold text-gray-900 mb-4">฿{selectedProduct.price.toLocaleString()}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => { handleAddToCart(selectedProduct); setSelectedProduct(null); }}
                    disabled={selectedProduct.stock === 0}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-orange-gradient text-white font-bold rounded-xl shadow-lg disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    Add to Cart
                  </button>
                  <button
                    onClick={() => toggle(selectedProduct.id)}
                    className={`p-3 rounded-xl border-2 transition-all ${isFavorite(selectedProduct.id) ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-red-300'}`}
                  >
                    <Heart className={`w-5 h-5 ${isFavorite(selectedProduct.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Products;
