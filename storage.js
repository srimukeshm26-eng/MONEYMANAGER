/**
 * storage.js - Schema versioning, migrations, user authentication, and data operations
 */

import { generateId, hashString } from './utils.js';

export const STORAGE_KEY = 'expenseTracker:data';
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Default sample data to showcase charts and features immediately upon first registration or demo login
 */
const SAMPLE_TRANSACTIONS = [
  {
    id: 'tx_seed_1',
    type: 'income',
    amount: 75000,
    category: 'Salary',
    date: getOffsetDate(0),
    note: 'Monthly Software Consulting Salary',
    paymentMethod: 'UPI / Bank',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tx_seed_2',
    type: 'expense',
    amount: 18500,
    category: 'Housing',
    date: getOffsetDate(-1),
    note: 'Apartment Monthly Rent & Maintenance',
    paymentMethod: 'UPI / Bank',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tx_seed_3',
    type: 'expense',
    amount: 3450,
    category: 'Food & Dining',
    date: getOffsetDate(-1),
    note: 'Artisan Grocery & Fresh Produce',
    paymentMethod: 'Credit Card',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tx_seed_4',
    type: 'expense',
    amount: 1200,
    category: 'Transportation',
    date: getOffsetDate(-2),
    note: 'Fuel & Metro card top-up',
    paymentMethod: 'Debit Card',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tx_seed_5',
    type: 'expense',
    amount: 2800,
    category: 'Utilities',
    date: getOffsetDate(-3),
    note: 'Electricity bill & High-speed fiber',
    paymentMethod: 'UPI / Bank',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tx_seed_6',
    type: 'expense',
    amount: 1500,
    category: 'Entertainment',
    date: getOffsetDate(-4),
    note: 'Weekend Cinema & Snacks',
    paymentMethod: 'Credit Card',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tx_seed_7',
    type: 'income',
    amount: 12000,
    category: 'Freelance',
    date: getOffsetDate(-5),
    note: 'UI/UX Design Sprint Contract',
    paymentMethod: 'UPI / Bank',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tx_seed_8',
    type: 'expense',
    amount: 2200,
    category: 'Shopping',
    date: getOffsetDate(-6),
    note: 'Ergonomic Desk Accessories',
    paymentMethod: 'Credit Card',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

function getOffsetDate(dayOffset) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Default empty state template
 */
function createDefaultStore() {
  return {
    version: CURRENT_SCHEMA_VERSION,
    currentUserId: null,
    users: [],
    settings: {
      currencySymbol: '₹',
      locale: 'en-IN',
      monthlyBudget: 35000,
      startOfWeek: 'Monday' // 'Monday' | 'Sunday'
    },
    transactions: []
  };
}

/**
 * Migration engine to handle schema upgrades safely
 * @param {object} oldData 
 * @returns {object} Migrated valid data structure
 */
export function migrate(oldData) {
  if (!oldData || typeof oldData !== 'object') {
    return createDefaultStore();
  }

  let data = { ...oldData };
  let currentVer = data.version || 0;

  // Migration from v0 (legacy or unversioned) to v1
  if (currentVer < 1) {
    data.version = 1;
    if (!Array.isArray(data.users)) data.users = [];
    if (!data.settings) {
      data.settings = {
        currencySymbol: '₹',
        locale: 'en-IN',
        monthlyBudget: 35000,
        startOfWeek: 'Monday'
      };
    }
    if (!Array.isArray(data.transactions)) {
      data.transactions = [];
    }
    currentVer = 1;
  }

  // Ensure all required fields exist and conform to schema
  data.users = Array.isArray(data.users) ? data.users : [];
  data.transactions = Array.isArray(data.transactions) ? data.transactions : [];
  data.settings = {
    currencySymbol: data.settings?.currencySymbol || '₹',
    locale: data.settings?.locale || 'en-IN',
    monthlyBudget: Number(data.settings?.monthlyBudget) >= 0 ? Number(data.settings.monthlyBudget) : 35000,
    startOfWeek: data.settings?.startOfWeek === 'Sunday' ? 'Sunday' : 'Monday'
  };

  return data;
}

/**
 * Safely loads data from localStorage with corrupted data recovery
 * @returns {object}
 */
export function loadStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createDefaultStore();
      saveStorage(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    const validData = migrate(parsed);
    return validData;
  } catch (err) {
    console.error('ExpenseTracker: Failed to parse localStorage data. Rebuilding safe store.', err);
    const fallback = createDefaultStore();
    saveStorage(fallback);
    return fallback;
  }
}

/**
 * Persists the entire state store to localStorage
 * @param {object} data 
 */
export function saveStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('ExpenseTracker: LocalStorage write failed (quota exceeded?)', err);
    alert('Warning: Local storage appears full or blocked. Data could not be saved.');
  }
}

/* ==========================================================================
   AUTHENTICATION & SESSION MANAGEMENT
   ========================================================================== */

/**
 * Registers a new user. Initializes with default settings and EMPTY transaction history.
 * Only the Demo Account gets pre-seeded sample transactions.
 * @param {string} name 
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{success: boolean, user?: object, error?: string}>}
 */
export async function registerUser(name, email, password) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanName = (name || '').trim();

  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Please enter a valid email address.' };
  }
  if (!password || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }
  if (!cleanName) {
    return { success: false, error: 'Please enter your name.' };
  }

  const store = loadStorage();
  const existing = store.users.find(u => u.email === cleanEmail);
  if (existing) {
    return { success: false, error: 'An account with this email already exists. Please log in.' };
  }

  const passwordHash = await hashString(password);
  const newUser = {
    id: generateId(),
    name: cleanName,
    email: cleanEmail,
    passwordHash: passwordHash,
    createdAt: new Date().toISOString(),
    settings: {
      currencySymbol: '₹',
      locale: 'en-IN',
      monthlyBudget: 35000,
      startOfWeek: 'Monday'
    }
  };

  store.users.push(newUser);
  store.currentUserId = newUser.id;
  // New real accounts start with a completely clean slate — no sample data.

  saveStorage(store);
  return { success: true, user: { id: newUser.id, name: newUser.name, email: newUser.email } };
}

/**
 * Authenticates user credentials
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{success: boolean, user?: object, error?: string}>}
 */
export async function loginUser(email, password) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !password) {
    return { success: false, error: 'Email and password are required.' };
  }

  const store = loadStorage();
  const user = store.users.find(u => u.email === cleanEmail);
  if (!user) {
    return { success: false, error: 'Account not found. Please register a new account.' };
  }

  const passwordHash = await hashString(password);
  if (user.passwordHash !== passwordHash) {
    return { success: false, error: 'Incorrect password. Please try again.' };
  }

  store.currentUserId = user.id;
  saveStorage(store);
  return { success: true, user: { id: user.id, name: user.name, email: user.email } };
}

/**
 * Signs in as a guest/demo user for instant review
 * @returns {Promise<{success: boolean, user: object}>}
 */
export async function loginDemoUser() {
  const store = loadStorage();
  let demoUser = store.users.find(u => u.email === 'demo@moneymanager.local' || u.email === 'demo@vantaledger.local');
  if (!demoUser) {
    demoUser = {
      id: 'demo_user_id',
      name: 'Demo Reviewer',
      email: 'demo@moneymanager.local',
      passwordHash: await hashString('demo1234'),
      createdAt: new Date().toISOString(),
      settings: {
        currencySymbol: '₹',
        locale: 'en-IN',
        monthlyBudget: 35000,
        startOfWeek: 'Monday'
      }
    };
    store.users.push(demoUser);

    const demoTx = SAMPLE_TRANSACTIONS.map(tx => ({
      ...tx,
      id: generateId(),
      userId: demoUser.id
    }));
    store.transactions.push(...demoTx);
  }

  store.currentUserId = demoUser.id;
  saveStorage(store);
  return { success: true, user: { id: demoUser.id, name: demoUser.name, email: demoUser.email } };
}

/**
 * Logs out the current session
 */
export function logoutUser() {
  const store = loadStorage();
  store.currentUserId = null;
  saveStorage(store);
}

/**
 * Retrieves the currently logged-in user profile
 * @returns {object|null}
 */
export function getCurrentUser() {
  const store = loadStorage();
  if (!store.currentUserId) return null;
  const user = store.users.find(u => u.id === store.currentUserId);
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    settings: user.settings || store.settings
  };
}

/* ==========================================================================
   TRANSACTIONS CRUD (SCOPED TO CURRENT USER)
   ========================================================================== */

/**
 * Returns all transactions for the logged in user
 * @returns {Array<object>}
 */
export function getUserTransactions() {
  const user = getCurrentUser();
  if (!user) return [];
  const store = loadStorage();
  // Bug fix: only return transactions explicitly belonging to this user
  return store.transactions.filter(tx => tx.userId === user.id);
}

/**
 * Adds a new transaction for the current user
 * @param {object} txData 
 * @returns {object} The created transaction
 */
export function addTransaction(txData) {
  const user = getCurrentUser();
  if (!user) throw new Error('User not logged in');

  const newTx = {
    id: generateId(),
    userId: user.id,
    type: txData.type === 'income' ? 'income' : 'expense',
    amount: Math.abs(Number(txData.amount) || 0),
    category: (txData.category || 'Other').trim(),
    date: txData.date || new Date().toISOString().split('T')[0],
    note: (txData.note || '').trim(),
    paymentMethod: (txData.paymentMethod || 'Other').trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const store = loadStorage();
  store.transactions.unshift(newTx);
  saveStorage(store);
  return newTx;
}

/**
 * Updates an existing transaction
 * @param {string} id 
 * @param {object} updates 
 * @returns {object|null}
 */
export function updateTransaction(id, updates) {
  const user = getCurrentUser();
  if (!user) throw new Error('User not logged in');

  const store = loadStorage();
  const index = store.transactions.findIndex(tx => tx.id === id && tx.userId === user.id);
  if (index === -1) return null;

  const current = store.transactions[index];
  const updatedTx = {
    ...current,
    type: updates.type === 'income' ? 'income' : 'expense',
    amount: Math.abs(Number(updates.amount) || 0),
    category: (updates.category || current.category).trim(),
    date: updates.date || current.date,
    note: (updates.note !== undefined ? updates.note : current.note).trim(),
    paymentMethod: (updates.paymentMethod !== undefined ? updates.paymentMethod : current.paymentMethod).trim(),
    updatedAt: new Date().toISOString()
  };

  store.transactions[index] = updatedTx;
  saveStorage(store);
  return updatedTx;
}

/**
 * Deletes a transaction and returns the removed item for undo support
 * @param {string} id 
 * @returns {{deletedTx: object|null, index: number}}
 */
export function deleteTransaction(id) {
  const user = getCurrentUser();
  if (!user) throw new Error('User not logged in');

  const store = loadStorage();
  const index = store.transactions.findIndex(tx => tx.id === id && tx.userId === user.id);
  if (index === -1) return { deletedTx: null, index: -1 };

  const [deletedTx] = store.transactions.splice(index, 1);
  saveStorage(store);
  return { deletedTx, index };
}

/**
 * Restores a previously deleted transaction (Undo operation)
 * @param {object} tx 
 * @param {number} originalIndex 
 */
export function restoreTransaction(tx, originalIndex = 0) {
  if (!tx) return;
  const store = loadStorage();
  const insertIndex = Math.min(Math.max(0, originalIndex), store.transactions.length);
  store.transactions.splice(insertIndex, 0, tx);
  saveStorage(store);
}

/* ==========================================================================
   SETTINGS OPERATIONS
   ========================================================================== */

/**
 * Retrieves the current user's settings (falling back to global defaults)
 * @returns {object}
 */
export function getUserSettings() {
  const user = getCurrentUser();
  const store = loadStorage();
  if (!user) return store.settings;
  const dbUser = store.users.find(u => u.id === user.id);
  return dbUser?.settings || store.settings;
}

/**
 * Updates current user settings
 * @param {object} newSettings 
 */
export function updateUserSettings(newSettings) {
  const user = getCurrentUser();
  const store = loadStorage();
  if (!user) return;

  const dbUser = store.users.find(u => u.id === user.id);
  if (dbUser) {
    dbUser.settings = {
      ...dbUser.settings,
      ...newSettings
    };
  }
  store.settings = {
    ...store.settings,
    ...newSettings
  };
  saveStorage(store);
}

/* ==========================================================================
   DATA TOOLS: CSV EXPORT, JSON IMPORT, RESET
   ========================================================================== */

/**
 * Exports current user transactions to CSV string
 * @returns {string} CSV formatted content
 */
export function exportToCSV() {
  const txs = getUserTransactions();
  const headers = ['ID', 'Type', 'Amount', 'Category', 'Date', 'PaymentMethod', 'Note', 'CreatedAt'];
  
  const rows = txs.map(tx => {
    return [
      `"${tx.id}"`,
      `"${tx.type}"`,
      tx.amount,
      `"${(tx.category || '').replace(/"/g, '""')}"`,
      `"${tx.date}"`,
      `"${(tx.paymentMethod || '').replace(/"/g, '""')}"`,
      `"${(tx.note || '').replace(/"/g, '""')}"`,
      `"${tx.createdAt || ''}"`
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Imports transactions from a JSON string with strict validation
 * @param {string} jsonString 
 * @returns {{success: boolean, importedCount: number, errorCount: number, errors: string[]}}
 */
export function importFromJSON(jsonString) {
  const user = getCurrentUser();
  if (!user) throw new Error('User not logged in');

  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    return {
      success: false,
      importedCount: 0,
      errorCount: 1,
      errors: ['Invalid JSON format: Parse error. Ensure the file contains valid JSON.']
    };
  }

  const rawList = Array.isArray(parsed) 
    ? parsed 
    : (Array.isArray(parsed.transactions) ? parsed.transactions : null);

  if (!rawList) {
    return {
      success: false,
      importedCount: 0,
      errorCount: 1,
      errors: ['JSON must contain an array of transaction objects or an object with a "transactions" array property.']
    };
  }

  const errors = [];
  const validTransactions = [];
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  rawList.forEach((item, idx) => {
    const rowNum = idx + 1;
    if (!item || typeof item !== 'object') {
      errors.push(`Row ${rowNum}: Item is not an object.`);
      return;
    }

    const type = (item.type || '').toLowerCase();
    if (type !== 'expense' && type !== 'income') {
      errors.push(`Row ${rowNum}: Invalid type "${item.type}". Must be "expense" or "income".`);
      return;
    }

    const amount = Number(item.amount);
    if (isNaN(amount) || amount <= 0) {
      errors.push(`Row ${rowNum}: Invalid amount "${item.amount}". Must be a positive number greater than 0.`);
      return;
    }

    const category = (item.category || '').trim();
    if (!category) {
      errors.push(`Row ${rowNum}: Category is required.`);
      return;
    }

    const date = (item.date || '').trim();
    if (!dateRegex.test(date)) {
      errors.push(`Row ${rowNum}: Invalid date "${item.date}". Format must be YYYY-MM-DD.`);
      return;
    }

    validTransactions.push({
      id: item.id && typeof item.id === 'string' ? item.id : generateId(),
      userId: user.id,
      type: type,
      amount: Math.round(amount * 100) / 100,
      category: category,
      date: date,
      note: typeof item.note === 'string' ? item.note.trim() : '',
      paymentMethod: typeof item.paymentMethod === 'string' ? item.paymentMethod.trim() : 'Other',
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  if (validTransactions.length === 0) {
    return {
      success: false,
      importedCount: 0,
      errorCount: errors.length,
      errors: errors.slice(0, 10) // Show first 10 errors
    };
  }

  const store = loadStorage();
  // Deduplicate against existing ids
  const existingIds = new Set(store.transactions.map(t => t.id));
  const newToAdd = validTransactions.map(tx => {
    if (existingIds.has(tx.id)) {
      return { ...tx, id: generateId() };
    }
    return tx;
  });

  store.transactions.unshift(...newToAdd);
  saveStorage(store);

  return {
    success: true,
    importedCount: newToAdd.length,
    errorCount: errors.length,
    errors: errors.slice(0, 5)
  };
}

/**
 * Resets all transaction data for the current user
 */
export function resetCurrentUserData() {
  const user = getCurrentUser();
  if (!user) return;

  const store = loadStorage();
  store.transactions = store.transactions.filter(tx => tx.userId !== user.id);
  saveStorage(store);
}
