import os

# Base directory of the project
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Default dataset configuration
DATASET_PATH = os.getenv(
    "DATASET_PATH",
    os.path.join(BASE_DIR, "data", "raw", "groceries.csv")
)

# Dataset column names
MEMBER_COL = "Member_number"
DATE_COL = "Date"
ITEM_COL = "itemDescription"

# Algorithm default parameters
DEFAULT_MIN_SUPPORT = 0.001
DEFAULT_MIN_CONFIDENCE = 0.05

# Flask application configuration
FLASK_HOST = os.getenv("FLASK_HOST", "127.0.0.1")
FLASK_PORT = int(os.getenv("FLASK_PORT", 5000))
FLASK_DEBUG = os.getenv("FLASK_DEBUG", "True").lower() in ["true", "1", "yes"]
