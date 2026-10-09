"""
run_ui.py
---------
Entry point that serves the Member 2 dashboard UI alongside the existing API.
Registers an additional /dashboard route and starts the Flask server.
"""

from flask import render_template
from app import app
import config


@app.route("/dashboard")
def dashboard():
    return render_template("index.html")


if __name__ == "__main__":
    app.run(host=config.FLASK_HOST, port=config.FLASK_PORT, debug=config.FLASK_DEBUG)
