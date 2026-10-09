"""
test_apriori.py
---------------
Unit and integration tests for custom Apriori implementation and Flask REST API.
"""

import os
import tempfile
import pytest
import pandas as pd
from apriori import (
    load_and_preprocess_data,
    get_single_items,
    calculate_supports,
    generate_c_k,
    generate_frequent_itemsets,
    generate_association_rules,
    run_apriori
)
from app import app


@pytest.fixture
def sample_csv_file():
    """
    Creates a temporary CSV file with sample transaction data.
    """
    data = """Member_number,Date,itemDescription
1001,01-01-2023,milk
1001,01-01-2023,bread
1001,01-01-2023,butter
1002,01-01-2023,milk
1002,01-01-2023,bread
1003,02-01-2023,milk
1003,02-01-2023,butter
1004,02-01-2023,bread
"""
    with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".csv") as temp_file:
        temp_file.write(data)
        temp_path = temp_file.name

    yield temp_path

    if os.path.exists(temp_path):
        os.remove(temp_path)


@pytest.fixture
def flask_client():
    """
    Flask test client fixture.
    """
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


# --- Core Apriori Unit Tests ---

def test_preprocessing(sample_csv_file):
    """
    Tests loading and transaction grouping logic.
    """
    transactions, unique_count = load_and_preprocess_data(sample_csv_file)
    assert len(transactions) == 4  # 4 unique (Member_number, Date) combinations
    assert unique_count == 3       # milk, bread, butter

    # Transaction 1001 on 01-01-2023 should have 3 items
    assert frozenset(["milk", "bread", "butter"]) in transactions


def test_candidate_generation_and_support():
    """
    Tests 1-itemset generation and support calculation.
    """
    transactions = [
        frozenset(["milk", "bread"]),
        frozenset(["milk", "butter"]),
        frozenset(["bread", "butter"]),
        frozenset(["milk", "bread", "butter"])
    ]
    c1 = get_single_items(transactions)
    assert len(c1) == 3

    supports = calculate_supports(c1, transactions, len(transactions))
    # 'milk' appears in 3 out of 4 transactions -> support = 0.75
    assert supports[frozenset(["milk"])] == 0.75


def test_ck_generation():
    """
    Tests candidate join and pruning step.
    """
    l1 = {
        frozenset(["milk"]),
        frozenset(["bread"]),
        frozenset(["butter"])
    }
    c2 = generate_c_k(l1, 2)
    assert len(c2) == 3
    assert frozenset(["milk", "bread"]) in c2


def test_apriori_frequent_itemsets(sample_csv_file):
    """
    Tests complete frequent itemset generation on sample dataset.
    """
    transactions, _ = load_and_preprocess_data(sample_csv_file)
    frequent_by_level, supports = generate_frequent_itemsets(transactions, min_support=0.5)

    # milk (3/4=0.75), bread (3/4=0.75), butter (2/4=0.5)
    # {milk, bread} (2/4=0.5), {milk, butter} (2/4=0.5)
    assert 1 in frequent_by_level
    assert 2 in frequent_by_level
    assert frozenset(["milk", "bread"]) in supports
    assert supports[frozenset(["milk", "bread"])] == 0.5


def test_association_rules_metrics():
    """
    Verifies Support, Confidence, and Lift metric formulas.
    """
    # Suppose total_txns = 4
    # Support({milk}) = 0.75, Support({bread}) = 0.75, Support({milk, bread}) = 0.5
    itemset_supports = {
        frozenset(["milk"]): 0.75,
        frozenset(["bread"]): 0.75,
        frozenset(["milk", "bread"]): 0.5
    }

    rules = generate_association_rules(itemset_supports, min_confidence=0.5)
    assert len(rules) == 2  # milk -> bread and bread -> milk

    rule = next(r for r in rules if r["antecedent"] == ["milk"])
    assert rule["consequent"] == ["bread"]
    assert rule["support"] == 0.5
    # Confidence(milk -> bread) = 0.5 / 0.75 = 0.666667
    assert round(rule["confidence"], 4) == 0.6667
    # Lift = Confidence / Support(bread) = (0.5/0.75) / 0.75 = 0.888889
    assert round(rule["lift"], 4) == 0.8889


# --- Flask API Endpoint Tests ---

def test_health_check_endpoint(flask_client):
    """
    Tests /api/health endpoint response.
    """
    response = flask_client.get("/api/health")
    assert response.status_code == 200
    json_data = response.get_json()
    assert json_data["status"] == "online"


def test_analyze_endpoint_valid(flask_client, sample_csv_file):
    """
    Tests /api/analyze endpoint with valid input parameters.
    """
    payload = {
        "min_support": 0.25,
        "min_confidence": 0.5,
        "dataset_path": sample_csv_file
    }
    response = flask_client.post("/api/analyze", json=payload)
    assert response.status_code == 200
    json_data = response.get_json()

    assert json_data["status"] == "success"
    assert "frequent_itemsets" in json_data
    assert "association_rules" in json_data
    assert json_data["summary"]["total_frequent_itemsets"] > 0


def test_analyze_endpoint_invalid_support(flask_client):
    """
    Tests /api/analyze endpoint validation for invalid min_support.
    """
    payload = {"min_support": -0.5, "min_confidence": 0.5}
    response = flask_client.post("/api/analyze", json=payload)
    assert response.status_code == 400
    json_data = response.get_json()
    assert json_data["status"] == "error"


def test_analyze_endpoint_missing_file(flask_client):
    """
    Tests /api/analyze endpoint handling for non-existent dataset.
    """
    payload = {
        "min_support": 0.01,
        "min_confidence": 0.1,
        "dataset_path": "non_existent_file.csv"
    }
    response = flask_client.post("/api/analyze", json=payload)
    assert response.status_code == 404
    json_data = response.get_json()
    assert json_data["status"] == "error"
