"""
app.py
------
Flask REST API for Market Basket Analysis using custom Apriori Algorithm.
Exposes endpoints to inspect server status and calculate frequent itemsets & association rules.
"""

from flask import Flask, request, jsonify
import os
import config
from apriori import run_apriori, load_and_preprocess_data

app = Flask(__name__)


@app.route("/", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health_check():
    """
    Health check endpoint returning application status and dataset readiness.
    """
    dataset_exists = os.path.exists(config.DATASET_PATH)
    return jsonify({
        "status": "online",
        "message": "Apriori Market Basket Analysis Backend (Member 1) is running.",
        "config": {
            "dataset_path": config.DATASET_PATH,
            "dataset_exists": dataset_exists,
            "default_min_support": config.DEFAULT_MIN_SUPPORT,
            "default_min_confidence": config.DEFAULT_MIN_CONFIDENCE
        }
    }), 200


@app.route("/api/analyze", methods=["GET", "POST"])
def analyze():
    """
    Main Market Basket Analysis API endpoint.

    Accepts min_support, min_confidence, and optional dataset_path via:
    - JSON Body (for POST requests)
    - Query Parameters (for GET requests)

    Returns:
        JSON response with dataset metrics, frequent itemsets, and association rules.
    """
    # Parse inputs from JSON body or query parameters
    if request.method == "POST" and request.is_json:
        data = request.get_json() or {}
    else:
        data = request.args.to_dict()

    raw_min_support = data.get("min_support", config.DEFAULT_MIN_SUPPORT)
    raw_min_confidence = data.get("min_confidence", config.DEFAULT_MIN_CONFIDENCE)
    dataset_path = data.get("dataset_path", config.DATASET_PATH)

    # 1. Input Validation - Numerical parsing & ranges
    try:
        min_support = float(raw_min_support)
    except (ValueError, TypeError):
        return jsonify({
            "status": "error",
            "message": f"Invalid min_support value '{raw_min_support}'. Must be a number greater than 0.0 and <= 1.0."
        }), 400

    try:
        min_confidence = float(raw_min_confidence)
    except (ValueError, TypeError):
        return jsonify({
            "status": "error",
            "message": f"Invalid min_confidence value '{raw_min_confidence}'. Must be a number between 0.0 and 1.0."
        }), 400

    if not (0.0 < min_support <= 1.0):
        return jsonify({
            "status": "error",
            "message": "min_support threshold must be greater than 0.0 and less than or equal to 1.0."
        }), 400

    if not (0.0 <= min_confidence <= 1.0):
        return jsonify({
            "status": "error",
            "message": "min_confidence threshold must be between 0.0 and 1.0."
        }), 400

    # 2. Check dataset file existence
    if not os.path.exists(dataset_path):
        return jsonify({
            "status": "error",
            "message": f"Dataset file not found at '{dataset_path}'. Please check the path configuration."
        }), 404

    # 3. Execute Apriori analysis
    try:
        results = run_apriori(
            file_path=dataset_path,
            min_support=min_support,
            min_confidence=min_confidence
        )

        # Informative note if no itemsets/rules match the thresholds
        if results["summary"]["total_frequent_itemsets"] == 0:
            results["message"] = "No frequent itemsets were found at the specified min_support threshold. Try lowering min_support."
        elif results["summary"]["total_association_rules"] == 0:
            results["message"] = "Frequent itemsets were found, but no association rules satisfied min_confidence. Try lowering min_confidence."
        else:
            results["message"] = "Market Basket Analysis completed successfully."

        return jsonify(results), 200

    except FileNotFoundError as fnf_err:
        return jsonify({"status": "error", "message": str(fnf_err)}), 404

    except ValueError as val_err:
        return jsonify({"status": "error", "message": str(val_err)}), 400

    except Exception as err:
        return jsonify({"status": "error", "message": f"An unexpected error occurred during execution: {str(err)}"}), 500


if __name__ == "__main__":
    print(f"Starting Flask App on {config.FLASK_HOST}:{config.FLASK_PORT}")
    app.run(
        host=config.FLASK_HOST,
        port=config.FLASK_PORT,
        debug=config.FLASK_DEBUG
    )
