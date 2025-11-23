from flask import Flask, jsonify
from flask_cors import CORS
from src.services import run_november_scenario, run_friday_scenario, run_pe_scenario

app = Flask(__name__)
# Allow CORS for all domains on all routes starting with /api/*
CORS(app, resources={r"/api/*": {"origins": "*"}})

@app.route('/api/status', methods=['GET'])
def status():
    return jsonify({"status": "ok", "message": "Backtester API is running"})

@app.route('/api/backtest/november', methods=['GET'])
def backtest_november():
    try:
        results = run_november_scenario()
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/backtest/friday', methods=['GET'])
def backtest_friday():
    try:
        results = run_friday_scenario()
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/backtest/pe', methods=['GET'])
def backtest_pe():
    try:
        results = run_pe_scenario()
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)
