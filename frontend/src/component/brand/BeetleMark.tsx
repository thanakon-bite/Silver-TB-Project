import React from 'react';

/**
 * The shop's mark: a rhinoceros beetle seen from above. Drawn in currentColor so it follows the text colour.
 * public/favicon.svg, favicon.ico and logo192/512.png are the same drawing on an accent-strong badge.
 */
// One side of the body (wing case + three legs); the other side is its mirror image.
const Half = () => (
  <>
    <path d="M31.2 33C24.4 33.2 20.2 38.2 20.2 45.4c0 7.8 4.8 13.8 11 15.4z" />
    <path d="M23.4 27.8 16.4 24l-2.6-7M21.4 39l-8-1.2-4.6 5.6M22.4 50.6l-5.6 4.8-.8 6.2" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
  </>
);

const BeetleMark: React.FC<{ className?: string; title?: string }> = ({ className, title }) => (
  <svg viewBox="0 0 64 64" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} fill="currentColor">
    {title && <title>{title}</title>}
    <path d="M32 21c-7.8 0-11.2 2.7-11.2 6.4 0 3.5 3.9 4.9 11.2 4.9s11.2-1.4 11.2-4.9c0-3.7-3.4-6.4-11.2-6.4z" />
    <path d="M27.9 18.4c0-2.2 1.8-3.4 4.1-3.4s4.1 1.2 4.1 3.4-1.8 3-4.1 3-4.1-.8-4.1-3z" />
    <path d="M30 16.2c-.9-5.2.2-9.8 3.8-13.2 1.3-1.2 3-1.6 3.9-1.2-3.2 2.6-4.9 7-5 14.4z" />
    <Half />
    <g transform="translate(64 0) scale(-1 1)">
      <Half />
    </g>
  </svg>
);

export default BeetleMark;
