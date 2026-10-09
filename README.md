# Apriori-Based Market Basket Analysis — Member 1 Backend

A robust Python and Flask backend implementation for **Market Basket Analysis** using the **Apriori Algorithm built 100% from scratch**.

---

## 📌 Project Overview

This project forms the core backend service (Member 1 scope) for a college Machine Learning project titled **Apriori-Based Market Basket Analysis**.

- **Dataset**: `data/raw/groceries.csv` (containing `Member_number`, `Date`, and `itemDescription`).
- **Core Functionality**:
  1. Preprocesses raw transaction records into transaction baskets by grouping items bought by the same member on the same date.
  2. Implements the complete **Apriori Algorithm from scratch** (No external libraries like `mlxtend` or `apyori`).
  3. Generates frequent itemsets based on a user-defined Minimum Support threshold.
  4. Mins association rules $(A \to B)$ and calculates **Support**, **Confidence**, and **Lift** metrics.
  5. Exposes clean RESTful API endpoints using Flask for integration with frontends or mobile clients.
  6. Implements robust input validation and error handling for bad parameters, corrupt CSVs, or missing datasets.

---

## 📁 Directory & File Structure

```text
apriori/
├── data/
│   ├── raw/
│   │   └── groceries.csv          # Real dataset (Member_number, Date, itemDescription)
│   └── processed/                 # Processed outputs directory
├── static/                        # Reserved for frontend
├── templates/                     # Reserved for HTML templates
├── config.py                      # Configuration file (Dataset paths, thresholds, Flask port)
├── apriori.py                     # Custom Apriori implementation & preprocessing logic
├── app.py                         # Flask REST API endpoints (/api/health, /api/analyze)
├── test_apriori.py                # Comprehensive Pytest test suite
├── requirements.txt               # Dependencies (Flask, pandas, pytest)
└── README.md                      # Documentation & API Guide
```

---

## ⚙️ Installation & Setup

### 1. Prerequisites
- Python 3.8 or higher.
- `pip` package manager.

### 2. Install Dependencies
Open a terminal in the project directory (`c:\Users\SK\Desktop\apriori`) and run:
```bash
pip install -r requirements.txt
```

---

## 🚀 Running the Application

### 1. Start the Flask Backend Server
```bash
python app.py
```
By default, the server starts on `http://127.0.0.1:5000`.

### 2. Verify Server Status
You can check if the API is online by visiting:
```text
http://127.0.0.1:5000/api/health
```

---

## 📡 API Reference & Testing Guide

### 1. Health Check Endpoint

- **URL**: `/api/health`
- **Method**: `GET`
- **Response**:
```json
{
  "config": {
    "dataset_exists": true,
    "dataset_path": "c:\\Users\\SK\\Desktop\\apriori\\data\\raw\\groceries.csv",
    "default_min_confidence": 0.05,
    "default_min_support": 0.001
  },
  "message": "Apriori Market Basket Analysis Backend (Member 1) is running.",
  "status": "online"
}
```

---

### 2. Analyze Market Basket Endpoint

- **URL**: `/api/analyze`
- **Method**: `POST` (or `GET` with query parameters)
- **Content-Type**: `application/json`

#### Request Parameters:

| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `min_support` | `float` | No (Default: 0.001) | Minimum support threshold ($0.0 < \text{min\_support} \le 1.0$) | `0.001` |
| `min_confidence` | `float` | No (Default: 0.05) | Minimum confidence threshold ($0.0 \le \text{min\_confidence} \le 1.0$) | `0.10` |
| `dataset_path` | `string` | No (Default: `data/raw/groceries.csv`) | Path to dataset CSV file | `"data/raw/groceries.csv"` |

---

#### Example POST Request using cURL:
```bash
curl -X POST http://127.0.0.1:5000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"min_support": 0.001, "min_confidence": 0.10}'
```

#### Example GET Request:
```text
http://127.0.0.1:5000/api/analyze?min_support=0.001&min_confidence=0.10
```

---

#### Sample JSON Output:
```json
{
  "status": "success",
  "message": "Market Basket Analysis completed successfully.",
  "dataset_info": {
    "file_path": "c:\\Users\\SK\\Desktop\\apriori\\data\\raw\\groceries.csv",
    "total_transactions": 14963,
    "unique_items": 167
  },
  "parameters": {
    "min_support": 0.001,
    "min_confidence": 0.10
  },
  "summary": {
    "total_frequent_itemsets": 120,
    "total_association_rules": 45
  },
  "frequent_itemsets": [
    {
      "items": ["whole milk"],
      "size": 1,
      "support": 0.157923
    },
    {
      "items": ["other vegetables", "whole milk"],
      "size": 2,
      "support": 0.014837
    }
  ],
  "association_rules": [
    {
      "antecedent": ["other vegetables"],
      "consequent": ["whole milk"],
      "support": 0.014837,
      "confidence": 0.100726,
      "lift": 0.637818
    }
  ]
}
```

---

## 🧪 Testing the Codebase

Unit and API tests can be executed using `pytest`:

```bash
pytest test_apriori.py -v
```

All 9 tests cover:
- Transaction grouping by `(Member_number, Date)`.
- 1-itemset ($C_1$) & $k$-itemset candidate generation ($C_k$) with join & prune steps.
- Calculation accuracy for **Support**, **Confidence**, and **Lift**.
- Flask endpoint status codes, payload parsing, and error handling.

---

## 🧮 How the Scratch Apriori Algorithm Works

### 1. Data Preprocessing & Basket Creation
Transactions are constructed by grouping rows on `Member_number` and `Date`:
$$\text{Transaction Basket} = \text{Set of items bought by Customer } M \text{ on Date } D$$
The total count of baskets $N = |\text{Transactions}|$.

### 2. Candidate Generation & Pruning ($C_k \to L_k$)
1. **$C_1$ & $L_1$ Generation**: Extract all unique individual items, calculate support, and retain itemsets where $\text{Support} \ge \text{min\_support}$.
2. **Join Step ($L_{k-1} \times L_{k-1}$)**: Join two frequent itemsets of length $(k-1)$ if their first $(k-2)$ elements match to create length-$k$ candidates.
3. **Prune Step**: Drop candidate $C$ if any of its $(k-1)$ subsets are not present in $L_{k-1}$.
4. **Frequency Count**: Count how many transactions contain candidate itemset $C$. Keep if $\text{Support}(C) \ge \text{min\_support}$.
5. **Termination**: Repeat until no new candidate itemsets can be formed ($L_k = \emptyset$).

### 3. Association Rule Mining Metrics
For each frequent itemset $I$ ($|I| \ge 2$) and non-empty subset $A \subset I$, let $B = I \setminus A$:

- **Support**: Proportion of total transactions containing both $A$ and $B$:
  $$\text{Support}(A \to B) = P(A \cup B) = \frac{\text{count}(A \cup B)}{N}$$

- **Confidence**: Probability that itemset $B$ is purchased given $A$ was purchased:
  $$\text{Confidence}(A \to B) = P(B \mid A) = \frac{\text{Support}(A \cup B)}{\text{Support}(A)}$$

- **Lift**: Measure of how much more often $A$ and $B$ occur together than expected if independent:
  $$\text{Lift}(A \to B) = \frac{\text{Confidence}(A \to B)}{\text{Support}(B)} = \frac{\text{Support}(A \cup B)}{\text{Support}(A) \times \text{Support}(B)}$$
  - $\text{Lift} > 1$: Positive association (items are bought together frequently).
  - $\text{Lift} = 1$: Independent.
  - $\text{Lift} < 1$: Negative association.
