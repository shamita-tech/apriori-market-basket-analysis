"""
apriori.py
----------
Custom implementation of the Apriori Algorithm for Market Basket Analysis from scratch.
This module does NOT rely on external Apriori libraries (like mlxtend or apyori).

It preprocesses grocery transaction data, mines frequent itemsets, and generates
association rules with Support, Confidence, and Lift metrics.
"""

import os
import itertools
from collections import Counter
import pandas as pd
from typing import List, Dict, Set, FrozenSet, Tuple, Any


def load_and_preprocess_data(
    file_path: str,
    member_col: str = "Member_number",
    date_col: str = "Date",
    item_col: str = "itemDescription"
) -> Tuple[List[frozenset], int]:
    """
    Reads a CSV dataset and preprocesses transactions by grouping items
    purchased together by the same member on the same date.

    Args:
        file_path (str): Path to the CSV file.
        member_col (str): Column name for member ID.
        date_col (str): Column name for transaction date.
        item_col (str): Column name for item description.

    Returns:
        Tuple[List[frozenset], int]: A tuple containing:
            - List of transaction baskets (each basket is a frozenset of items)
            - Total number of unique items in the dataset
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Dataset file not found at path: {file_path}")

    try:
        df = pd.read_csv(file_path)
    except Exception as e:
        raise ValueError(f"Unable to parse CSV file: {str(e)}")

    required_cols = [member_col, date_col, item_col]
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        raise ValueError(f"CSV dataset is missing required column(s): {', '.join(missing_cols)}")

    # Clean missing values and format string types
    df = df.dropna(subset=required_cols)
    df[item_col] = df[item_col].astype(str).str.strip()
    df = df[df[item_col] != ""]

    if df.empty:
        raise ValueError("Dataset contains no valid transaction rows after preprocessing.")

    # Group by Member_number and Date to create transaction baskets
    grouped = df.groupby([member_col, date_col])[item_col].apply(lambda items: frozenset(items))
    transactions = grouped.tolist()

    # Filter out empty baskets if any
    transactions = [t for t in transactions if len(t) > 0]
    total_unique_items = len(df[item_col].unique())

    return transactions, total_unique_items


def get_single_items(transactions: List[frozenset]) -> Set[frozenset]:
    """
    Extracts all 1-itemset candidates (C1) from transactions.
    """
    c1 = set()
    for transaction in transactions:
        for item in transaction:
            c1.add(frozenset([item]))
    return c1


def calculate_supports(
    candidates: Set[frozenset],
    transactions: List[frozenset],
    total_txns: int
) -> Dict[frozenset, float]:
    """
    Calculates support for a set of candidate itemsets across all transactions.

    Support(Itemset) = (Number of transactions containing Itemset) / (Total Transactions)
    """
    if not candidates or total_txns == 0:
        return {}

    # Determine candidate size (k)
    sample_candidate = next(iter(candidates))
    k = len(sample_candidate)

    # Filter transactions to only those long enough to contain a candidate of size k
    eligible_txns = [t for t in transactions if len(t) >= k]

    supports = {}
    for candidate in candidates:
        count = sum(1 for t in eligible_txns if candidate.issubset(t))
        supports[candidate] = count / total_txns

    return supports


def generate_c_k(frequent_k_minus_1: Set[frozenset], k: int) -> Set[frozenset]:
    """
    Candidate Generation (C_k from L_{k-1}):
    1. Join Step: Join L_{k-1} itemsets that share the first (k-2) items.
    2. Prune Step: Ensure all (k-1) subsets of the new candidate exist in L_{k-1}.

    Args:
        frequent_k_minus_1 (Set[frozenset]): Set of frequent itemsets of size (k-1).
        k (int): Size of the target candidate itemsets.

    Returns:
        Set[frozenset]: Generated candidate itemsets of size k.
    """
    candidates = set()
    itemsets_list = list(frequent_k_minus_1)

    # Join Step
    for i in range(len(itemsets_list)):
        for j in range(i + 1, len(itemsets_list)):
            itemset1 = itemsets_list[i]
            itemset2 = itemsets_list[j]

            union_set = itemset1.union(itemset2)
            if len(union_set) == k:
                # Prune Step: Check if all (k-1) subsets are present in L_{k-1}
                all_subsets_frequent = True
                for subset in itertools.combinations(union_set, k - 1):
                    if frozenset(subset) not in frequent_k_minus_1:
                        all_subsets_frequent = False
                        break
                if all_subsets_frequent:
                    candidates.add(union_set)

    return candidates


def generate_frequent_itemsets(
    transactions: List[frozenset],
    min_support: float
) -> Tuple[Dict[int, Dict[frozenset, float]], Dict[frozenset, float]]:
    """
    Main Apriori algorithm loop to find all frequent itemsets meeting min_support.

    Returns:
        Tuple[Dict[int, Dict[frozenset, float]], Dict[frozenset, float]]:
            - frequent_by_level: Dict mapping level k to {itemset: support}
            - itemset_supports: Flattened dict of all frequent itemsets and their support
    """
    total_txns = len(transactions)
    if total_txns == 0:
        return {}, {}

    frequent_by_level = {}
    itemset_supports = {}

    # Step 1: Generate C1 & L1 efficiently using Counter
    item_counter = Counter()
    for t in transactions:
        item_counter.update(t)

    l1 = {}
    for item, count in item_counter.items():
        sup = count / total_txns
        if sup >= min_support:
            itemset = frozenset([item])
            l1[itemset] = sup

    if not l1:
        return {}, {}

    frequent_by_level[1] = l1
    itemset_supports.update(l1)

    k = 2
    current_l = set(l1.keys())

    # Step 2: Iteratively find L_k until no more frequent itemsets are found
    while current_l:
        ck = generate_c_k(current_l, k)
        if not ck:
            break

        supports_ck = calculate_supports(ck, transactions, total_txns)
        lk = {itemset: sup for itemset, sup in supports_ck.items() if sup >= min_support}

        if not lk:
            break

        frequent_by_level[k] = lk
        itemset_supports.update(lk)
        current_l = set(lk.keys())
        k += 1

    return frequent_by_level, itemset_supports


def generate_association_rules(
    itemset_supports: Dict[frozenset, float],
    min_confidence: float
) -> List[Dict[str, Any]]:
    """
    Generates association rules (A -> B) from frequent itemsets of size >= 2.

    Metrics:
        - Support(A -> B) = Support(A U B)
        - Confidence(A -> B) = Support(A U B) / Support(A)
        - Lift(A -> B) = Confidence(A -> B) / Support(B)

    Args:
        itemset_supports (Dict[frozenset, float]): Dictionary of frequent itemsets and supports.
        min_confidence (float): Minimum confidence threshold.

    Returns:
        List[Dict[str, Any]]: List of association rules sorted by Lift descending.
    """
    rules = []

    for itemset, support_itemset in itemset_supports.items():
        if len(itemset) < 2:
            continue

        items = list(itemset)
        # Generate all non-empty proper subsets as antecedents (A)
        for r in range(1, len(items)):
            for antecedent_tuple in itertools.combinations(items, r):
                antecedent = frozenset(antecedent_tuple)
                consequent = itemset.difference(antecedent)

                support_antecedent = itemset_supports.get(antecedent)
                support_consequent = itemset_supports.get(consequent)

                if support_antecedent and support_consequent:
                    confidence = support_itemset / support_antecedent
                    if confidence >= min_confidence:
                        lift = confidence / support_consequent
                        rules.append({
                            "antecedent": sorted(list(antecedent)),
                            "consequent": sorted(list(consequent)),
                            "support": round(support_itemset, 6),
                            "confidence": round(confidence, 6),
                            "lift": round(lift, 6)
                        })

    # Sort rules by Lift descending, then Confidence descending
    rules.sort(key=lambda x: (x["lift"], x["confidence"]), reverse=True)
    return rules


def run_apriori(
    file_path: str,
    min_support: float,
    min_confidence: float
) -> Dict[str, Any]:
    """
    Executes the complete Market Basket Analysis workflow:
    1. Loads and preprocesses CSV data.
    2. Runs Apriori to find frequent itemsets.
    3. Generates association rules.

    Args:
        file_path (str): Path to CSV dataset.
        min_support (float): Support threshold between 0 and 1.
        min_confidence (float): Confidence threshold between 0 and 1.

    Returns:
        Dict[str, Any]: Analysis summary containing parameters, metrics,
                        frequent itemsets, and association rules.
    """
    if not (0.0 < min_support <= 1.0):
        raise ValueError("min_support must be a float greater than 0.0 and less than or equal to 1.0.")

    if not (0.0 <= min_confidence <= 1.0):
        raise ValueError("min_confidence must be a float between 0.0 and 1.0.")

    transactions, unique_items_count = load_and_preprocess_data(file_path)
    total_txns = len(transactions)

    frequent_by_level, itemset_supports = generate_frequent_itemsets(transactions, min_support)
    rules = generate_association_rules(itemset_supports, min_confidence)

    # Format frequent itemsets for clean JSON serialization
    formatted_itemsets = []
    for level, level_dict in frequent_by_level.items():
        for itemset, sup in level_dict.items():
            formatted_itemsets.append({
                "items": sorted(list(itemset)),
                "size": level,
                "support": round(sup, 6)
            })

    # Sort itemsets by size then support descending
    formatted_itemsets.sort(key=lambda x: (x["size"], -x["support"]))

    return {
        "status": "success",
        "dataset_info": {
            "file_path": file_path,
            "total_transactions": total_txns,
            "unique_items": unique_items_count
        },
        "parameters": {
            "min_support": min_support,
            "min_confidence": min_confidence
        },
        "summary": {
            "total_frequent_itemsets": len(formatted_itemsets),
            "total_association_rules": len(rules)
        },
        "frequent_itemsets": formatted_itemsets,
        "association_rules": rules
    }
