/** The storefront's base URL (the first FRONTEND_URL origin), for links the backend sends people to. */
const frontendBase = () => (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/$/, '');

module.exports = { frontendBase };
