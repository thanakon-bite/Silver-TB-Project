/**
 * Small HTTP helpers shared by all routes.
 *  - HttpError: throw inside a handler to return a specific status + message
 *  - asyncHandler: forwards rejected promises to the Express error handler
 *  - fromDbError: maps known Postgres / create_order errors to safe client messages
 */

class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
    this.expose = true;
  }
}

const badRequest = (message, code) => new HttpError(400, message, code);
const notFound = (message = 'Not found') => new HttpError(404, message, 'NOT_FOUND');
const conflict = (message, code) => new HttpError(409, message, code);
const forbidden = (message = 'Forbidden') => new HttpError(403, message, 'FORBIDDEN');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Errors raised by our SQL functions (RAISE EXCEPTION '<CODE>')
const DB_ERRORS = {
  INVALID_ITEMS: [400, () => 'Your cart is empty or invalid.'],
  INVALID_QUANTITY: [400, () => 'Each quantity must be a whole number between 1 and 99.'],
  INVALID_ADDRESS: [400, () => 'Shipping address is invalid.'],
  INVALID_SHIPPING_FEE: [500, () => 'Shipping fee is misconfigured.'],
  PRODUCT_UNAVAILABLE: [409, () => 'One of the products in your cart is no longer available.'],
  INSUFFICIENT_STOCK: [409, (d) => `Not enough stock for ${d || 'a product in your cart'}.`],
  ORDER_NOT_FOUND: [404, () => 'Order not found.'],
  INVALID_STATUS: [409, (d) => `This order can no longer be cancelled${d ? ` (status: ${d})` : ''}.`],
  REFUND_REQUIRED: [409, () => 'This order is paid — refund it instead of cancelling.'],
  INVALID_DELTA: [400, () => 'Stock adjustment must be a non-zero whole number.'],
  PRODUCT_NOT_FOUND: [404, () => 'Product not found.'],
  STOCK_BELOW_ZERO: [409, () => 'Stock cannot go below zero.'],
  INVALID_DISCOUNT: [500, () => 'A discount did not match its Promotion.'],
  PROMOTION_UNAVAILABLE: [409, () => 'A promotion in your cart has just ended. Please review your cart.'],
  PROMOTION_LIMIT_REACHED: [409, (d) => `The promotion${d ? ` "${d}"` : ''} has reached its limit. Please review your cart.`],
};

/** Convert a Supabase/PostgREST error into an HttpError (or a generic 500). */
function fromDbError(error) {
  if (!error) return null;
  const mapped = DB_ERRORS[error.message];
  if (mapped) {
    const [status, msg] = mapped;
    return new HttpError(status, msg(error.details), error.message);
  }
  if (error.code === '23505') return conflict('This record already exists.', 'DUPLICATE');
  if (error.code === '23503') return badRequest('A referenced record does not exist.', 'FOREIGN_KEY');
  if (error.code === '23514') return badRequest('Some values are out of the allowed range.', 'CHECK_VIOLATION');
  if (error.code === '22P02') return badRequest('Invalid identifier.', 'INVALID_INPUT');
  const err = new Error(`Database error: ${error.message}`);
  err.status = 500;
  return err;
}

/** Throws if a Supabase call returned an error. Returns data otherwise. */
function unwrap({ data, error }) {
  if (error) throw fromDbError(error);
  return data;
}

module.exports = {
  HttpError,
  badRequest,
  notFound,
  conflict,
  forbidden,
  asyncHandler,
  fromDbError,
  unwrap,
};
