import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFavorites } from '../contexts/FavoritesContext';
import { useCart } from '../contexts/CartContext';
import { api } from '../lib/api';
import Swal from 'sweetalert2';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  images: string[];
  is_best_seller: boolean;
  views: number;
}



const Favorites: React.FC = () => {
  const { t } = useTranslation();

  const { favorites, toggle } = useFavorites();
  const { addItem } = useCart();

  const [productsMap, setProductsMap] = React.useState<Record<string, Product>>({});

  React.useEffect(() => {
    const fetchFavoriteProducts = async () => {
      if (favorites.length === 0) return;
      try {
        const { products } = await api.get<{ products: Product[] }>('/products?limit=100');
        const map: Record<string, Product> = {};
        products.forEach(p => { map[p.id] = p; });
        setProductsMap(map);
      } catch (err) {
        console.error('Failed to fetch products');
      }
    };
    fetchFavoriteProducts();
  }, [favorites]);

  const handleAddToCart = (id: string) => {
    const product = productsMap[id];
    if (!product || product.stock === 0) return;
    addItem({ product_id: id, name: product.name, price: product.price, image: product.images?.[0] || '', max_quantity: product.stock });
    Swal.fire({ icon: 'success', title: 'Added to cart!', text: product.name, timer: 1000, showConfirmButton: false, position: 'top-end', toast: true });
  };

  const handleRemove = (id: string) => {
    const product = productsMap[id];
    Swal.fire({
      icon: 'warning',
      title: 'Remove from favorites?',
      text: product?.name,
      showCancelButton: true,
      confirmButtonColor: '#FF922B',
      confirmButtonText: 'Remove',
    }).then((result) => {
      if (result.isConfirmed) toggle(id);
    });
  };

  return (
    <div className="min-h-screen bg-silver-light dark:bg-gray-800">
      <div className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Heart className="w-8 h-8 text-red-400 fill-red-400" />
            <div>
              <h1 className="text-4xl font-extrabold">My Favorites</h1>
              <p className="text-gray-400 dark:text-gray-500 mt-1">{favorites.length} saved beetle{favorites.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {favorites.length === 0 ? (
          <div className="text-center py-24">
            <Heart className="w-20 h-20 text-gray-200 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300 mb-2">No favorites yet</h2>
            <p className="text-gray-400 dark:text-gray-500 mb-8">Browse our collection and heart the beetles you love.</p>
            <Link
              to="/products"
              className="inline-flex items-center gap-2 px-8 py-3 bg-orange-gradient text-white font-bold rounded-full shadow-lg hover:opacity-90 transition-opacity"
            >
              Browse Collection
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            <AnimatePresence>
              {favorites.map((id) => {
                const product = productsMap[id];
                if (!product) return null;
                return (
                  <motion.div
                    key={id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-lg transition-all overflow-hidden group"
                  >
                    <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-5xl group-hover:scale-105 transition-transform duration-300">
                      {product.images?.[0] ? (
                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                      ) : '🪲'}
                    </div>
                    <div className="p-4">
                      <span className="text-xs font-semibold text-orange uppercase tracking-wider">{t(product.category)}</span>
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 mt-1 mb-1 line-clamp-1">{product.name}</h3>
                      <p className="text-xl font-extrabold text-gray-900 dark:text-gray-100 mb-4">฿{product.price.toLocaleString()}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAddToCart(id)}
                          disabled={product.stock === 0}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-orange-gradient text-white rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                        >
                          <ShoppingCart className="w-4 h-4" />
                          {product.stock === 0 ? 'Sold Out' : 'Add to Cart'}
                        </button>
                        <button
                          onClick={() => handleRemove(id)}
                          className="p-2.5 rounded-xl border-2 border-red-200 text-red-400 hover:bg-red-50 hover:border-red-400 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default Favorites;
