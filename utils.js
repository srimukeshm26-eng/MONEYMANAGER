/**
 * utils.js - Formatting, sanitization, validation, and ID helpers
 */

/**
 * Escapes unsafe HTML characters to prevent XSS attacks.
 * @param {string} str 
 * @returns {string} Safe HTML string
 */
export function sanitizeHTML(str) {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Generates a unique UUID v4 or secure fallback string
 * @returns {string} Unique identifier
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'tx_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * Formats a numeric amount using the chosen currency symbol and user locale.
 * @param {number} amount 
 * @param {string} currencySymbol - e.g. '₹', '$', '€', '£'
 * @param {string} locale - default 'en-IN' or 'en-US'
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, currencySymbol = '₹', locale = 'en-IN') {
  const num = Number(amount) || 0;
  try {
    const formattedNum = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Math.abs(num));
    
    const sign = num < 0 ? '-' : '';
    return `${sign}${currencySymbol} ${formattedNum}`;
  } catch {
    return `${num < 0 ? '-' : ''}${currencySymbol} ${Math.abs(num).toFixed(2)}`;
  }
}

/**
 * Returns today's date formatted as YYYY-MM-DD for input[type="date"]
 * @returns {string}
 */
export function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats an ISO date string (YYYY-MM-DD) into a human friendly format
 * e.g., "Oct 26, 2026"
 * @param {string} dateString 
 * @returns {string}
 */
export function formatDisplayDate(dateString) {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Formats a date into a clean header for day grouping: "Today - Oct 26", "Yesterday", or "Monday, Oct 24, 2026"
 * @param {string} dateString 
 * @returns {string}
 */
export function formatGroupDate(dateString) {
  if (!dateString) return 'Undated';
  const todayStr = getTodayDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yYear = yesterday.getFullYear();
  const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
  const yDay = String(yesterday.getDate()).padStart(2, '0');
  const yesterdayStr = `${yYear}-${yMonth}-${yDay}`;

  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  const formatted = date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
  });

  if (dateString === todayStr) {
    return `Today • ${formatted}`;
  } else if (dateString === yesterdayStr) {
    return `Yesterday • ${formatted}`;
  }
  return formatted;
}

/**
 * Hashes a string using SHA-256 for secure local credential storage
 * @param {string} text 
 * @returns {Promise<string>} Hex-encoded hash
 */
export async function hashString(text) {
  if (!crypto.subtle || !crypto.subtle.digest) {
    // Basic fallback hash if crypto.subtle is unavailable in insecure origin
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    return 'fallback_' + Math.abs(hash).toString(16);
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Debounce function to limit rapid execution
 * @param {Function} fn 
 * @param {number} delay 
 * @returns {Function}
 */
export function debounce(fn, delay = 250) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}
