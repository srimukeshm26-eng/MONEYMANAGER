/**
 * app.js - Main Application Controller
 * Coordinates UI rendering, state management, event listeners, and native SVG charts.
 */

import {
  getCurrentUser,
  getUserTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  restoreTransaction,
  loginUser,
  registerUser,
  loginDemoUser,
  logoutUser,
  getUserSettings,
  updateUserSettings,
  exportToCSV,
  importFromJSON,
  resetCurrentUserData
} from './storage.js';

import {
  formatCurrency,
  sanitizeHTML,
  getTodayDateString,
  formatDisplayDate,
  formatGroupDate,
  debounce
} from './utils.js';

/* ==========================================================================
   APPLICATION STATE
   ========================================================================== */

const state = {
  currentView: 'dashboard', // 'dashboard' | 'transactions' | 'settings'
  selectedDate: new Date(), // Used for month navigation
  filterSearch: '',
  filterType: 'all',
  filterCategory: 'all',
  sortBy: 'date-desc',
  editingTxId: null,
  activeTxType: 'expense', // 'expense' | 'income'
  undoQueue: null, // Holds { tx, originalIndex }
  particleCleanup: null // Cleanup fn for particle animation
};

// Category palette mapping for matte dark theme
const CATEGORY_COLORS = {
  'Food & Dining': '#f59e0b',
  'Shopping': '#ec4899',
  'Housing': '#8b5cf6',
  'Transportation': '#3b82f6',
  'Utilities': '#10b981',
  'Entertainment': '#06b6d4',
  'Health': '#ef4444',
  'Salary': '#10b981',
  'Freelance': '#6366f1',
  'Investment': '#14b8a6',
  'Other': '#6b7280',
  'Other Income': '#6b7280',
  'Other Expense': '#6b7280'
};

const CATEGORY_ICONS = {
  'Food & Dining': '🍔',
  'Shopping': '🛍️',
  'Housing': '🏠',
  'Transportation': '🚗',
  'Utilities': '⚡',
  'Entertainment': '🎬',
  'Health': '💊',
  'Salary': '💼',
  'Freelance': '💻',
  'Investment': '📈',
  'Other': '🏷️',
  'Other Income': '🏷️',
  'Other Expense': '🏷️'
};

// Scoped category lists
const EXPENSE_CATEGORIES = [
  'Food & Dining', 'Shopping', 'Housing', 'Transportation',
  'Utilities', 'Entertainment', 'Health', 'Other Expense'
];

const INCOME_CATEGORIES = [
  'Salary', 'Freelance', 'Investment', 'Other Income'
];

/* ==========================================================================
   INITIALIZATION & AUTHENTICATION FLOW
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();

  const user = getCurrentUser();
  if (user) {
    // Already logged in — skip landing & auth, go straight to app
    showAppSection(user);
  } else {
    // Not logged in — show the 3D particle landing page
    showLandingSection();
  }
});

/**
 * Shows the 3D particle landing screen and starts the animation
 */
function showLandingSection() {
  const landing = document.getElementById('landing-section');
  const auth = document.getElementById('auth-section');
  const app = document.getElementById('app-section');

  if (landing) landing.style.display = 'flex';
  if (auth) auth.style.display = 'none';
  if (app) app.style.display = 'none';

  // Start particle system
  if (state.particleCleanup) state.particleCleanup();
  state.particleCleanup = initParticleSystem();
}

/**
 * Transitions from landing → auth login/register screen
 */
function showAuthSection() {
  const landing = document.getElementById('landing-section');
  const auth = document.getElementById('auth-section');

  // Stop particles to free resources
  if (state.particleCleanup) {
    state.particleCleanup();
    state.particleCleanup = null;
  }

  // Animate out landing, animate in auth
  if (landing) {
    landing.classList.add('fade-out');
    setTimeout(() => {
      landing.style.display = 'none';
      landing.classList.remove('fade-out');
    }, 600);
  }
  if (auth) {
    auth.style.display = 'flex';
    auth.style.animation = 'fadeIn 0.4s ease both';
  }
}

/**
 * Shows the main application for a logged-in user
 */
function showAppSection(user) {
  const landing = document.getElementById('landing-section');
  const auth = document.getElementById('auth-section');
  const app = document.getElementById('app-section');

  if (state.particleCleanup) {
    state.particleCleanup();
    state.particleCleanup = null;
  }

  if (landing) landing.style.display = 'none';
  if (auth) auth.style.display = 'none';
  if (app) app.style.display = 'flex';

  document.getElementById('user-display-name').textContent = user.name;
  document.getElementById('user-avatar-initials').textContent = (user.name || 'U').charAt(0).toUpperCase();

  // Sync settings into preferences tab
  const settings = getUserSettings();
  const currSelect = document.getElementById('setting-currency');
  const budgetInput = document.getElementById('setting-budget');
  const weekSelect = document.getElementById('setting-start-of-week');
  if (currSelect) currSelect.value = settings.currencySymbol || '₹';
  if (budgetInput) budgetInput.value = settings.monthlyBudget || 35000;
  if (weekSelect) weekSelect.value = settings.startOfWeek || 'Monday';

  renderAll();
}

/**
 * Legacy helper kept for calls across the file — always re-checks login state
 */
function checkAuth() {
  const user = getCurrentUser();
  if (user) {
    showAppSection(user);
  } else {
    showAuthSection();
  }
}

/* ==========================================================================
   EVENT LISTENERS SETUP
   ========================================================================== */

function setupEventListeners() {
  // --- Landing Page: Get Started → Auth ---
  document.getElementById('btn-get-started')?.addEventListener('click', () => {
    showAuthSection();
  });

  // --- Auth Tabs & Submission ---
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const btnDemoLogin = document.getElementById('btn-demo-login');
  const btnLogout = document.getElementById('btn-logout');

  tabLogin?.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabLogin.setAttribute('aria-selected', 'true');
    tabRegister.classList.remove('active');
    tabRegister.setAttribute('aria-selected', 'false');
    loginForm.style.display = 'flex';
    registerForm.style.display = 'none';
  });

  tabRegister?.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabRegister.setAttribute('aria-selected', 'true');
    tabLogin.classList.remove('active');
    tabLogin.setAttribute('aria-selected', 'false');
    registerForm.style.display = 'flex';
    loginForm.style.display = 'none';
  });

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    const errBox = document.getElementById('login-error');

    errBox.style.display = 'none';
    const res = await loginUser(email, pass);
    if (res.success) {
      checkAuth();
    } else {
      errBox.textContent = res.error || 'Authentication failed.';
      errBox.style.display = 'block';
    }
  });

  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-password').value;
    const errBox = document.getElementById('register-error');

    errBox.style.display = 'none';
    const res = await registerUser(name, email, pass);
    if (res.success) {
      checkAuth();
    } else {
      errBox.textContent = res.error || 'Registration failed.';
      errBox.style.display = 'block';
    }
  });

  btnDemoLogin?.addEventListener('click', async () => {
    await loginDemoUser();
    checkAuth();
  });

  btnLogout?.addEventListener('click', () => {
    logoutUser();
    showLandingSection();
  });

  // --- Main Navigation Tabs ---
  document.querySelectorAll('.nav-tab-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view');
      switchView(view);
    });
  });

  // Brand logo click navigates to dashboard
  document.getElementById('brand-logo-btn')?.addEventListener('click', () => {
    switchView('dashboard');
  });

  // View All button on Dashboard redirects to Transactions list
  document.getElementById('btn-view-all-tx')?.addEventListener('click', () => {
    switchView('transactions');
  });

  // --- Month Selector Controls ---
  document.getElementById('btn-prev-month')?.addEventListener('click', () => {
    state.selectedDate.setMonth(state.selectedDate.getMonth() - 1);
    renderAll();
  });

  document.getElementById('btn-next-month')?.addEventListener('click', () => {
    state.selectedDate.setMonth(state.selectedDate.getMonth() + 1);
    renderAll();
  });

  document.getElementById('btn-this-month')?.addEventListener('click', () => {
    state.selectedDate = new Date();
    renderAll();
  });

  // --- Add Transaction Modal Triggers ---
  document.getElementById('btn-open-add-modal-header')?.addEventListener('click', () => openTransactionModal());
  document.getElementById('btn-fab-add')?.addEventListener('click', () => openTransactionModal());
  document.getElementById('btn-close-tx-modal')?.addEventListener('click', closeTransactionModal);
  document.getElementById('btn-cancel-tx-modal')?.addEventListener('click', closeTransactionModal);

  // Type toggle inside modal
  const toggleExp = document.getElementById('toggle-type-expense');
  const toggleInc = document.getElementById('toggle-type-income');

  toggleExp?.addEventListener('click', () => setModalTxType('expense'));
  toggleInc?.addEventListener('click', () => setModalTxType('income'));

  // Transaction form submit
  document.getElementById('form-transaction')?.addEventListener('submit', handleTransactionSubmit);

  // --- Filter and Search Listeners ---
  const searchInput = document.getElementById('filter-search');
  searchInput?.addEventListener('input', debounce((e) => {
    state.filterSearch = e.target.value.trim().toLowerCase();
    renderTransactionsView();
  }, 200));

  document.getElementById('filter-type')?.addEventListener('change', (e) => {
    state.filterType = e.target.value;
    renderTransactionsView();
  });

  document.getElementById('filter-category')?.addEventListener('change', (e) => {
    state.filterCategory = e.target.value;
    renderTransactionsView();
  });

  document.getElementById('sort-select')?.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderTransactionsView();
  });

  document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
    state.filterSearch = '';
    state.filterType = 'all';
    state.filterCategory = 'all';
    state.sortBy = 'date-desc';
    if (searchInput) searchInput.value = '';
    const ft = document.getElementById('filter-type');
    const fc = document.getElementById('filter-category');
    const ss = document.getElementById('sort-select');
    if (ft) ft.value = 'all';
    if (fc) fc.value = 'all';
    if (ss) ss.value = 'date-desc';
    renderTransactionsView();
  });

  // --- Settings Form Submission ---
  document.getElementById('form-settings')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const currency = document.getElementById('setting-currency').value;
    const budget = Number(document.getElementById('setting-budget').value) || 0;
    const startOfWeek = document.getElementById('setting-start-of-week').value;

    updateUserSettings({
      currencySymbol: currency,
      monthlyBudget: budget,
      startOfWeek: startOfWeek
    });

    showToast('Preferences updated successfully!');
    renderAll();
  });

  // --- CSV Export ---
  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    const csvContent = exportToCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MoneyManager_Export_${getTodayDateString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Transactions exported to CSV!');
  });

  // --- JSON Import Flow ---
  const fileInput = document.getElementById('json-file-input');
  document.getElementById('btn-trigger-import-json')?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result;
      if (typeof content === 'string') {
        const result = importFromJSON(content);
        showImportSummary(result);
        renderAll();
      }
      fileInput.value = '';
    };
    reader.readAsText(file);
  });

  document.getElementById('btn-close-import-summary')?.addEventListener('click', closeImportSummary);
  document.getElementById('btn-import-summary-ok')?.addEventListener('click', closeImportSummary);

  // --- Reset All Data Flow ---
  const resetModal = document.getElementById('modal-reset');
  document.getElementById('btn-open-reset-modal')?.addEventListener('click', () => {
    resetModal?.classList.add('active');
  });

  document.getElementById('btn-close-reset-modal')?.addEventListener('click', () => {
    resetModal?.classList.remove('active');
  });

  document.getElementById('btn-cancel-reset')?.addEventListener('click', () => {
    resetModal?.classList.remove('active');
  });

  document.getElementById('btn-confirm-reset')?.addEventListener('click', () => {
    resetCurrentUserData();
    resetModal?.classList.remove('active');
    showToast('All transaction records have been reset.');
    renderAll();
  });

  // --- Global Keyboard Accessibility (ESC closes open modals) ---
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeTransactionModal();
      resetModal?.classList.remove('active');
      closeImportSummary();
    }
  });

  // Backdrop click dismiss for all modals
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });
}

/* ==========================================================================
   VIEW SWITCHING
   ========================================================================== */

function switchView(viewName) {
  state.currentView = viewName;

  document.querySelectorAll('.nav-tab-item').forEach(tab => {
    const isActive = tab.getAttribute('data-view') === viewName;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  document.querySelectorAll('.view-section').forEach(section => {
    section.classList.remove('active');
  });

  const activeSection = document.getElementById(`view-${viewName}`);
  if (activeSection) {
    activeSection.classList.add('active');
  }

  if (viewName === 'dashboard') {
    renderDashboardView();
  } else if (viewName === 'transactions') {
    renderTransactionsView();
  }
}

/* ==========================================================================
   DATA COMPUTATION & RENDERING
   ========================================================================== */

function renderAll() {
  updateMonthDisplay();
  renderDashboardView();
  renderTransactionsView();
}

function updateMonthDisplay() {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const year = state.selectedDate.getFullYear();
  const month = monthNames[state.selectedDate.getMonth()];
  const displayEl = document.getElementById('selected-month-display');
  if (displayEl) {
    displayEl.textContent = `${month} ${year}`;
  }
  const trendSub = document.getElementById('trend-subtitle');
  if (trendSub) {
    trendSub.textContent = `${month} ${year}`;
  }
}

/**
 * Filter transactions that belong to the currently selected month and year
 */
function getSelectedMonthTransactions() {
  const allTx = getUserTransactions();
  const targetYear = state.selectedDate.getFullYear();
  const targetMonth = state.selectedDate.getMonth() + 1;

  return allTx.filter(tx => {
    if (!tx.date) return false;
    const [y, m] = tx.date.split('-').map(Number);
    return y === targetYear && m === targetMonth;
  });
}

/* ==========================================================================
   DASHBOARD VIEW RENDERING
   ========================================================================== */

function renderDashboardView() {
  const settings = getUserSettings();
  const currency = settings.currencySymbol || '₹';
  const monthTx = getSelectedMonthTransactions();

  let totalIncome = 0;
  let totalExpense = 0;

  monthTx.forEach(tx => {
    if (tx.type === 'income') {
      totalIncome += tx.amount;
    } else {
      totalExpense += tx.amount;
    }
  });

  const netBalance = totalIncome - totalExpense;
  const budget = settings.monthlyBudget || 35000;
  const budgetPercent = budget > 0 ? Math.round((totalExpense / budget) * 100) : 0;
  const budgetRemaining = budget - totalExpense;

  // Update Metrics
  document.getElementById('metric-income').textContent = formatCurrency(totalIncome, currency);
  document.getElementById('metric-expense').textContent = formatCurrency(totalExpense, currency);
  
  const netEl = document.getElementById('metric-net');
  const netLabelEl = document.getElementById('metric-net-label');
  netEl.textContent = formatCurrency(Math.abs(netBalance), currency);
  if (netBalance >= 0) {
    netEl.style.color = 'var(--text-primary)';
    if (netLabelEl) netLabelEl.textContent = 'Income surplus ↑';
  } else {
    netEl.style.color = 'var(--danger)';
    if (netLabelEl) netLabelEl.textContent = 'Spending deficit ↓';
  }

  document.getElementById('metric-budget').textContent = formatCurrency(budget, currency);
  document.getElementById('metric-budget-status').textContent = `${budgetPercent}% utilized`;

  // Update Budget Progress Bar & Warning States (80% and 100%)
  const barFill = document.getElementById('budget-bar-fill');
  const badgeContainer = document.getElementById('budget-badge-container');
  const budgetSpentText = document.getElementById('budget-spent-text');
  const budgetTotalText = document.getElementById('budget-total-text');
  const budgetRemText = document.getElementById('budget-remaining-text');
  const budgetPctText = document.getElementById('budget-percentage-text');
  const budgetTrack = document.getElementById('budget-progress-track');

  budgetSpentText.textContent = formatCurrency(totalExpense, currency);
  budgetTotalText.textContent = formatCurrency(budget, currency);
  budgetRemText.textContent = budgetRemaining >= 0 
    ? `Remaining: ${formatCurrency(budgetRemaining, currency)}`
    : `Exceeded by: ${formatCurrency(Math.abs(budgetRemaining), currency)}`;
  budgetPctText.textContent = `${budgetPercent}%`;

  if (budgetTrack) {
    budgetTrack.setAttribute('aria-valuenow', String(Math.min(budgetPercent, 100)));
  }

  // Cap bar visually at 100% while displaying accurate number
  const fillWidth = Math.min(Math.max(budgetPercent, 0), 100);
  barFill.style.width = `${fillWidth}%`;

  // Clear previous warning classes
  barFill.classList.remove('warning', 'danger');

  if (budgetPercent >= 100) {
    barFill.classList.add('danger');
    badgeContainer.innerHTML = `<span class="budget-pill danger">⚠️ Over Budget (${budgetPercent}%)</span>`;
  } else if (budgetPercent >= 80) {
    barFill.classList.add('warning');
    badgeContainer.innerHTML = `<span class="budget-pill warning">⚡ Warning (${budgetPercent}%)</span>`;
  } else {
    badgeContainer.innerHTML = `<span class="budget-pill safe">✓ On Track</span>`;
  }

  // Render Charts via Native SVG
  renderCategoryDonutChart(monthTx, totalExpense, currency);
  renderTrendAreaChart(monthTx, state.selectedDate, currency);

  // Render Dashboard Recent Transactions
  renderDashboardRecentList(monthTx, currency);
}

/**
 * Native SVG Donut Chart for Category Breakdown
 */
function renderCategoryDonutChart(monthTx, totalExpense, currency) {
  const container = document.getElementById('category-chart-container');
  const legendContainer = document.getElementById('category-legend-container');
  if (!container || !legendContainer) return;

  const expenses = monthTx.filter(t => t.type === 'expense');

  if (expenses.length === 0 || totalExpense <= 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: var(--space-4);">
        <p class="empty-title">No expenses logged</p>
        <p class="empty-desc">Expenses logged for this month will appear here.</p>
      </div>`;
    legendContainer.innerHTML = '';
    return;
  }

  // Aggregate by category
  const catMap = {};
  expenses.forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + t.amount;
  });

  const sortedCats = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1]);

  // Keep top 4, combine rest as "Other"
  const segments = [];
  let otherSum = 0;
  sortedCats.forEach((entry, idx) => {
    if (idx < 4) {
      segments.push({ category: entry[0], amount: entry[1] });
    } else {
      otherSum += entry[1];
    }
  });
  if (otherSum > 0) {
    segments.push({ category: 'Other', amount: otherSum });
  }

  // SVG Donut Calculations
  const size = 180;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  const circlesSvg = segments.map((seg) => {
    const percent = seg.amount / totalExpense;
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedPercent * circumference;
    accumulatedPercent += percent;
    const color = CATEGORY_COLORS[seg.category] || '#6b7280';

    return `<circle cx="${size / 2}" cy="${size / 2}" r="${radius}" 
      fill="transparent" 
      stroke="${color}" 
      stroke-width="${strokeWidth}" 
      stroke-dasharray="${strokeDasharray}" 
      stroke-dashoffset="${strokeDashoffset}" 
      stroke-linecap="round"
      style="transition: stroke-dasharray 0.4s ease, stroke-dashoffset 0.4s ease;"
      aria-label="${sanitizeHTML(seg.category)}: ${formatCurrency(seg.amount, currency)}">
      <title>${sanitizeHTML(seg.category)}: ${formatCurrency(seg.amount, currency)} (${Math.round(percent * 100)}%)</title>
    </circle>`;
  }).join('');

  container.innerHTML = `
    <div style="position: relative; width: ${size}px; height: ${size}px; margin: 0 auto;">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform: rotate(-90deg);">
        ${circlesSvg}
      </svg>
      <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none;">
        <span style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Total</span>
        <span style="font-size: 15px; font-weight: 700; color: var(--text-primary);">${formatCurrency(totalExpense, currency)}</span>
      </div>
    </div>
  `;

  // Render Legend
  legendContainer.innerHTML = segments.map(seg => {
    const pct = Math.round((seg.amount / totalExpense) * 100);
    const color = CATEGORY_COLORS[seg.category] || '#6b7280';
    return `
      <div class="category-legend-row">
        <div style="display: flex; align-items: center;">
          <span class="legend-color-dot" style="background-color: ${color};"></span>
          <span>${sanitizeHTML(seg.category)}</span>
        </div>
        <div>
          <span style="color: var(--text-secondary); margin-right: 8px;">${pct}%</span>
          <span class="tabular-nums" style="font-weight: 600;">${formatCurrency(seg.amount, currency)}</span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Native SVG Area Trend Chart for Daily Cumulative Spending
 */
function renderTrendAreaChart(monthTx, selectedDate, currency) {
  const container = document.getElementById('trend-chart-container');
  if (!container) return;

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Bug fix: handle empty month — show a flat zero line instead of crashing
  const expensesExist = monthTx.some(t => t.type === 'expense');
  if (!expensesExist) {
    container.innerHTML = `
      <div class="empty-state" style="padding: var(--space-4);">
        <p class="empty-title" style="font-size: var(--text-sm);">No expenses this month</p>
        <p class="empty-desc">Your spending trend will appear here once you add expense transactions.</p>
      </div>`;
    return;
  }

  // Aggregate daily expenses
  const dailySpend = new Array(daysInMonth + 1).fill(0);
  monthTx.filter(t => t.type === 'expense').forEach(t => {
    const day = parseInt(t.date.split('-')[2], 10);
    if (day >= 1 && day <= daysInMonth) {
      dailySpend[day] += t.amount;
    }
  });

  const cumulativeSpend = new Array(daysInMonth + 1).fill(0);
  let maxSpend = 100;
  for (let d = 1; d <= daysInMonth; d++) {
    cumulativeSpend[d] = cumulativeSpend[d - 1] + dailySpend[d];
    if (cumulativeSpend[d] > maxSpend) maxSpend = cumulativeSpend[d];
  }

  const width = 460;
  const height = 180;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const plotW = width - paddingLeft - paddingRight;
  const plotH = height - paddingTop - paddingBottom;

  // Build points — guard against single-day month (daysInMonth === 1)
  const points = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const xRatio = daysInMonth > 1 ? (d - 1) / (daysInMonth - 1) : 0.5;
    const x = paddingLeft + xRatio * plotW;
    const y = paddingTop + plotH - (cumulativeSpend[d] / maxSpend) * plotH;
    points.push({ x, y, day: d, val: cumulativeSpend[d], daily: dailySpend[d] });
  }

  // Bug fix: handle single-point edge case for path construction
  const lineD = points.length === 1
    ? `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${(points[0].x + 1).toFixed(1)} ${points[0].y.toFixed(1)}`
    : points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaD = `${lineD} L ${points[points.length - 1].x.toFixed(1)} ${(paddingTop + plotH)} L ${points[0].x.toFixed(1)} ${(paddingTop + plotH)} Z`;

  // Grid lines
  const gridLines = [0, 0.5, 1].map(ratio => {
    const y = paddingTop + plotH * (1 - ratio);
    const labelVal = Math.round(maxSpend * ratio);
    return `
      <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="var(--border-subtle)" stroke-dasharray="3,3" />
      <text x="${paddingLeft - 8}" y="${y + 4}" fill="var(--text-muted)" font-size="10" text-anchor="end">${labelVal > 1000 ? (labelVal/1000).toFixed(1) + 'k' : labelVal}</text>
    `;
  }).join('');

  // Day indicators on x-axis (e.g. Day 1, 10, 20, end)
  const xLabels = [1, Math.floor(daysInMonth / 3), Math.floor((2 * daysInMonth) / 3), daysInMonth].map(d => {
    const p = points[d - 1];
    return `<text x="${p.x}" y="${height - 8}" fill="var(--text-muted)" font-size="10" text-anchor="middle">Day ${d}</text>`;
  }).join('');

  // Interactive hover dots
  const dotsSvg = points.map(p => `
    <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="#10b981" class="chart-dot" style="cursor: pointer;">
      <title>Day ${p.day}: Spent ${formatCurrency(p.daily, currency)} (Total: ${formatCurrency(p.val, currency)})</title>
    </circle>
  `).join('');

  container.innerHTML = `
    <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" style="overflow: visible;">
      <defs>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.32"/>
          <stop offset="100%" stop-color="#10b981" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      ${gridLines}
      ${xLabels}
      <path d="${areaD}" fill="url(#areaGradient)" />
      <path d="${lineD}" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      ${dotsSvg}
    </svg>
  `;
}

/**
 * Render recent transactions list inside Dashboard (most recent 5 across all time)
 */
function renderDashboardRecentList(monthTx, currency) {
  const container = document.getElementById('dashboard-recent-list');
  if (!container) return;

  if (monthTx.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: var(--space-6);">
        <div class="empty-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
        </div>
        <p class="empty-title">No transactions this month</p>
        <p class="empty-desc">Transactions you add for this month will appear here.</p>
      </div>`;
    return;
  }

  // Sort by date descending, then by createdAt for same-day ordering, take first 5
  const recent = [...monthTx]
    .sort((a, b) => {
      const dateDiff = new Date(b.date) - new Date(a.date);
      if (dateDiff !== 0) return dateDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    })
    .slice(0, 5);

  container.innerHTML = recent.map(tx => renderTransactionRowHTML(tx, currency)).join('');
  attachTxRowListeners(container);
}

/* ==========================================================================
   TRANSACTIONS LIST VIEW & DAY GROUPING
   ========================================================================== */

function renderTransactionsView() {
  const container = document.getElementById('transactions-grouped-container');
  if (!container) return;

  const settings = getUserSettings();
  const currency = settings.currencySymbol || '₹';
  const allTx = getUserTransactions();

  // Apply filters
  let filtered = allTx.filter(tx => {
    // Search query matches note or category
    if (state.filterSearch) {
      const matchNote = (tx.note || '').toLowerCase().includes(state.filterSearch);
      const matchCat = (tx.category || '').toLowerCase().includes(state.filterSearch);
      if (!matchNote && !matchCat) return false;
    }
    // Type filter
    if (state.filterType !== 'all' && tx.type !== state.filterType) {
      return false;
    }
    // Category filter
    if (state.filterCategory !== 'all' && tx.category !== state.filterCategory) {
      return false;
    }
    return true;
  });

  // Apply Sorting
  filtered.sort((a, b) => {
    if (state.sortBy === 'date-desc') {
      return new Date(b.date) - new Date(a.date) || b.createdAt.localeCompare(a.createdAt);
    } else if (state.sortBy === 'date-asc') {
      return new Date(a.date) - new Date(b.date) || a.createdAt.localeCompare(b.createdAt);
    } else if (state.sortBy === 'amount-desc') {
      return b.amount - a.amount;
    } else if (state.sortBy === 'amount-asc') {
      return a.amount - b.amount;
    }
    return 0;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        <p class="empty-title">No transactions found</p>
        <p class="empty-desc">No transactions matched your current filters or search terms.</p>
        <button id="btn-empty-add" class="btn btn-primary btn-sm" style="margin-top: var(--space-2);">
          + Add New Transaction
        </button>
      </div>`;
    document.getElementById('btn-empty-add')?.addEventListener('click', () => openTransactionModal());
    return;
  }

  // Group by day (YYYY-MM-DD)
  const groups = {};
  filtered.forEach(tx => {
    const d = tx.date || 'Undated';
    if (!groups[d]) {
      groups[d] = { date: d, items: [], daySubtotal: 0 };
    }
    groups[d].items.push(tx);
    if (tx.type === 'income') {
      groups[d].daySubtotal += tx.amount;
    } else {
      groups[d].daySubtotal -= tx.amount;
    }
  });

  // Render grouped HTML
  let html = '';
  Object.values(groups).forEach(group => {
    const dayLabel = formatGroupDate(group.date);
    const subtotalFormatted = formatCurrency(group.daySubtotal, currency);
    const subtotalClass = group.daySubtotal >= 0 ? 'color: var(--success);' : 'color: var(--text-secondary);';

    html += `
      <div class="tx-day-group">
        <div class="tx-day-header">
          <span class="tx-day-title">${sanitizeHTML(dayLabel)}</span>
          <span class="tx-day-subtotal tabular-nums" style="${subtotalClass}">Day Net: ${subtotalFormatted}</span>
        </div>
        <div class="tx-list">
          ${group.items.map(tx => renderTransactionRowHTML(tx, currency)).join('')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  attachTxRowListeners(container);
}

/**
 * Returns single transaction row HTML with sanitizeHTML on user inputs
 */
function renderTransactionRowHTML(tx, currency) {
  const isIncome = tx.type === 'income';
  const icon = CATEGORY_ICONS[tx.category] || '🏷️';
  const amountPrefix = isIncome ? '+' : '-';
  const amountClass = isIncome ? 'income' : 'expense';

  return `
    <div class="tx-row" data-id="${sanitizeHTML(tx.id)}">
      <div class="tx-left">
        <div class="tx-category-icon" aria-hidden="true">${icon}</div>
        <div class="tx-details">
          <div class="tx-category-name">
            <span>${sanitizeHTML(tx.category)}</span>
            ${tx.paymentMethod ? `<span class="tx-badge">${sanitizeHTML(tx.paymentMethod)}</span>` : ''}
          </div>
          <div class="tx-note" title="${sanitizeHTML(tx.note || '')}">${sanitizeHTML(tx.note || 'No description')}</div>
        </div>
      </div>

      <div class="tx-right">
        <div class="tx-amount ${amountClass} tabular-nums">
          ${amountPrefix} ${formatCurrency(tx.amount, currency)}
        </div>
        <div class="tx-actions">
          <button class="btn btn-ghost btn-icon btn-edit-tx" data-id="${sanitizeHTML(tx.id)}" title="Edit Transaction" aria-label="Edit Transaction">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn btn-ghost btn-icon btn-delete-tx" data-id="${sanitizeHTML(tx.id)}" title="Delete Transaction" aria-label="Delete Transaction">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

function attachTxRowListeners(parentElement) {
  parentElement.querySelectorAll('.btn-edit-tx').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      editTransactionById(id);
    });
  });

  parentElement.querySelectorAll('.btn-delete-tx').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      handleDeleteTransaction(id);
    });
  });
}

/* ==========================================================================
   TRANSACTION MODAL & CRUD ACTIONS
   ========================================================================== */

function openTransactionModal(editTx = null) {
  const modal = document.getElementById('modal-transaction');
  const modalTitle = document.getElementById('modal-tx-title');
  const editIdInput = document.getElementById('tx-edit-id');
  const amountInput = document.getElementById('tx-amount');
  const catSelect = document.getElementById('tx-category');
  const dateInput = document.getElementById('tx-date');
  const paySelect = document.getElementById('tx-payment-method');
  const noteInput = document.getElementById('tx-note');
  const errBox = document.getElementById('modal-tx-error');
  const currencyLabel = document.getElementById('modal-currency-label');

  const settings = getUserSettings();
  if (currencyLabel) currencyLabel.textContent = settings.currencySymbol || '₹';
  errBox.style.display = 'none';

  if (editTx) {
    state.editingTxId = editTx.id;
    modalTitle.textContent = 'Edit Transaction';
    editIdInput.value = editTx.id;
    amountInput.value = editTx.amount;
    dateInput.value = editTx.date;
    paySelect.value = editTx.paymentMethod || 'Other';
    noteInput.value = editTx.note || '';
    // IMPORTANT: set type first so the category options are populated before we set value
    setModalTxType(editTx.type);
    catSelect.value = editTx.category;
  } else {
    state.editingTxId = null;
    modalTitle.textContent = 'Add Transaction';
    editIdInput.value = '';
    amountInput.value = '';
    dateInput.value = getTodayDateString();
    paySelect.value = 'UPI / Bank';
    noteInput.value = '';
    setModalTxType('expense');
  }

  modal.classList.add('active');
  amountInput.focus();
}

function closeTransactionModal() {
  const modal = document.getElementById('modal-transaction');
  modal.classList.remove('active');
  state.editingTxId = null;
}

function setModalTxType(type) {
  state.activeTxType = type;
  const toggleExp = document.getElementById('toggle-type-expense');
  const toggleInc = document.getElementById('toggle-type-income');

  if (type === 'expense') {
    toggleExp.classList.add('active', 'expense');
    toggleInc.classList.remove('active');
  } else {
    toggleInc.classList.add('active', 'income');
    toggleExp.classList.remove('active', 'expense');
  }

  // ── Dynamically repopulate category list scoped to the chosen type ──
  const catSelect = document.getElementById('tx-category');
  if (!catSelect) return;

  const prevVal = catSelect.value; // preserve selection if re-switching
  catSelect.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.disabled = true;
  placeholder.selected = true;
  placeholder.textContent = 'Select category';
  catSelect.appendChild(placeholder);

  const cats = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const groupLabel = type === 'expense' ? 'Expenses' : 'Income';

  const group = document.createElement('optgroup');
  group.label = groupLabel;
  cats.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    group.appendChild(opt);
  });
  catSelect.appendChild(group);

  // Restore previous value if it still exists in the new list
  if (prevVal && cats.includes(prevVal)) {
    catSelect.value = prevVal;
  }
}

function editTransactionById(id) {
  const allTx = getUserTransactions();
  const tx = allTx.find(t => t.id === id);
  if (tx) {
    openTransactionModal(tx);
  }
}

function handleTransactionSubmit(e) {
  e.preventDefault();
  const amount = Number(document.getElementById('tx-amount').value);
  const category = document.getElementById('tx-category').value;
  const date = document.getElementById('tx-date').value;
  const paymentMethod = document.getElementById('tx-payment-method').value;
  const note = document.getElementById('tx-note').value;
  const errBox = document.getElementById('modal-tx-error');

  // Strict Validation
  if (isNaN(amount) || amount <= 0) {
    errBox.textContent = 'Please enter a valid amount greater than 0.';
    errBox.style.display = 'block';
    return;
  }
  if (!category) {
    errBox.textContent = 'Please choose a category.';
    errBox.style.display = 'block';
    return;
  }
  if (!date) {
    errBox.textContent = 'Please select a valid date.';
    errBox.style.display = 'block';
    return;
  }

  const payload = {
    type: state.activeTxType,
    amount: amount,
    category: category,
    date: date,
    paymentMethod: paymentMethod,
    note: note
  };

  if (state.editingTxId) {
    updateTransaction(state.editingTxId, payload);
    showToast('Transaction updated!');
  } else {
    addTransaction(payload);
    showToast('Transaction added!');
  }

  closeTransactionModal();
  renderAll();
}

/**
 * Deletes transaction with 5-second Undo Toast
 */
function handleDeleteTransaction(id) {
  const { deletedTx, index } = deleteTransaction(id);
  if (!deletedTx) return;

  // Render after deletion so the removed item disappears immediately
  renderAll();

  showToastWithUndo('Transaction deleted.', () => {
    restoreTransaction(deletedTx, index);
    renderAll();
    showToast('Transaction restored!');
  });
}

/* ==========================================================================
   TOASTS & SNACKBARS (WITH 5-SECOND UNDO SUPPORT)
   ========================================================================== */

function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${sanitizeHTML(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

function showToastWithUndo(message, onUndo) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  // Clear previous
  container.innerHTML = '';

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span>${sanitizeHTML(message)}</span>
    <button class="btn btn-secondary btn-sm" id="btn-toast-undo" style="border-color: var(--accent); color: var(--accent);">Undo</button>
    <div class="toast-progress" id="toast-progress-bar"></div>
  `;
  container.appendChild(toast);

  const progressBar = toast.querySelector('#toast-progress-bar');
  const DURATION = 5000;
  const startTime = Date.now();

  const animInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const remainingRatio = Math.max(0, 1 - (elapsed / DURATION));
    if (progressBar) {
      progressBar.style.transform = `scaleX(${remainingRatio})`;
    }
    if (elapsed >= DURATION) {
      clearInterval(animInterval);
      toast.remove();
    }
  }, 50);

  toast.querySelector('#btn-toast-undo')?.addEventListener('click', () => {
    clearInterval(animInterval);
    toast.remove();
    onUndo();
  });
}

/* ==========================================================================
   IMPORT RESULT SUMMARY MODAL
   ========================================================================== */

function showImportSummary(result) {
  const modal = document.getElementById('modal-import-summary');
  const body = document.getElementById('import-summary-body');
  if (!modal || !body) return;

  let errorListHtml = '';
  if (result.errors && result.errors.length > 0) {
    errorListHtml = `
      <div style="margin-top: var(--space-3);">
        <strong style="color: var(--danger); font-size: var(--text-xs);">Validation issues encountered:</strong>
        <ul style="font-size: var(--text-xs); color: var(--text-secondary); margin-left: 20px; margin-top: 6px;">
          ${result.errors.map(err => `<li>${sanitizeHTML(err)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  body.innerHTML = `
    <div class="alert ${result.success ? 'alert-success' : 'alert-danger'}">
      <div>
        <strong>${result.success ? 'Import Completed' : 'Import Failed'}</strong>
        <p style="margin-top: 4px;">Successfully imported ${result.importedCount} valid transaction(s).</p>
      </div>
    </div>
    ${errorListHtml}
  `;

  modal.classList.add('active');
}

function closeImportSummary() {
  document.getElementById('modal-import-summary')?.classList.remove('active');
}


/* ==========================================================================
   3D INTERACTIVE PARTICLE SYSTEM (LANDING SCREEN)
   ========================================================================== */

/**
 * Initializes a 3D interactive particle constellation on the landing canvas.
 * Particles rotate in 3D space, react to mouse movement with perspective projection,
 * and form subtle constellation connections without harsh neon effects.
 * @returns {Function} cleanup function to stop animation and release listeners
 */
function initParticleSystem() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return () => {};

  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  let animId = null;
  let width = 0;
  let height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  // 3D Camera / Perspective variables
  const fov = 400;
  let rotX = 0;
  let rotY = 0;
  let targetRotX = 0;
  let targetRotY = 0;
  let mouseX = 0;
  let mouseY = 0;
  let isMouseOver = false;

  // Particle configuration (Dense matte emerald & subtle slate constellation)
  const isMobile = window.innerWidth < 768;
  const PARTICLE_COUNT = isMobile ? 160 : Math.min(Math.max(Math.floor((window.innerWidth * window.innerHeight) / 3600), 240), 380);
  const particles = [];

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }

  resize();

  // Create dense layered 3D particle cloud
  const spreadX = Math.max(width * 0.65, 450);
  const spreadY = Math.max(height * 0.65, 350);
  const spreadZ = 600;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // 3 tiered sizes: ambient dust (50%), medium nodes (35%), primary anchors (15%)
    const randTier = Math.random();
    let baseRadius = 1.0;
    let colorType = 'muted';

    if (randTier > 0.82) {
      baseRadius = Math.random() * 1.4 + 2.0; // Anchor node
      colorType = 'accent';
    } else if (randTier > 0.45) {
      baseRadius = Math.random() * 0.8 + 1.2; // Medium node
      colorType = Math.random() > 0.5 ? 'accent' : 'muted';
    } else {
      baseRadius = Math.random() * 0.5 + 0.7; // Fine dust
      colorType = 'dust';
    }

    particles.push({
      x: (Math.random() - 0.5) * spreadX * 2,
      y: (Math.random() - 0.5) * spreadY * 2,
      z: (Math.random() - 0.5) * spreadZ * 2,
      vx: (Math.random() - 0.5) * 0.38,
      vy: (Math.random() - 0.5) * 0.38,
      vz: (Math.random() - 0.5) * 0.38,
      baseRadius,
      colorType
    });
  }

  // Mouse / Touch interaction handlers
  function handleMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    isMouseOver = true;
    const normX = (mouseX - width / 2) / (width / 2);
    const normY = (mouseY - height / 2) / (height / 2);
    targetRotY = normX * 0.35;
    targetRotX = -normY * 0.35;
  }

  function handleTouchMove(e) {
    if (e.touches && e.touches[0]) {
      handleMouseMove(e.touches[0]);
    }
  }

  function handleMouseLeave() {
    isMouseOver = false;
    targetRotX = 0;
    targetRotY = 0;
  }

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('mousemove', handleMouseMove, { passive: true });
  window.addEventListener('touchmove', handleTouchMove, { passive: true });
  window.addEventListener('mouseleave', handleMouseLeave, { passive: true });

  let lastTime = performance.now();

  function animate(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // Smooth rotational damping towards mouse interaction
    rotX += (targetRotX - rotX) * 0.04;
    rotY += (targetRotY - rotY) * 0.04;

    // Slight ambient idle drift
    rotY += 0.0008;

    ctx.clearRect(0, 0, width, height);

    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);

    const centerX = width / 2;
    const centerY = height / 2;

    const projected = [];

    // Step 1: Update and project 3D particles to 2D
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Update positions
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;

      // Wrap around 3D boundary
      if (p.x < -spreadX) p.x = spreadX;
      if (p.x > spreadX) p.x = -spreadX;
      if (p.y < -spreadY) p.y = spreadY;
      if (p.y > spreadY) p.y = -spreadY;
      if (p.z < -spreadZ) p.z = spreadZ;
      if (p.z > spreadZ) p.z = -spreadZ;

      // 3D Rotation (around Y axis then X axis)
      const x1 = p.x * cosY + p.z * sinY;
      const z1 = -p.x * sinY + p.z * cosY;

      const y2 = p.y * cosX - z1 * sinX;
      const z2 = p.y * sinX + z1 * cosX;

      // Perspective projection
      const depth = z2 + fov + 200;
      if (depth <= 10) continue; // Behind camera

      const scale = fov / depth;
      const px = centerX + x1 * scale;
      const py = centerY + y2 * scale;
      const r = Math.max(0.5, p.baseRadius * scale);
      const alpha = Math.min(Math.max((scale - 0.25) * 1.3, 0.08), 0.85);

      projected.push({
        px,
        py,
        z: z2,
        r,
        alpha,
        colorType: p.colorType,
        orig: p
      });
    }

    // Sort by depth so farther particles/lines render behind
    projected.sort((a, b) => b.z - a.z);

    // Step 2: Draw connecting lines between nearby particles with performance caching
    const maxDist = isMobile ? 85 : 100;
    const maxDistSq = maxDist * maxDist;
    ctx.lineWidth = 0.85;

    // Track connections to avoid visual clutter and maintain 60 FPS
    const connectionCounts = new Uint8Array(projected.length);

    for (let i = 0; i < projected.length; i++) {
      if (connectionCounts[i] >= 4) continue;
      const p1 = projected[i];

      for (let j = i + 1; j < projected.length; j++) {
        if (connectionCounts[j] >= 4) continue;
        const p2 = projected[j];

        const dx = p1.px - p2.px;
        if (dx > maxDist || dx < -maxDist) continue;

        const dy = p1.py - p2.py;
        if (dy > maxDist || dy < -maxDist) continue;

        const distSq = dx * dx + dy * dy;
        if (distSq < maxDistSq) {
          const dist = Math.sqrt(distSq);
          const lineAlpha = (1 - dist / maxDist) * 0.16 * Math.min(p1.alpha, p2.alpha);
          ctx.strokeStyle = p1.colorType === 'accent' || p2.colorType === 'accent'
            ? `rgba(16, 185, 129, ${lineAlpha})`
            : `rgba(156, 163, 175, ${lineAlpha * 0.8})`;
          ctx.beginPath();
          ctx.moveTo(p1.px, p1.py);
          ctx.lineTo(p2.px, p2.py);
          ctx.stroke();

          connectionCounts[i]++;
          connectionCounts[j]++;
          if (connectionCounts[i] >= 4) break;
        }
      }
    }

    // Step 3: Draw particles by tier
    for (let i = 0; i < projected.length; i++) {
      const p = projected[i];
      ctx.beginPath();
      ctx.arc(p.px, p.py, p.r, 0, Math.PI * 2);

      if (p.colorType === 'accent') {
        ctx.fillStyle = `rgba(16, 185, 129, ${p.alpha})`;
      } else if (p.colorType === 'dust') {
        ctx.fillStyle = `rgba(107, 114, 128, ${p.alpha * 0.55})`;
      } else {
        ctx.fillStyle = `rgba(156, 163, 175, ${p.alpha * 0.8})`;
      }
      ctx.fill();
    }

    animId = requestAnimationFrame(animate);
  }

  animId = requestAnimationFrame(animate);

  // Return cleanup function
  return () => {
    if (animId) cancelAnimationFrame(animId);
    window.removeEventListener('resize', resize);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('touchmove', handleTouchMove);
    window.removeEventListener('mouseleave', handleMouseLeave);
  };
}
