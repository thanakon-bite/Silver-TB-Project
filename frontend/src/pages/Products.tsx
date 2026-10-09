import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Heart, ShoppingCart, X, Star, Package, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../contexts/CartContext';
import { useFavorites } from '../contexts/FavoritesContext';
import Modal from '../component/common/Modal';
import Swal from 'sweetalert2';

interface Product {
  id: string;
  name: string;
  name_th?: string | null;
  description: string | null;
  description_th?: string | null;
  price: number;
  stock: number;
  category: string;
  images: string[];
  is_best_seller: boolean;
  views: number;
}

const CATEGORIES = ['All', 'Rhinoceros', 'Stag', 'Flower'];

// Image Slider component for product cards
const ImageSlider: React.FC<{ images: string[]; alt: string }> = ({ images, alt }) => {
  const [current, setCurrent] = useState(0);
  const validImages = images?.filter(Boolean) || [];

  if (validImages.length === 0) {
    return <div className="flex items-center justify-center h-full text-6xl group-hover:scale-110 transition-transform duration-300">🪲</div>;
  }

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrent((c) => (c - 1 + validImages.length) % validImages.length);
  };
  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrent((c) => (c + 1) % validImages.length);
  };

  return (
    <div className="relative w-full h-full">
      <img src={validImages[current]} alt={alt} className="w-full h-full object-cover" />
      {validImages.length > 1 && (
        <>
          <button onClick={prev} className="absolute left-1 top-1/2 -translate-y-1/2 p-1 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={next} className="absolute right-1 top-1/2 -translate-y-1/2 p-1 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-1">
            {validImages.map((_, i) => (
              <button key={i} onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? 'bg-white scale-125' : 'bg-white/50'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// Modal image slider
const ModalImageSlider: React.FC<{ images: string[]; alt: string }> = ({ images, alt }) => {
  const [current, setCurrent] = useState(0);
  const validImages = images?.filter(Boolean) || [];

  if (validImages.length === 0) {
    return <div className="flex items-center justify-center h-full text-8xl">🪲</div>;
  }

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.img
          key={current}
          src={validImages[current]}
          alt={alt}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="w-full h-full object-cover"
        />
      </AnimatePresence>
      {validImages.length > 1 && (
        <>
          <button onClick={() => setCurrent((c) => (c - 1 + validImages.length) % validImages.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => setCurrent((c) => (c + 1) % validImages.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
            {validImages.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === current ? 'bg-white scale-125' : 'bg-white/50'}`} />
            ))}
          </div>
          <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
            {current + 1}/{validImages.length}
          </div>
        </>
      )}
    </div>
  );
};

const Products: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isThai = i18n.language?.startsWith('th');

  const { addItem } = useCart();
  const { toggle, isFavorite } = useFavorites();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('default');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

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

  const filtered = useCallback(() => {
    let list = products.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        p.name.toLowerCase().includes(q) ||
        (p.name_th || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.description_th || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q);
      const matchCategory = category === 'All' || p.category === category;
      return matchSearch && matchCategory;
    });

    if (sort === 'price_asc') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'price_desc') list = [...list].sort((a, b) => b.price - a.price);
    if (sort === 'name_asc') list = [...list].sort((a, b) => {
      const aName = isThai && a.name_th ? a.name_th : a.name;
      const bName = isThai && b.name_th ? b.name_th : b.name;
      return aName.localeCompare(bName);
    });

    return list;
  }, [products, search, category, sort, isThai]);

  const handleAddToCart = (product: Product) => {
    if (product.stock === 0) return;
    addItem({
      product_id: product.id,
      name: isThai && product.name_th ? product.name_th : product.name,
      price: product.price,
      image: product.images?.[0] || '',
      max_quantity: product.stock,
    });
    Swal.fire({
      icon: 'success',
      title: 'Added to cart!',
      text: isThai && product.name_th ? product.name_th : product.name,
      timer: 1000,
      showConfirmButton: false,
      position: 'top-end',
      toast: true,
    });
  };

  const displayedProducts = filtered();

  return (
    <div className="min-h-screen bg-silver-light dark:bg-gray-900">
      {/* Page header */}
      <div className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-5xl font-extrabold mb-2">
            <span className="border-l-8 border-orange pl-4">{t('shop_all_beetles')}</span>
          </h1>
          <p className="text-gray-400 mt-3 ml-5">{t('premium_exotic_beetles_desc')}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Search + Sort */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('search_beetles')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-orange/50 shadow-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-orange/50 shadow-sm"
          >
            <option value="default">Default</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="name_asc">Name A–Z</option>
          </select>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-5 py-2 rounded-full text-sm font-semibold border transition-all ${
                category === cat
                  ? 'bg-orange text-white border-orange shadow-md shadow-orange/20'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-orange hover:text-orange'
              }`}
            >
              {t(cat)}
            </button>
          ))}
        </div>

        {/* Results count */}
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {t('showing')}<span className="font-semibold text-gray-800 dark:text-gray-200">{displayedProducts.length}</span>{t('beetles')}
        </p>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden animate-pulse">
                <div className="h-56 bg-gray-200 dark:bg-gray-700" />
                <div className="p-5 space-y-3">
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : displayedProducts.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">{t('no_beetles_found')}</p>
            <button onClick={() => { setSearch(''); setCategory('All'); }} className="mt-4 text-orange text-sm font-semibold hover:underline">{t('clear_filters')}</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedProducts.map((product, idx) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.04 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden group"
              >
                {/* Image with slider */}
                <div
                  className="relative h-56 bg-gradient-to-br from-gray-100 to-gray-200 cursor-pointer"
                  onClick={() => setSelectedProduct(product)}
                >
                  <ImageSlider images={product.images} alt={product.name} />
                  {product.is_best_seller && (
                    <span className="absolute top-3 left-3 flex items-center gap-1 bg-orange text-white text-xs font-bold px-2.5 py-1 rounded-full shadow z-10">
                      <Star className="w-3 h-3 fill-white" />{t('best_seller')}
                    </span>
                  )}
                  {product.stock === 0 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                      <span className="text-white font-bold text-lg">{t('sold_out')}</span>
                    </div>
                  )}
                  {product.stock > 0 && product.stock <= 3 && (
                    <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full z-10">
                      {t('only_left', { count: product.stock })}
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggle(product.id); }}
                    className="absolute bottom-3 right-3 p-2 rounded-full bg-white dark:bg-gray-800 shadow-md hover:scale-110 transition-transform z-10"
                  >
                    <Heart className={`w-4 h-4 ${isFavorite(product.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                  </button>
                </div>

                {/* Content */}
                <div className="p-5">
                  <span className="text-xs font-semibold text-orange uppercase tracking-wider">{t(product.category)}</span>
                  <h3
                    className="font-bold text-gray-900 dark:text-gray-100 mt-1 mb-1.5 cursor-pointer hover:text-orange transition-colors line-clamp-1"
                    onClick={() => setSelectedProduct(product)}
                  >
                    {isThai && product.name_th ? product.name_th : product.name}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 mb-4">{isThai && product.description_th ? product.description_th : product.description}</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">฿{product.price.toLocaleString()}</p>
                      <p className="text-xs text-gray-400">{product.stock > 0 ? t('count_in_stock', { count: product.stock }) : t('out_of_stock')}</p>
                    </div>
                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={product.stock === 0}
                      className="flex items-center gap-2 px-4 py-2.5 bg-orange-gradient text-white rounded-xl font-semibold text-sm shadow-md shadow-orange/20 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      {t('add_btn')}
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
        title={selectedProduct ? (isThai && selectedProduct.name_th ? selectedProduct.name_th : selectedProduct.name) : ''}
        maxWidth="2xl"
      >
        {selectedProduct && (
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-1/2 h-64 md:h-80 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl overflow-hidden flex-shrink-0">
              <ModalImageSlider images={selectedProduct.images} alt={selectedProduct.name} />
            </div>
            <div className="flex flex-col justify-between flex-1">
              <div>
                <span className="text-xs font-semibold text-orange uppercase tracking-wider">{t(selectedProduct.category)}</span>
                {selectedProduct.is_best_seller && (
                  <span className="ml-2 inline-flex items-center gap-1 bg-orange/10 text-orange text-xs font-bold px-2 py-0.5 rounded-full">
                    <Star className="w-3 h-3 fill-orange" /> {t('best_seller')}
                  </span>
                )}
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                  {isThai && selectedProduct.name_th ? selectedProduct.name_th : selectedProduct.name}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-4 leading-relaxed text-sm">
                  {isThai && selectedProduct.description_th ? selectedProduct.description_th : selectedProduct.description}
                </p>
                <div className="mt-4 space-y-1.5 text-sm">
                  <div className="flex gap-2"><span className="text-gray-400 w-20">Stock:</span><span className="font-semibold text-gray-800 dark:text-gray-200">{selectedProduct.stock} available</span></div>
                  <div className="flex gap-2"><span className="text-gray-400 w-20">{t('views')}</span><span className="font-semibold text-gray-800 dark:text-gray-200">{selectedProduct.views?.toLocaleString()}</span></div>
                </div>
              </div>
              <div className="mt-6">
                <p className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-4">฿{selectedProduct.price.toLocaleString()}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => { handleAddToCart(selectedProduct); setSelectedProduct(null); }}
                    disabled={selectedProduct.stock === 0}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-orange-gradient text-white font-bold rounded-xl shadow-lg disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                  >
                    <ShoppingCart className="w-5 h-5" />{t('add_to_cart')}
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
