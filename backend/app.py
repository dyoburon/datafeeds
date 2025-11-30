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
    add_preference, remove_preference, add_users_bulk, get_or_create_user,
    get_watchlist, update_watchlist, add_to_watchlist, remove_from_watchlist,
    get_user_context, update_user_context, get_user_holdings, add_holding,
    update_holding, delete_holding, replace_all_holdings, get_full_user_profile,
    check_profile_completeness, get_cached_analysis, save_cached_analysis, 
    should_regenerate_analysis, get_cached_portfolio_news, save_cached_portfolio_news,
    should_refresh_portfolio_news
)
from src.watchlist_service import get_watchlist_for_email, get_ticker_data, calculate_portfolio_max_drawdown
from src.llm_service import LLMService
from flask import request

# Initialize LLM service for portfolio analysis
llm_service = LLMService()

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


# ============== WATCHLIST ENDPOINTS ==============

@app.route('/api/users/<user_id>/watchlist', methods=['GET'])
def get_user_watchlist(user_id):
    """Get a user's watchlist."""
    try:
        result = get_watchlist(user_id)
        
        if 'error' in result:
            return jsonify(result), 404
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/users/<user_id>/watchlist', methods=['PUT'])
def update_user_watchlist(user_id):
    """
    Replace a user's entire watchlist.
    
    Body: { "tickers": ["AAPL", "MSFT", "GOOGL"] }
    """
    try:
        data = request.json
        if not data or 'tickers' not in data:
            return jsonify({"error": "Missing 'tickers' array in request body"}), 400
        
        if not isinstance(data['tickers'], list):
            return jsonify({"error": "'tickers' must be an array"}), 400
        
        result = update_watchlist(user_id, data['tickers'])
        
        if 'error' in result:
            status_code = 404 if result['error'] == "User not found" else 400
            return jsonify(result), status_code
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/users/<user_id>/watchlist', methods=['POST'])
def add_to_user_watchlist(user_id):
    """
    Add a ticker to a user's watchlist.
    
    Body: { "ticker": "AAPL" }
    """
    try:
        data = request.json
        if not data or 'ticker' not in data:
            return jsonify({"error": "Missing 'ticker' in request body"}), 400
        
        result = add_to_watchlist(user_id, data['ticker'])
        
        if 'error' in result:
            status_code = 404 if result['error'] == "User not found" else 400
            return jsonify(result), status_code
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/users/<user_id>/watchlist/<ticker>', methods=['DELETE'])
def remove_from_user_watchlist(user_id, ticker):
    """Remove a ticker from a user's watchlist."""
    try:
        result = remove_from_watchlist(user_id, ticker)
        
        if 'error' in result:
            status_code = 404 if result['error'] == "User not found" else 400
            return jsonify(result), status_code
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/watchlist/preview', methods=['POST'])
def preview_watchlist_data():
    """
    Preview watchlist data for given tickers (for testing/preview).
    
    Body: { "tickers": ["AAPL", "MSFT"], "max_tickers": 5 }
    """
    try:
        data = request.json
        if not data or 'tickers' not in data:
            return jsonify({"error": "Missing 'tickers' in request body"}), 400
        
        max_tickers = data.get('max_tickers', 5)
        result = get_watchlist_for_email(data['tickers'], max_tickers)
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/ticker/<ticker>', methods=['GET'])
def get_ticker_info(ticker):
    """Get info and news for a single ticker."""
    try:
        result = get_ticker_data(ticker.upper())
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/portfolio/max-drawdown', methods=['POST'])
def get_portfolio_max_drawdown():
    """
    Calculate max drawdown for a portfolio using historical monthly data.
    
    Body: {
        "holdings": [
            {"ticker": "AAPL", "shares": 10, "isCash": false},
            {"ticker": "CASH", "shares": 5000, "isCash": true}
        ],
        "months": 24  // optional, default 24
    }
    
    Returns: {
        "max_drawdown": 0.15,  // 15%
        "peak_value": 50000,
        "trough_value": 42500,
        "peak_date": "2024-01-01",
        "trough_date": "2024-03-01",
        "monthly_values": [...]
    }
    """
    try:
        data = request.json
        if not data or 'holdings' not in data:
            return jsonify({"error": "Missing 'holdings' in request body"}), 400
        
        holdings = data['holdings']
        months = data.get('months', 24)
        
        result = calculate_portfolio_max_drawdown(holdings, months)
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============== USER CONTEXT ENDPOINTS ==============

@app.route('/api/users/<user_id>/context', methods=['GET'])
def get_user_context_endpoint(user_id):
    """Get a user's investment context/profile."""
    try:
        result = get_user_context(user_id)
        
        if 'error' in result:
            return jsonify(result), 404
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/users/<user_id>/context', methods=['PUT', 'PATCH'])
def update_user_context_endpoint(user_id):
    """
    Update a user's investment context/profile.
    
    Body: {
        "investment_philosophy": "...",
        "goals": "...",
        "risk_tolerance": "conservative|moderate|aggressive",
        "time_horizon": "short|medium|long",
        "income_level": "...",
        "age_range": "...",
        "investment_experience": "beginner|intermediate|advanced",
        "notes": "..."
    }
    """
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        result = update_user_context(user_id, data)
        
        if 'error' in result:
            status_code = 404 if result['error'] == "User not found" else 400
            return jsonify(result), status_code
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============== USER HOLDINGS ENDPOINTS ==============

@app.route('/api/users/<user_id>/holdings', methods=['GET'])
def get_user_holdings_endpoint(user_id):
    """Get a user's portfolio holdings."""
    try:
        result = get_user_holdings(user_id)
        
        if 'error' in result:
            return jsonify(result), 404
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/users/<user_id>/holdings', methods=['POST'])
def add_user_holding_endpoint(user_id):
    """
    Add a new holding to a user's portfolio.
    
    Body: {
        "ticker": "AAPL",
        "shares": 10,
        "cost_basis": 150.00,
        "purchase_date": "2024-01-15",
        "account_type": "taxable|ira|roth_ira|401k",
        "notes": "..."
    }
    """
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        result = add_holding(user_id, data)
        
        if 'error' in result:
            status_code = 404 if result['error'] == "User not found" else 400
            return jsonify(result), status_code
        
        return jsonify(result), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/users/<user_id>/holdings', methods=['PUT'])
def replace_user_holdings_endpoint(user_id):
    """
    Replace all holdings for a user (bulk update).
    
    Body: {
        "holdings": [
            {"ticker": "AAPL", "shares": 10, "cost_basis": 150.00, ...},
            {"ticker": "MSFT", "shares": 5, ...}
        ]
    }
    """
    try:
        data = request.json
        if not data or 'holdings' not in data:
            return jsonify({"error": "Missing 'holdings' array"}), 400
        
        result = replace_all_holdings(user_id, data['holdings'])
        
        if 'error' in result:
            status_code = 404 if result['error'] == "User not found" else 400
            return jsonify(result), status_code
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/users/<user_id>/holdings/<int:holding_id>', methods=['PUT', 'PATCH'])
def update_user_holding_endpoint(user_id, holding_id):
    """Update a specific holding."""
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        result = update_holding(user_id, holding_id, data)
        
        if 'error' in result:
            status_code = 404 if "not found" in result['error'].lower() else 400
            return jsonify(result), status_code
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/users/<user_id>/holdings/<int:holding_id>', methods=['DELETE'])
def delete_user_holding_endpoint(user_id, holding_id):
    """Delete a specific holding."""
    try:
        result = delete_holding(user_id, holding_id)
        
        if 'error' in result:
            status_code = 404 if "not found" in result['error'].lower() else 400
            return jsonify(result), status_code
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/users/<user_id>/profile', methods=['GET'])
def get_full_profile_endpoint(user_id):
    """Get complete user profile including context, holdings, and preferences."""
    try:
        result = get_full_user_profile(user_id)
        
        if 'error' in result:
            return jsonify(result), 404
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============== AI PORTFOLIO ANALYSIS ENDPOINTS ==============

@app.route('/api/users/<user_id>/profile-completeness', methods=['GET'])
def get_profile_completeness_endpoint(user_id):
    """
    Check if user has completed all required profile sections for AI analysis.
    
    Required sections:
    1. Investment Philosophy & Goals
    2. Knowledge Assessment (at least 4 categories)
    3. Current Portfolio (at least 1 holding)
    """
    try:
        result = check_profile_completeness(user_id)
        
        if 'error' in result and result.get('error') == "User not found":
            return jsonify(result), 404
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/users/<user_id>/portfolio-analysis', methods=['GET'])
def get_portfolio_analysis_endpoint(user_id):
    """
    Get AI-powered portfolio analysis with intelligent caching.
    
    This endpoint:
    1. Checks if user profile is complete (returns error if not)
    2. Returns cached analysis if profile hasn't changed
    3. Regenerates analysis if profile changed and cooldown (5 min) passed
    4. Returns cached analysis with 'stale' flag if in cooldown
    
    Query params:
        force_refresh: 'true' to force regeneration (ignores cooldown)
    
    Returns: AI-generated analysis with:
        - Overall assessment
        - Portfolio themes  
        - Allocation recommendations (with Kelly sizing)
        - New investment ideas based on secular trends
        - Macro considerations
        - Key risks and mitigations
    """
    try:
        # Check profile completeness first
        completeness = check_profile_completeness(user_id)
        
        if 'error' in completeness:
            return jsonify(completeness), 404
        
        if not completeness.get('is_complete'):
            return jsonify({
                "status": "incomplete_profile",
                "message": "Please complete your profile before generating analysis",
                "completeness": completeness
            }), 400
        
        # Check if we should regenerate
        force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
        regen_check = should_regenerate_analysis(user_id, cooldown_minutes=5)
        
        # Return cached if available and no regeneration needed
        if not force_refresh and not regen_check.get('should_regenerate'):
            cached = regen_check.get('cached_analysis', {})
            return jsonify({
                "status": "success",
                "source": "cache",
                "analysis": cached.get('analysis'),
                "generated_at": cached.get('generated_at'),
                "profile_changed": regen_check.get('profile_changed', False),
                "cooldown_remaining_minutes": regen_check.get('cooldown_remaining_minutes'),
                "user_id": user_id
            })
        
        # Need to regenerate - get user profile
        user_profile_data = get_full_user_profile(user_id)
        
        if 'error' in user_profile_data:
            return jsonify(user_profile_data), 404
        
        user_context = user_profile_data.get('context', {})
        holdings = user_profile_data.get('holdings', [])
        
        # Build portfolio data
        portfolio_data = {
            'holdings': holdings,
            'total_value': 0,
            'portfolio_beta': 1.0,
            'sector_allocation': {},
            'equities_percent': 100,
            'bonds_percent': 0,
            'cash_percent': 0
        }
        
        # Get today's market analysis from cache
        market_analysis = None
        cache_file = os.path.join(os.path.dirname(__file__), 'data', 'daily_analysis.json')
        if os.path.exists(cache_file):
            try:
                with open(cache_file, 'r') as f:
                    market_analysis = json.load(f)
            except Exception as e:
                print(f"Could not load market analysis: {e}")
        
        # Load secular trends
        secular_trends = ""
        trends_file = os.path.join(os.path.dirname(__file__), 'secular_trends.txt')
        if os.path.exists(trends_file):
            try:
                with open(trends_file, 'r') as f:
                    secular_trends = f.read()
            except Exception as e:
                print(f"Could not load secular trends: {e}")
        
        # Generate AI analysis
        analysis = llm_service.generate_portfolio_analysis(
            user_profile=user_context,
            portfolio_data=portfolio_data,
            market_analysis=market_analysis,
            secular_trends=secular_trends
        )
        
        if 'error' in analysis:
            # Return cached if available, even on error
            cached = regen_check.get('cached_analysis')
            if cached and cached.get('analysis'):
                return jsonify({
                    "status": "success",
                    "source": "cache_fallback",
                    "analysis": cached.get('analysis'),
                    "generated_at": cached.get('generated_at'),
                    "generation_error": analysis.get('error'),
                    "user_id": user_id
                })
            return jsonify(analysis), 500
        
        # Save to cache
        save_cached_analysis(user_id, analysis)
        
        return jsonify({
            "status": "success",
            "source": "generated",
            "analysis": analysis,
            "generated_at": analysis.get('generated_at'),
            "user_id": user_id,
            "holdings_count": len(holdings)
        })
        
    except Exception as e:
        print(f"Portfolio analysis error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/users/<user_id>/portfolio-analysis', methods=['POST'])
def update_portfolio_analysis_endpoint(user_id):
    """
    Force regenerate portfolio analysis with additional portfolio data.
    
    Body (optional): {
        "portfolio_data": {
            "total_value": 100000,
            "holdings": [...],
            "sector_allocation": {...},
            "portfolio_beta": 1.2,
            "equities_percent": 80,
            "bonds_percent": 10,
            "cash_percent": 10
        }
    }
    """
    try:
        # Check profile completeness
        completeness = check_profile_completeness(user_id)
        
        if 'error' in completeness:
            return jsonify(completeness), 404
        
        if not completeness.get('is_complete'):
            return jsonify({
                "status": "incomplete_profile",
                "message": "Please complete your profile before generating analysis",
                "completeness": completeness
            }), 400
        
        # Get user profile
        user_profile_data = get_full_user_profile(user_id)
        
        if 'error' in user_profile_data:
            return jsonify(user_profile_data), 404
        
        user_context = user_profile_data.get('context', {})
        holdings = user_profile_data.get('holdings', [])
        
        # Get portfolio data from request body or use defaults
        request_data = request.json or {}
        portfolio_data = request_data.get('portfolio_data', {})
        
        if not portfolio_data.get('holdings'):
            portfolio_data['holdings'] = holdings
        
        # Get today's market analysis
        market_analysis = None
        cache_file = os.path.join(os.path.dirname(__file__), 'data', 'daily_analysis.json')
        if os.path.exists(cache_file):
            try:
                with open(cache_file, 'r') as f:
                    market_analysis = json.load(f)
            except Exception as e:
                print(f"Could not load market analysis: {e}")
        
        # Load secular trends
        secular_trends = ""
        trends_file = os.path.join(os.path.dirname(__file__), 'secular_trends.txt')
        if os.path.exists(trends_file):
            try:
                with open(trends_file, 'r') as f:
                    secular_trends = f.read()
            except Exception as e:
                print(f"Could not load secular trends: {e}")
        
        # Generate AI analysis
        analysis = llm_service.generate_portfolio_analysis(
            user_profile=user_context,
            portfolio_data=portfolio_data,
            market_analysis=market_analysis,
            secular_trends=secular_trends
        )
        
        if 'error' in analysis:
            return jsonify(analysis), 500
        
        # Save to cache
        save_cached_analysis(user_id, analysis)
        
        return jsonify({
            "status": "success",
            "source": "generated",
            "analysis": analysis,
            "generated_at": analysis.get('generated_at'),
            "user_id": user_id,
            "holdings_count": len(holdings)
        })
        
    except Exception as e:
        print(f"Portfolio analysis error: {e}")
        return jsonify({"error": str(e)}), 500


# ============== PORTFOLIO NEWS ENDPOINT ==============

@app.route('/api/users/<user_id>/portfolio-news', methods=['GET'])
def get_portfolio_news_endpoint(user_id):
    """
    Get news and AI analysis for each stock in the user's portfolio.
    
    Uses caching - news is only refreshed once daily unless force_refresh=true.
    
    Query params:
        force_refresh: 'true' to force refresh (bypass 24hr cache)
    
    Returns:
        List of stocks with headlines and AI-generated analysis
    """
    try:
        force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
        
        # Check if we should use cached data
        if not force_refresh:
            refresh_check = should_refresh_portfolio_news(user_id)
            
            if not refresh_check.get('should_refresh') and refresh_check.get('cached_news'):
                cached = refresh_check['cached_news']
                return jsonify({
                    "status": "success",
                    "source": "cache",
                    "stocks": cached['news'].get('stocks', []),
                    "count": cached['news'].get('count', 0),
                    "generated_at": cached.get('generated_at'),
                    "hours_since_refresh": refresh_check.get('hours_since_refresh'),
                    "next_refresh_in_hours": round(24 - refresh_check.get('hours_since_refresh', 0), 1) if refresh_check.get('hours_since_refresh') else None
                })
        
        # Get user holdings
        holdings_result = get_user_holdings(user_id)
        
        if 'error' in holdings_result:
            return jsonify(holdings_result), 404
        
        holdings = holdings_result.get('holdings', [])
        
        if not holdings:
            return jsonify({
                "status": "success",
                "stocks": [],
                "message": "No holdings in portfolio"
            })
        
        # Get unique tickers (exclude cash)
        tickers = list(set([
            h['ticker'] for h in holdings 
            if h['ticker'].upper() not in ['CASH', '$CASH']
        ]))
        
        if not tickers:
            return jsonify({
                "status": "success",
                "stocks": [],
                "message": "No stocks in portfolio (only cash)"
            })
        
        # Fetch news data for all tickers
        from src.watchlist_service import get_ticker_data
        import concurrent.futures
        
        stock_data = []
        
        # Fetch data in parallel
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            future_to_ticker = {
                executor.submit(get_ticker_data, ticker): ticker 
                for ticker in tickers
            }
            
            for future in concurrent.futures.as_completed(future_to_ticker):
                try:
                    data = future.result()
                    stock_data.append(data)
                except Exception as e:
                    ticker = future_to_ticker[future]
                    stock_data.append({
                        "ticker": ticker,
                        "name": ticker,
                        "error": str(e)
                    })
        
        # Sort by ticker
        stock_data.sort(key=lambda x: x.get('ticker', ''))
        
        # Analyze news for each stock with AI
        analyzed_stocks = []
        
        for stock in stock_data:
            ticker = stock.get('ticker', '')
            company_name = stock.get('name', ticker)
            news = stock.get('news', [])
            perf = stock.get('performance', {})
            
            # Debug logging
            print(f"[Portfolio News] {ticker}: {len(news)} news items, price: {perf.get('current_price')}")
            
            # Get top 3 headlines
            headlines = [n.get('title', '') for n in news[:3] if n.get('title')]
            
            # Get price data
            price_data = {
                'price': perf.get('current_price'),
                'change': perf.get('change'),
                'change_percent': perf.get('change_percent')
            }
            
            # Analyze with AI
            analysis = llm_service.analyze_stock_news(
                ticker=ticker,
                company_name=company_name,
                headlines=headlines,
                price_data=price_data
            )
            
            analyzed_stocks.append({
                "ticker": ticker,
                "company_name": company_name,
                "sector": stock.get('sector', 'Unknown'),
                "price": price_data.get('price'),
                "change": price_data.get('change'),
                "change_percent": price_data.get('change_percent'),
                "headlines": headlines,
                "news_count": len(news),
                "analysis": {
                    "summary": analysis.get('summary', ''),
                    "sentiment": analysis.get('sentiment', 'neutral'),
                    "key_themes": analysis.get('key_themes', []),
                    "price_context": analysis.get('price_context', ''),
                    "notable_headline": analysis.get('notable_headline', '')
                },
                "error": stock.get('error') or analysis.get('error')
            })
        
        generated_at = __import__('datetime').datetime.now().isoformat()
        
        # Save to cache
        news_data = {
            "stocks": analyzed_stocks,
            "count": len(analyzed_stocks)
        }
        save_cached_portfolio_news(user_id, news_data)
        
        return jsonify({
            "status": "success",
            "source": "generated",
            "stocks": analyzed_stocks,
            "count": len(analyzed_stocks),
            "generated_at": generated_at,
            "hours_since_refresh": 0,
            "next_refresh_in_hours": 24
        })
        
    except Exception as e:
        print(f"Portfolio news error: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5001)
