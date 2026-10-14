/**
 * Content that is written but not yet live. Each waits on the shop owner:
 * - terms, privacy: the seller's legal name in both locale files (search for "[ชื่อผู้ขาย]" / "[Seller name]"),
 *   and ideally a legal review.
 * - faqCare: the owner checking the drafted care answers against how the farm keeps its beetles.
 * Turning a flag on publishes the page (route and footer link) or the FAQ section.
 */
export const PUBLISHED = {
  terms: false,
  privacy: false,
  faqCare: false,
} as const;
