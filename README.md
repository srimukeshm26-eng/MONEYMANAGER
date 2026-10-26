<!--
PLAN & ARCHITECTURAL OVERVIEW
================================================================================
1. Objective:
   Build a production-quality, responsive, offline-capable expense tracker web app
   using vanilla HTML5, CSS3, and modern JavaScript (ES2020+, no frameworks).
2. Architecture:
   - index.html: Semantic layout, accessible dialog modals, high-contrast matte surfaces.
   - styles.css: Tokenized matte-black design system adhering to 4/8-pt spacing, ARIA focus rings, and reduced motion.
   - storage.js: Versioned schema ("expenseTracker:data"), safe migrations, multi-user authentication (SHA-256 password hashing), CRUD methods, CSV/JSON data tools, and corrupted data recovery.
   - utils.js: XSS sanitization, Intl.NumberFormat currency formatting, ISO date helpers, and debouncing.
   - app.js: Modular application controller, native SVG chart rendering (Donut + Area trends), day-grouping with subtotals, filtering, sorting, 5-second undo toast, and keyboard accessibility.
================================================================================
-->

# Money Manager — Obsidian Matte Expense Tracker

> A distraction-free, privacy-first personal expense tracker engineered for effortless financial clarity.

---

## 1. Brand Guidelines & Design Tokens

### Name & Logo
- **Product Name:** **Money Manager**
- **Logo Badge:** **MM** inside the matte emerald container.
- **Tagline:** *Distraction-free, matte-black financial clarity.*

### Brand Summary
- **Personality Adjectives:** Precise, Calm, Trustworthy, Restrained, Obsidian.
- **What It Should Never Feel Like:** Cluttered, Garish/Fluorescent, Gamified/Cartoony.
- **Positioning Statement:** VantaLedger provides mobile-first, privacy-respecting financial tracking for mindful individuals who demand speed, tactile elegance, and zero cognitive load.

### Color System (Hex)
| Token | Value | Purpose |
| :--- | :--- | :--- |
| `--bg-base` | `#111215` | Lowest canvas layer, true matte obsidian |
| `--bg-surface` | `#18191e` | Cards, forms, navigation headers |
| `--bg-elevated` | `#22232a` | Modals, dropdown menus, hover states |
| `--border-subtle` | `#272832` | Structural dividers, subtle containment |
| `--border-medium` | `#363745` | Hovered card outlines and form inputs |
| `--text-primary` | `#f3f4f6` | High-contrast body and heading copy |
| `--text-secondary`| `#9ca3af` | Secondary labels, timestamps, badges |
| `--text-muted` | `#6b7280` | Footers, hints, disabled indicators |
| `--accent` | `#10b981` | Emerald green: primary actions, income, highlights |
| `--success` | `#10b981` | Positive cashflow and healthy budget state |
| `--warning` | `#f59e0b` | 80% budget consumption alert |
| `--danger` | `#ef4444` | Negative cashflow, budget exceeded (>100%), destructive |

### Typography
- **Primary Font:** [Inter](https://fonts.google.com/specimen/Inter) (`sans-serif` system fallback).
- **Numeric Font:** `tabular-nums` with monospaced numeral styling (`JetBrains Mono` / `SF Mono`).
- **Scale:**
  - `H1`: 24px (1.5rem) / Semi-bold (700)
  - `H2`: 20px (1.25rem) / Semi-bold (600)
  - `Body`: 16px (1.0rem) / Regular (400)
  - `Small / Labels`: 12px (0.75rem) / Medium (500)

### Spacing & Components
- **Base Grid:** 4px / 8px scale (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `40px`).
- **Border Radii:** `6px` for controls, `12px` for cards, `16px` for modals, `9999px` for pills.
- **Buttons:** High-contrast primary emerald (`#10b981`), matte secondary (`#22232a`), ghost, and danger.
- **Inputs:** Dark recessed base (`#111215`) with subtle border, 2px emerald focus glow ring.

### Design Tokens (CSS Variables)
```css
:root {
  --bg-base: #111215;
  --bg-surface: #18191e;
  --bg-elevated: #22232a;
  --border-subtle: #272832;
  --border-medium: #363745;
  --border-focus: #10b981;
  --text-primary: #f3f4f6;
  --text-secondary: #9ca3af;
  --text-muted: #6b7280;
  --accent: #10b981;
  --accent-hover: #059669;
  --accent-subtle: rgba(16, 185, 129, 0.12);
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-full: 9999px;
}
```

### Design Tokens (JSON Format)
```json
{
  "color": {
    "background": {
      "base": "#111215",
      "surface": "#18191e",
      "elevated": "#22232a"
    },
    "border": {
      "subtle": "#272832",
      "medium": "#363745",
      "focus": "#10b981"
    },
    "text": {
      "primary": "#f3f4f6",
      "secondary": "#9ca3af",
      "muted": "#6b7280"
    },
    "brand": {
      "accent": "#10b981",
      "accentHover": "#059669"
    },
    "semantic": {
      "success": "#10b981",
      "warning": "#f59e0b",
      "danger": "#ef4444"
    }
  },
  "radii": {
    "sm": "8px",
    "md": "12px",
    "lg": "16px",
    "full": "9999px"
  }
}
```

---

## 2. Features

1. **User Authentication & Session Management:**
   - Multi-user support with client-side credential persistence.
   - SHA-256 password hashing via Web Crypto API.
   - One-Click Demo Account for immediate review with realistic sample transactions.
2. **Transactions CRUD:**
   - Add/Edit transactions with type (Expense/Income), decimal amount, category, date, payment method, and note.
   - 5-second Undo Snackbar upon transaction deletion.
   - Strict validation: amount > 0, valid ISO date, category required.
3. **Monthly Financial Dashboard:**
   - Real-time summary cards: Total Income, Total Expenses, Net Balance, Monthly Budget.
   - Native SVG Category Donut Chart with percentages and breakdown legend.
   - Native SVG Daily Cumulative Spend Area Trend Chart.
   - Month-by-month historical navigation (Prev, Next, Current Month).
4. **Grouped Transactions View:**
   - Grouped by day with daily net subtotal calculations.
   - Real-time instant search across notes and categories.
   - Filters by transaction type (All / Expense / Income) and Category.
   - Sorting by Date (Newest/Oldest) and Amount (High/Low).
5. **Budget Tracking & Alerts:**
   - Configurable monthly spending target.
   - Real-time progress bar.
   - Visual alerts at 80% threshold (Warning) and 100% threshold (Exceeded Alert).
6. **Data Portability & Settings:**
   - Export transactions directly to standard CSV.
   - Import transactions from JSON with schema validation and error feedback.
   - Currency symbol selector (₹ INR default, $, €, £, ¥, etc.) with `Intl.NumberFormat`.
   - Complete data reset with confirmation modal.
7. **Accessibility & Responsive Polish:**
   - ARIA labels and roles (`progressbar`, `dialog`, `tablist`).
   - Focus trap and ESC key dismiss on all dialogs.
   - Mobile Floating Action Button (FAB) + responsive desktop header.
   - Respects `prefers-reduced-motion`.

---

## 3. How to Run

1. **Directly in Browser:**
   - Simply double click or open [index.html](file:///c:/Users/M%20SRI%20MUKESH/Downloads/iota%20x%20enigma/index.html) in Google Chrome, Microsoft Edge, Mozilla Firefox, or Safari.
2. **Via Local Static Server (Optional):**
   ```bash
   # Python 3
   python -m http.server 8080

   # Or npx
   npx serve .
   ```
   Open `http://localhost:8080` in your browser.

---

## 4. Data Schema & Storage Versioning

Storage is maintained in browser `localStorage` under the key:
`expenseTracker:data`

### Schema Structure (Version 1)
```json
{
  "version": 1,
  "currentUserId": "user_id_string",
  "users": [
    {
      "id": "uuid_string",
      "name": "Alex Mercer",
      "email": "alex@example.com",
      "passwordHash": "sha256_hex_digest",
      "createdAt": "2026-10-26T18:00:00.000Z",
      "settings": {
        "currencySymbol": "₹",
        "locale": "en-IN",
        "monthlyBudget": 35000,
        "startOfWeek": "Monday"
      }
    }
  ],
  "settings": {
    "currencySymbol": "₹",
    "locale": "en-IN",
    "monthlyBudget": 35000,
    "startOfWeek": "Monday"
  },
  "transactions": [
    {
      "id": "tx_uuid",
      "userId": "user_id_string",
      "type": "expense",
      "amount": 1250.50,
      "category": "Food & Dining",
      "date": "2026-10-26",
      "note": "Dinner with team",
      "paymentMethod": "UPI / Bank",
      "createdAt": "2026-10-26T18:00:00.000Z",
      "updatedAt": "2026-10-26T18:00:00.000Z"
    }
  ]
}
```

### Migration Safety
The `migrate(oldData)` function inspects `oldData.version`:
- If `version < 1`, it injects defaults for `users`, `settings`, and `transactions` without discarding existing records.
- Corrupted JSON or parsing failures are caught and restored safely without breaking the user experience.

---

## 5. Manual Test Checklist (Step-by-Step)

| Test Case | Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- |
| **1. Authentication** | Open `index.html`. Click "One-Click Demo Account". | App logs in immediately, displays demo dashboard with sample data. | Pass |
| **2. New User Registration** | Log out, click "Create Account", enter name, email, password (>6 chars), click submit. | Account created, session starts with fresh data. | Pass |
| **3. Add Transaction** | Click "+ Add Transaction". Select "Expense", enter amount `1500`, category "Food & Dining", date today, note "Groceries", click "Save". | Modal closes, transaction appears in list, metrics update immediately. | Pass |
| **4. Edit Transaction** | In Transactions tab, click edit (pencil) icon on an item. Change amount to `2000`, save. | Updated amount reflects immediately across cards, charts, and group subtotal. | Pass |
| **5. Delete with Undo** | Click delete (trash) icon on any transaction. | Item disappears, 5-second progress toast appears with "Undo". Clicking Undo restores item. | Pass |
| **6. Budget Warning** | Go to Data & Settings, set Monthly Target Budget to `5000`. Return to Dashboard. | Progress bar shifts to warning/danger color (>80% or >100%) with alert badge. | Pass |
| **7. Filters & Search** | Go to Transactions tab. Type search keyword into box. Change Category dropdown. | List updates instantly without full reload; shows grouped days or clear empty state. | Pass |
| **8. CSV Export** | Go to Data & Settings, click "Export Transactions (CSV)". | `VantaLedger_Export_YYYY-MM-DD.csv` downloads with correct headers and escaping. | Pass |
| **9. JSON Import** | Click "Select JSON File to Import", provide valid or invalid JSON. | Summary dialog shows count of valid items and readable error summary for invalid rows. | Pass |
| **10. Accessibility & ESC** | Press "+ Add Transaction", then press the `Escape` key on your keyboard. | Modal closes cleanly, focus returns safely to page. | Pass |

---

## 6. Future Improvements

1. **WebAuthn / Biometric Login:** Support fingerprint/FaceID on mobile browsers using the Web Authentication API.
2. **Recurring Subscriptions:** Automated scheduler for monthly recurring bills (rent, streaming services).
3. **Multi-Currency Conversion:** Offline cache of foreign exchange rates for traveling users.
4. **PWA (Progressive Web App):** Web app manifest and service worker for home screen installability and zero-network caching.
