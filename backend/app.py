from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import json
from apscheduler.schedulers.background import BackgroundScheduler
import atexit

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path)
from src.services import (run_november_scenario, run_friday_scenario, run_pe_scenario, run_dynamic_scenario,
                          run_pe_16_17, run_pe_17_18, run_pe_18_19, run_pe_19_20, 
                          run_pe_20_21, run_pe_21_22, run_pe_22_23,
                          save_custom_query, get_saved_queries, run_saved_query, run_daily_insight_generation)
from src.email_service import send_daily_email_task
from src.user_service import (
    get_all_users, get_user_by_id, get_user_by_email, create_user, 
    update_user, delete_user, get_content_types, get_enabled_content_types,
    add_preference, remove_preference, add_users_bulk, get_or_create_user
)
from flask import request

app = Flask(__name__)

# --- Background Scheduler Setup ---
def scheduled_analysis_task():
    print("Scheduler: Starting scheduled daily analysis task...")
    try:
        run_daily_insight_generation()
        print("Scheduler: Daily analysis task completed.")
    except Exception as e:
        print(f"Scheduler: Task failed with error: {e}")

scheduler = BackgroundScheduler()
# Run immediately on startup (optional, but good for testing) and then every hour
scheduler.add_job(func=scheduled_analysis_task, trigger="interval", minutes=60)
# Run daily email at 1:00 PM PST (which is 21:00 UTC or 4:00 PM EST)
# Note: This assumes the server time is UTC. If server is local, adjust accordingly.
# 13:00 PST = 16:00 EST = 21:00 UTC.
# Safe bet: 4:00 PM EST (16:00)
# Assuming server is in local time or we can use a timezone. 
# Let's just stick to hour=16 (4 PM EST / 1 PM PST) for simplicity if server is EST, or hour=21 if UTC.
# Given user is in PST (based on file paths), 13:00 is correct for local time.
scheduler.add_job(func=send_daily_email_task, trigger="cron", day_of_week='mon-fri', hour=13, minute=0)
scheduler.start()

# Shut down the scheduler when exiting the app
atexit.register(lambda: scheduler.shutdown())
# ----------------------------------

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

@app.route('/api/backtest/pe-16-17', methods=['GET'])
def backtest_pe_16_17():
    try:
        results = run_pe_16_17()
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/backtest/pe-17-18', methods=['GET'])
def backtest_pe_17_18():
    try:
        results = run_pe_17_18()
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/backtest/pe-18-19', methods=['GET'])
def backtest_pe_18_19():
    try:
        results = run_pe_18_19()
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/backtest/pe-19-20', methods=['GET'])
def backtest_pe_19_20():
    try:
        results = run_pe_19_20()
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/backtest/pe-20-21', methods=['GET'])
def backtest_pe_20_21():
    try:
        results = run_pe_20_21()
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/backtest/pe-21-22', methods=['GET'])
def backtest_pe_21_22():
    try:
        results = run_pe_21_22()
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/backtest/pe-22-23', methods=['GET'])
def backtest_pe_22_23():
    try:
        results = run_pe_22_23()
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

@app.route('/api/backtest/save', methods=['POST'])
def save_query_endpoint():
    try:
        data = request.json
        required = ['name', 'description', 'code', 'original_query']
        if not all(k in data for k in required):
            return jsonify({"error": f"Missing required fields: {required}"}), 400
            
        result = save_custom_query(
            data['name'], 
            data['description'], 
            data['code'], 
            data['original_query']
        )
        
        if "error" in result:
            return jsonify(result), 500
            
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/insights/daily', methods=['GET'])
def get_daily_insights():
    try:
        # Check for force_reset flag
        force_reset = request.args.get('force_reset', 'false').lower() == 'true'

        # CHANGED: Try to read from cache first
        cache_file = os.path.join(os.path.dirname(__file__), 'data', 'daily_analysis.json')
        
        if not force_reset and os.path.exists(cache_file):
            # You could add logic here to check file modification time 
            # and re-run if it's too old (e.g. > 24 hours)
            with open(cache_file, 'r') as f:
                analysis = json.load(f)
                return jsonify({
                    "status": "success",
                    "data": analysis,
                    "source": "cache"
                })
        
        # Fallback: Run generation if no cache exists
        analysis = run_daily_insight_generation()
        
        # Filter logic (The "Gatekeeper")
        if analysis.get('intrigue_score', 0) < 70 and not force_reset:
            return jsonify({
                "status": "skipped",
                "message": "Today was not interesting enough (Score < 70)",
                "score": analysis.get('intrigue_score'),
                "data": analysis
            })
            
        return jsonify({
            "status": "success",
            "data": analysis,
            "source": "generated"
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/backtest/saved', methods=['GET'])
def list_saved_queries():
    try:
        queries = get_saved_queries()
        return jsonify(queries)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/backtest/saved/<query_id>', methods=['GET'])
def run_saved_query_endpoint(query_id):
    try:
        results = run_saved_query(query_id)
        if "error" in results:
            status_code = 404 if results["error"] == "Query not found" else 400
            return jsonify(results), status_code
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/email/test', methods=['POST'])
def test_email():
    try:
        result = send_daily_email_task()
        if result and "error" in result:
            return jsonify(result), 500
        return jsonify({"status": "success", "message": "Email sent (check server logs for details)"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============== USER MANAGEMENT ENDPOINTS ==============

@app.route('/api/users', methods=['GET'])
def list_users():
    """Get all registered users."""
    try:
        users = get_all_users()
        return jsonify({"users": users, "count": len(users)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/users', methods=['POST'])
def create_user_endpoint():
    """
    Create a new user.
    
    Body: { "email": "...", "name": "...", "preferences": ["quantitative_analysis", ...] }
    - email is required
    - name is optional
    - preferences is optional (defaults to all enabled content types)
    """
    try:
        data = request.json
        if not data or 'email' not in data:
            return jsonify({"error": "Missing 'email' in request body"}), 400
        
        result = create_user(
            email=data['email'],
            name=data.get('name', ''),
            preferences=data.get('preferences')
        )
        
        if 'error' in result:
            return jsonify(result), 400
        
        return jsonify(result), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/auth/sync', methods=['POST'])
def auth_sync_endpoint():
    """
    Sync authentication with backend database.
    
    Called when a user logs in (dev mode or Firebase).
    Creates the user if they don't exist, returns existing user if they do.
    
    Body: { "email": "...", "name": "..." }
    """
    try:
        data = request.json
        if not data or 'email' not in data:
            return jsonify({"error": "Missing 'email' in request body"}), 400
        
        result = get_or_create_user(
            email=data['email'],
            name=data.get('name', '')
        )
        
        if 'error' in result:
            return jsonify(result), 400
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/users/bulk', methods=['POST'])
def create_users_bulk_endpoint():
    """
    Create multiple users at once.
    
    Body: { "users": [{ "email": "...", "name": "...", "preferences": [...] }, ...] }
    """
    try:
        data = request.json
        if not data or 'users' not in data:
            return jsonify({"error": "Missing 'users' array in request body"}), 400
        
        result = add_users_bulk(data['users'])
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/users/<user_id>', methods=['GET'])
def get_user_endpoint(user_id):
    """Get a specific user by ID."""
    try:
        user = get_user_by_id(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
        return jsonify(user)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/users/email/<path:email>', methods=['GET'])
def get_user_by_email_endpoint(email):
    """Get a specific user by email address."""
    try:
        user = get_user_by_email(email)
        if not user:
            return jsonify({"error": "User not found"}), 404
        return jsonify(user)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/users/<user_id>', methods=['PUT', 'PATCH'])
def update_user_endpoint(user_id):
    """
    Update a user's details.
    
    Body: { "name": "...", "preferences": [...], "active": true/false }
    All fields optional.
    """
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No update data provided"}), 400
        
        result = update_user(user_id, data)
        
        if 'error' in result:
            status_code = 404 if result['error'] == "User not found" else 400
            return jsonify(result), status_code
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/users/<user_id>', methods=['DELETE'])
def delete_user_endpoint(user_id):
    """Delete a user."""
    try:
        result = delete_user(user_id)
        
        if 'error' in result:
            return jsonify(result), 404
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/users/<user_id>/preferences', methods=['POST'])
def add_user_preference(user_id):
    """
    Add a content type preference to a user.
    
    Body: { "content_type": "quantitative_analysis" }
    """
    try:
        data = request.json
        if not data or 'content_type' not in data:
            return jsonify({"error": "Missing 'content_type' in request body"}), 400
        
        result = add_preference(user_id, data['content_type'])
        
        if 'error' in result:
            status_code = 404 if result['error'] == "User not found" else 400
            return jsonify(result), status_code
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/users/<user_id>/preferences/<content_type>', methods=['DELETE'])
def remove_user_preference(user_id, content_type):
    """Remove a content type preference from a user."""
    try:
        result = remove_preference(user_id, content_type)
        
        if 'error' in result:
            status_code = 404 if result['error'] == "User not found" else 400
            return jsonify(result), status_code
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/content-types', methods=['GET'])
def list_content_types():
    """Get all available content types."""
    try:
        content_types = get_content_types()
        enabled = get_enabled_content_types()
        return jsonify({
            "content_types": content_types,
            "enabled_types": enabled
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5001)
