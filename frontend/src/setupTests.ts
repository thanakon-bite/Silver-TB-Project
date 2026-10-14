// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// jsdom gaps the app relies on
import { TextEncoder, TextDecoder } from 'util';
import { webcrypto } from 'crypto';
Object.assign(global, { TextEncoder, TextDecoder });
Object.defineProperty(global, 'crypto', { value: webcrypto });
window.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};
