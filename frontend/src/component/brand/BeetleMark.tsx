import React from 'react';

/**
 * The shop's mark: a rhinoceros beetle seen from above. Drawn in currentColor so it follows the text colour.
 * Temporary until the shop supplies its real logo; public/favicon.svg is the same drawing.
 */
const BeetleMark: React.FC<{ className?: string; title?: string }> = ({ className, title }) => (
  <svg viewBox="0 0 32 32" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} fill="currentColor">
    {title && <title>{title}</title>}
    <path d="M16 7.4c-.9-2.3-.6-4.4 1.5-5.8-.6 1.7-.4 3.5-.3 5.8z" />
    <ellipse cx="16" cy="8.6" rx="2.2" ry="1.6" />
    <ellipse cx="16" cy="12.2" rx="4.6" ry="2.9" />
    <path d="M15.4 14.6c-4.3 0-5.9 3.5-5.9 7 0 4.4 3 7.4 5.9 7.9zM16.6 14.6c4.3 0 5.9 3.5 5.9 7 0 4.4-3 7.4-5.9 7.9z" />
    <path
      d="M10.6 16 6.6 13.5l-1-3M9.6 21l-4.6.5-1.5 3M10.6 25.5 7 28.5l-.5 2.5M21.4 16l4-2.5 1-3M22.4 21l4.6.5 1.5 3M21.4 25.5l3.6 3 .5 2.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default BeetleMark;
