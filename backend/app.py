from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path)
from src.services import run_november_scenario, run_friday_scenario, run_pe_scenario, run_dynamic_scenario
from flask import request

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

@app.route('/api/backtest/ask', methods=['POST'])
def ask_question():
    try:
        data = request.json
        if not data or 'query' not in data:
            return jsonify({"error": "Missing 'query' in request body"}), 400
            
        query = data['query']
        results = run_dynamic_scenario(query)
        
        if "error" in results:
            return jsonify(results), 400
            
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)
