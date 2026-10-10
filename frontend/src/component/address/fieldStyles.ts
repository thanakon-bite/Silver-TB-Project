/** Input and label styles shared by the address form fields (light and dark mode). */
export const fieldClass = (err?: string) =>
  `w-full px-3 py-2.5 rounded-xl border bg-white text-gray-900 placeholder-gray-400 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-orange/50 disabled:bg-gray-50 disabled:text-gray-400 dark:disabled:bg-gray-800 dark:disabled:text-gray-500 ${
    err ? 'border-red-400' : 'border-gray-200 dark:border-gray-600'
  }`;
export const fieldLabel = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';
