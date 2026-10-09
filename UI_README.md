# Market Basket Analysis — Dashboard UI (Member 2)

Interactive web dashboard for the **Apriori-Based Market Basket Analysis** ML project. This front-end layer connects to the Member 1 Flask API and provides a full-featured interface for exploring frequent itemsets and association rules discovered in grocery transaction data.

---

## Prerequisites

- **Python 3.8+**
- **pip** (Python package manager)
- The Member 1 backend must be present (app.py, apriori.py, config.py, data/)

## Setup

```bash
# Install Python dependencies (Flask + pandas, already in requirements.txt)
pip install -r requirements.txt
```

## Running the Dashboard

```bash
python run_ui.py
```

Then open your browser to: **http://127.0.0.1:5000/dashboard**

The API health-check remains available at `http://127.0.0.1:5000/api/health`.

### Changing the Port

If port 5000 is already in use:

```bash
# Windows PowerShell
$env:FLASK_PORT = "5001"
python run_ui.py

# Linux / macOS
FLASK_PORT=5001 python run_ui.py
```

---

## Sample Data Mode

For demos or when the backend is unavailable, you can use built-in sample data:

1. **Via URL**: Visit `http://127.0.0.1:5000/dashboard?sample=1`
2. **Via code**: Set `USE_SAMPLE_DATA = true` at the top of `static/script.js` (remember to set it back to `false` before committing)

When sample mode is active, a **"📦 Sample Data Mode"** badge is displayed on the page.

---

## Controls & Metrics

| Control / Metric  | Description |
|-------------------|-------------|
| **Minimum Support** | Fraction of transactions that must contain the itemset (0.005 = 0.50%). Lower values find rarer patterns but take longer. |
| **Minimum Confidence** | Given the antecedent is bought, the minimum probability the consequent is also bought. |
| **Preset buttons** | Quick-fill common parameter combinations (Fast / Balanced / Detailed). |
| **Support (%)** | How common the itemset or rule is across all transactions. |
| **Confidence (%)** | P(consequent \| antecedent). Higher = stronger predictive power. |
| **Lift** | How much more likely items co-occur vs. random chance. >1 = positive, ≈1 = none, <1 = negative. |

### Lift Badge Colours

| Badge Colour | Meaning |
|-------------|---------|
| 🟢 Green | Lift > 1.05 — Positive association |
| ⚪ Grey | Lift 0.95–1.05 — No significant association |
| 🔴 Red | Lift < 0.95 — Negative association |

---

## Features

- **Real-time parameter sync** between number inputs and range sliders
- **Client-side validation** with inline error messages
- **Loading state** with elapsed-time counter
- **Sortable tables** — click any column header to toggle ascending/descending
- **Search & filter** — text search on item names, size filter for itemsets, minimum lift for rules
- **Pagination** — 25 rows per page with Prev/Next navigation
- **CSV export** — download filtered/sorted data with proper quoting
- **Responsive layout** — works at 1440px, 768px, and 375px widths
- **Accessible** — keyboard navigation, ARIA attributes, screen-reader labels, WCAG AA contrast
- **Print stylesheet** — hides controls, shows clean results
- **LocalStorage persistence** — last used thresholds are remembered across sessions
- **AbortController** — cancels in-flight requests on re-run; enforces 120s timeout

---

## Screenshots

Save the following screenshots (1440px wide browser window) in the `screenshots/` folder:

| File | Description |
|------|-------------|
| `01_dashboard_initial.png` | Page on first load |
| `02_results_balanced.png` | Support 0.005 / confidence 0.10 (default run) |
| `03_results_detailed.png` | Support 0.001 / confidence 0.05 with tables paginated |
| `04_tables_sorted_filtered.png` | Rules sorted by lift with a search filter applied |
| `05_empty_result.png` | Very high support (info panel shown) |
| `06_validation_error.png` | Invalid input message |
| `07_backend_offline_error.png` | Server stopped |
| `08_mobile_view.png` | 375px width |

---

## Known Limitations

- **Performance at very low support**: `min_support < 0.001` can take 30+ seconds and generate thousands of results. The UI warns about this and paginates to stay responsive.
- **Backend dependency**: The dashboard requires the Flask API to be running for live analysis. Use sample mode for offline demos.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port already in use | Set `FLASK_PORT` environment variable (see above) |
| "Backend: Offline" badge | Make sure `python run_ui.py` is running |
| Slow analysis | Increase min_support (try 0.005 or higher) |
| Empty results | Lower min_support and/or min_confidence |
| Tests failing | Run `pytest test_apriori.py -v` — no UI files should affect the tests |

---

## File Structure (Member 2 additions)

```
├── run_ui.py                 # Entry point — registers /dashboard route
├── templates/
│   └── index.html            # Dashboard HTML (Jinja2 template)
├── static/
│   ├── style.css             # Complete CSS design system
│   └── script.js             # Vanilla JS application logic
├── screenshots/              # Screenshot captures
│   └── .gitkeep
└── UI_README.md              # This file
```
