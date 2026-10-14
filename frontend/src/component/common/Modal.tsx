import React, { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { iconButton } from '../ui/buttonStyles';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
}

const MAX_WIDTH = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '3xl': 'sm:max-w-3xl',
  '4xl': 'sm:max-w-4xl',
  '5xl': 'sm:max-w-5xl',
  full: 'sm:max-w-full',
};

/**
 * A dialog for tasks that need protected focus (editing a record, a product's full details).
 * On phones it rises as a sheet from the bottom; it never grows past the viewport (the body scrolls).
 * Escape and the backdrop close it; focus moves in on open and returns to the opener on close.
 */
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'md' }) => {
  const { t } = useTranslation();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      openerRef.current?.focus?.();
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-ink/40"
            aria-hidden="true"
          />
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center sm:items-center sm:p-6">
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              tabIndex={-1}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={`pointer-events-auto flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-paper text-left shadow-[0_12px_40px_-12px_rgb(0_0_0/0.35)] outline-none sm:max-h-[88vh] sm:rounded-2xl ${MAX_WIDTH[maxWidth]}`}
            >
              <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line py-2 pl-5 pr-2 sm:pl-6">
                {title ? (
                  <h2 id={titleId} className="min-w-0 truncate font-display text-lg font-bold text-ink">
                    {title}
                  </h2>
                ) : (
                  <span />
                )}
                <button type="button" onClick={onClose} className={iconButton} aria-label={t('close')}>
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
              <div className="overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6">{children}</div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
