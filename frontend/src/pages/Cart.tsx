import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { X, Plus, Minus, ShoppingBag, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../contexts/CartContext';

const Cart: React.FC = () => {
  const { t } = useTranslation();

  const { items, isOpen, closeCart, removeItem, updateQuantity, totalPrice, totalItems } = useCart();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          {/* Slide-over panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-6 h-6 text-orange" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('shopping_cart')}</h2>
                {totalItems > 0 && (
                  <span className="bg-orange text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </div>
              <button
                onClick={closeCart}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500 dark:text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                  <ShoppingBag className="w-16 h-16 text-gray-200 mb-4" />
                  <p className="text-gray-400 dark:text-gray-500 font-medium">{t('cart_empty')}</p>
                  <p className="text-gray-300 text-sm mt-1">Add some beetles to get started!</p>
                  <Link
                    to="/products"
                    onClick={closeCart}
                    className="mt-6 px-6 py-2.5 bg-orange-gradient text-white rounded-full font-semibold text-sm hover:opacity-90 transition-opacity"
                  >{t('shop_now')}</Link>
                </div>
              ) : (
                <ul className="space-y-4">
                  <AnimatePresence>
                    {items.map((item) => (
                      <motion.li
                        key={item.product_id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex gap-4 py-3 border-b border-gray-50"
                      >
                        <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-100 flex items-center justify-center text-2xl">
                              🪲
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{item.name}</p>
                          <p className="text-orange font-bold mt-1">฿{item.price.toLocaleString()}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                              className="p-1 rounded-full border border-gray-200 dark:border-gray-700 hover:border-orange hover:text-orange transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center font-semibold text-sm">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                              disabled={item.max_quantity !== undefined && item.quantity >= item.max_quantity}
                              aria-label="Increase quantity"
                              className="p-1 rounded-full border border-gray-200 dark:border-gray-700 hover:border-orange hover:text-orange transition-colors disabled:opacity-30 disabled:pointer-events-none"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col items-end justify-between">
                          <button
                            onClick={() => removeItem(item.product_id)}
                            className="p-1.5 rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <p className="font-bold text-gray-800 dark:text-gray-200 text-sm">
                            ฿{(item.price * item.quantity).toLocaleString()}
                          </p>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-700 px-6 py-6 bg-gray-50/80">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">{t('subtotal')}</span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">฿{totalPrice.toLocaleString()}</span>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Shipping calculated at checkout</p>
                <Link
                  to="/checkout"
                  onClick={closeCart}
                  className="block w-full py-3.5 bg-orange-gradient text-white font-bold text-center rounded-xl shadow-lg hover:opacity-90 transition-opacity"
                >{t('checkout')}</Link>
                <button
                  onClick={closeCart}
                  className="block w-full py-2.5 mt-2 text-gray-500 dark:text-gray-400 text-sm font-medium text-center hover:text-gray-700 transition-colors"
                >{t('continue_shopping')}</button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Cart;
