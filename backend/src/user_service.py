"""
User Management Service

Handles user storage, preferences, and content type subscriptions.
Users can subscribe to different content types for their daily emails.

Uses SQLite for persistent storage.
"""

import os
import sqlite3
import uuid
from datetime import datetime
from typing import List, Dict, Optional
from contextlib import contextmanager

# Path to SQLite database
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'users.db')

# Define available content types
# This is the central registry of all email content types
CONTENT_TYPES = {
    "quantitative_analysis": {
        "id": "quantitative_analysis",
        "name": "Quantitative Analysis",
        "description": "AI-generated backtested questions and statistical analysis of market conditions.",
        "enabled": True
    },
    "headlines": {
        "id": "headlines",
        "name": "Market Headlines",
        "description": "Curated daily news headlines and market-moving events.",
        "enabled": True
    },
    "market_overview": {
        "id": "market_overview",
        "name": "Market Overview",
        "description": "Daily summary of major indices, sector performance, and key metrics.",
        "enabled": True
    },
    "watchlist_news": {
        "id": "watchlist_news",
        "name": "Watchlist Updates",
        "description": "Daily news and performance updates for stocks in your personal watchlist.",
        "enabled": True
    },
    "portfolio_news": {
        "id": "portfolio_news",
        "name": "Portfolio News",
        "description": "AI-analyzed news and price movements for your top portfolio holdings.",
        "enabled": True
    },
}


def _init_db():
    """Initialize the database and create tables if they don't exist."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        
        # Users table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT DEFAULT '',
                active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        ''')
        
        # User preferences table (many-to-many between users and content types)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_preferences (
                user_id TEXT NOT NULL,
                content_type TEXT NOT NULL,
                PRIMARY KEY (user_id, content_type),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')
        
        # User watchlist table (stocks the user wants to track)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_watchlist (
                user_id TEXT NOT NULL,
                ticker TEXT NOT NULL,
                added_at TEXT NOT NULL,
                PRIMARY KEY (user_id, ticker),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')
        
        # Create index for faster email lookups
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
        ''')
        
        # Create index for watchlist lookups
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_watchlist_user ON user_watchlist(user_id)
        ''')
        
        # User context table (investment profile, philosophy, goals)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_context (
                user_id TEXT PRIMARY KEY,
                investment_philosophy TEXT DEFAULT '',
                goals TEXT DEFAULT '',
                risk_tolerance TEXT DEFAULT 'moderate',
                time_horizon TEXT DEFAULT 'medium',
                income_level TEXT DEFAULT '',
                age_range TEXT DEFAULT '',
                investment_experience TEXT DEFAULT 'beginner',
                knowledge_assessment TEXT DEFAULT '{}',
                notes TEXT DEFAULT '',
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')
        
        # Add knowledge_assessment column if it doesn't exist (migration)
        try:
            cursor.execute("ALTER TABLE user_context ADD COLUMN knowledge_assessment TEXT DEFAULT '{}'")
        except:
            pass  # Column already exists
        
        # User portfolio holdings table (actual portfolio positions)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_holdings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                ticker TEXT NOT NULL,
                shares REAL NOT NULL,
                cost_basis REAL,
                purchase_date TEXT,
                account_type TEXT DEFAULT 'taxable',
                notes TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')
        
        # Create index for holdings lookups
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_holdings_user ON user_holdings(user_id)
        ''')
        
        # Cached AI analysis table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_ai_analysis (
                user_id TEXT PRIMARY KEY,
                analysis_json TEXT DEFAULT '{}',
                generated_at TEXT NOT NULL,
                profile_hash TEXT DEFAULT '',
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')
        
        # Cached portfolio news table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_portfolio_news (
                user_id TEXT PRIMARY KEY,
                news_json TEXT DEFAULT '{}',
                generated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')
        
        conn.commit()


# Initialize database on module load
_init_db()


@contextmanager
def _get_db():
    """Context manager for database connections."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Return rows as dict-like objects
    conn.execute("PRAGMA foreign_keys = ON")  # Enable foreign key constraints
    try:
        yield conn
    finally:
        conn.close()


def _row_to_user(row: sqlite3.Row, preferences: List[str] = None, watchlist: List[str] = None) -> Dict:
    """Convert a database row to a user dictionary."""
    return {
        "id": row["id"],
        "email": row["email"],
        "name": row["name"] or "",
        "active": bool(row["active"]),
        "preferences": preferences if preferences is not None else [],
        "watchlist": watchlist if watchlist is not None else [],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"]
    }


def _get_user_preferences(conn: sqlite3.Connection, user_id: str) -> List[str]:
    """Get all preferences for a user."""
    cursor = conn.cursor()
    cursor.execute("SELECT content_type FROM user_preferences WHERE user_id = ?", (user_id,))
    return [row[0] for row in cursor.fetchall()]


def _get_user_watchlist(conn: sqlite3.Connection, user_id: str) -> List[str]:
    """Get all watchlist tickers for a user."""
    cursor = conn.cursor()
    cursor.execute("SELECT ticker FROM user_watchlist WHERE user_id = ? ORDER BY added_at", (user_id,))
    return [row[0] for row in cursor.fetchall()]


def get_all_users() -> List[Dict]:
    """Get all registered users with their preferences and watchlist."""
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users ORDER BY created_at DESC")
        rows = cursor.fetchall()
        
        users = []
        for row in rows:
            preferences = _get_user_preferences(conn, row["id"])
            watchlist = _get_user_watchlist(conn, row["id"])
            users.append(_row_to_user(row, preferences, watchlist))
        
        return users


def get_user_by_id(user_id: str) -> Optional[Dict]:
    """Get a specific user by ID."""
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        
        if not row:
            return None
        
        preferences = _get_user_preferences(conn, user_id)
        watchlist = _get_user_watchlist(conn, user_id)
        return _row_to_user(row, preferences, watchlist)


def get_user_by_email(email: str) -> Optional[Dict]:
    """Get a specific user by email address."""
    email = email.strip().lower()
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE LOWER(email) = ?", (email,))
        row = cursor.fetchone()
        
        if not row:
            return None
        
        preferences = _get_user_preferences(conn, row["id"])
        watchlist = _get_user_watchlist(conn, row["id"])
        return _row_to_user(row, preferences, watchlist)


def get_or_create_user(email: str, name: str = "", preferences: Optional[List[str]] = None) -> Dict:
    """
    Get an existing user by email or create a new one if they don't exist.
    
    This is useful for auth flows where we want to ensure a user exists in the database.
    
    Returns:
        Dict with user data and a 'created' boolean indicating if this is a new user.
    """
    existing = get_user_by_email(email)
    
    if existing:
        return {**existing, "created": False}
    
    # Create new user
    result = create_user(email, name, preferences)
    
    if 'error' in result:
        return result
    
    return {**result, "created": True}


def create_user(email: str, name: str = "", preferences: Optional[List[str]] = None) -> Dict:
    """
    Create a new user with email and optional preferences.
    
    Args:
        email: User's email address (required, must be unique)
        name: User's display name (optional)
        preferences: List of content type IDs to subscribe to.
                    Defaults to all enabled content types if not specified.
    
    Returns:
        The created user object, or error dict if failed.
    """
    email = email.strip().lower()
    
    # Validate email
    if not email or '@' not in email:
        return {"error": "Invalid email address"}
    
    # Check for duplicates
    if get_user_by_email(email):
        return {"error": "User with this email already exists"}
    
    # Default preferences: subscribe to all enabled content types
    if preferences is None:
        preferences = [ct_id for ct_id, ct in CONTENT_TYPES.items() if ct.get('enabled', False)]
    else:
        # Validate provided preferences
        valid_types = set(CONTENT_TYPES.keys())
        preferences = [p for p in preferences if p in valid_types]
    
    user_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    
    try:
        with _get_db() as conn:
            cursor = conn.cursor()
            
            # Insert user
            cursor.execute('''
                INSERT INTO users (id, email, name, active, created_at, updated_at)
                VALUES (?, ?, ?, 1, ?, ?)
            ''', (user_id, email, name.strip() if name else "", now, now))
            
            # Insert preferences
            for pref in preferences:
                cursor.execute('''
                    INSERT INTO user_preferences (user_id, content_type)
                    VALUES (?, ?)
                ''', (user_id, pref))
            
            conn.commit()
            
            return {
                "id": user_id,
                "email": email,
                "name": name.strip() if name else "",
                "preferences": preferences,
                "watchlist": [],
                "active": True,
                "created_at": now,
                "updated_at": now
            }
    except sqlite3.IntegrityError as e:
        return {"error": f"Database error: {str(e)}"}
    except Exception as e:
        return {"error": f"Failed to create user: {str(e)}"}


def update_user(user_id: str, updates: Dict) -> Dict:
    """
    Update user details.
    
    Allowed fields: name, preferences, active
    """
    user = get_user_by_id(user_id)
    if not user:
        return {"error": "User not found"}
    
    now = datetime.now().isoformat()
    
    try:
        with _get_db() as conn:
            cursor = conn.cursor()
            
            # Update basic fields
            if 'name' in updates:
                cursor.execute(
                    "UPDATE users SET name = ?, updated_at = ? WHERE id = ?",
                    (updates['name'].strip(), now, user_id)
                )
            
            if 'active' in updates:
                cursor.execute(
                    "UPDATE users SET active = ?, updated_at = ? WHERE id = ?",
                    (1 if updates['active'] else 0, now, user_id)
                )
            
            if 'preferences' in updates:
                valid_types = set(CONTENT_TYPES.keys())
                new_prefs = [p for p in updates['preferences'] if p in valid_types]
                
                # Delete existing preferences
                cursor.execute("DELETE FROM user_preferences WHERE user_id = ?", (user_id,))
                
                # Insert new preferences
                for pref in new_prefs:
                    cursor.execute(
                        "INSERT INTO user_preferences (user_id, content_type) VALUES (?, ?)",
                        (user_id, pref)
                    )
                
                cursor.execute(
                    "UPDATE users SET updated_at = ? WHERE id = ?",
                    (now, user_id)
                )
            
            conn.commit()
            
            # Return updated user
            return get_user_by_id(user_id)
            
    except Exception as e:
        return {"error": f"Failed to update user: {str(e)}"}


def delete_user(user_id: str) -> Dict:
    """Delete a user by ID."""
    try:
        with _get_db() as conn:
            cursor = conn.cursor()
            
            # Check if user exists
            cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
            if not cursor.fetchone():
                return {"error": "User not found"}
            
            # Delete preferences first (foreign key)
            cursor.execute("DELETE FROM user_preferences WHERE user_id = ?", (user_id,))
            
            # Delete user
            cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
            
            conn.commit()
            
            return {"success": True, "message": "User deleted"}
            
    except Exception as e:
        return {"error": f"Failed to delete user: {str(e)}"}


def get_users_by_content_type(content_type_id: str) -> List[Dict]:
    """
    Get all active users subscribed to a specific content type.
    
    This is the main function used by email services to determine
    who should receive a particular type of email.
    """
    if content_type_id not in CONTENT_TYPES:
        return []
    
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT u.* FROM users u
            JOIN user_preferences p ON u.id = p.user_id
            WHERE u.active = 1 AND p.content_type = ?
        ''', (content_type_id,))
        
        rows = cursor.fetchall()
        
        users = []
        for row in rows:
            preferences = _get_user_preferences(conn, row["id"])
            watchlist = _get_user_watchlist(conn, row["id"])
            users.append(_row_to_user(row, preferences, watchlist))
        
        return users


def get_content_types() -> Dict:
    """Get all available content types and their details."""
    return CONTENT_TYPES


def get_enabled_content_types() -> List[Dict]:
    """Get only content types that are currently enabled/implemented."""
    return [ct for ct in CONTENT_TYPES.values() if ct.get('enabled', False)]


def add_preference(user_id: str, content_type_id: str) -> Dict:
    """Add a content type preference to a user."""
    if content_type_id not in CONTENT_TYPES:
        return {"error": f"Invalid content type: {content_type_id}"}
    
    user = get_user_by_id(user_id)
    if not user:
        return {"error": "User not found"}
    
    try:
        with _get_db() as conn:
            cursor = conn.cursor()
            
            # Check if already exists
            cursor.execute(
                "SELECT 1 FROM user_preferences WHERE user_id = ? AND content_type = ?",
                (user_id, content_type_id)
            )
            
            if not cursor.fetchone():
                cursor.execute(
                    "INSERT INTO user_preferences (user_id, content_type) VALUES (?, ?)",
                    (user_id, content_type_id)
                )
                cursor.execute(
                    "UPDATE users SET updated_at = ? WHERE id = ?",
                    (datetime.now().isoformat(), user_id)
                )
                conn.commit()
            
            return get_user_by_id(user_id)
            
    except Exception as e:
        return {"error": f"Failed to add preference: {str(e)}"}


def remove_preference(user_id: str, content_type_id: str) -> Dict:
    """Remove a content type preference from a user."""
    user = get_user_by_id(user_id)
    if not user:
        return {"error": "User not found"}
    
    try:
        with _get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM user_preferences WHERE user_id = ? AND content_type = ?",
                (user_id, content_type_id)
            )
            cursor.execute(
                "UPDATE users SET updated_at = ? WHERE id = ?",
                (datetime.now().isoformat(), user_id)
            )
            conn.commit()
            
            return get_user_by_id(user_id)
            
    except Exception as e:
        return {"error": f"Failed to remove preference: {str(e)}"}


# Convenience function for bulk operations
def add_users_bulk(user_list: List[Dict]) -> Dict:
    """
    Add multiple users at once.
    
    Args:
        user_list: List of dicts with 'email', optional 'name', optional 'preferences'
    
    Returns:
        Summary of results
    """
    results = {
        "created": [],
        "errors": []
    }
    
    for user_data in user_list:
        email = user_data.get('email', '')
        name = user_data.get('name', '')
        preferences = user_data.get('preferences')
        
        result = create_user(email, name, preferences)
        
        if 'error' in result:
            results['errors'].append({"email": email, "error": result['error']})
        else:
            results['created'].append(result)
    
    return results


def get_user_count() -> int:
    """Get the total number of users."""
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users")
        return cursor.fetchone()[0]


def get_active_user_count() -> int:
    """Get the number of active users."""
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users WHERE active = 1")
        return cursor.fetchone()[0]


# ============== WATCHLIST MANAGEMENT ==============

def get_watchlist(user_id: str) -> Dict:
    """Get a user's watchlist."""
    user = get_user_by_id(user_id)
    if not user:
        return {"error": "User not found"}
    
    return {"watchlist": user.get("watchlist", [])}


def update_watchlist(user_id: str, tickers: List[str]) -> Dict:
    """
    Replace a user's entire watchlist with new tickers.
    
    Args:
        user_id: The user's ID
        tickers: List of ticker symbols (will be uppercased)
    
    Returns:
        Updated user object or error dict
    """
    user = get_user_by_id(user_id)
    if not user:
        return {"error": "User not found"}
    
    # Normalize tickers (uppercase, strip whitespace, remove duplicates)
    normalized = list(dict.fromkeys([t.strip().upper() for t in tickers if t.strip()]))
    now = datetime.now().isoformat()
    
    try:
        with _get_db() as conn:
            cursor = conn.cursor()
            
            # Delete existing watchlist
            cursor.execute("DELETE FROM user_watchlist WHERE user_id = ?", (user_id,))
            
            # Insert new tickers
            for ticker in normalized:
                cursor.execute(
                    "INSERT INTO user_watchlist (user_id, ticker, added_at) VALUES (?, ?, ?)",
                    (user_id, ticker, now)
                )
            
            # Update user's updated_at
            cursor.execute(
                "UPDATE users SET updated_at = ? WHERE id = ?",
                (now, user_id)
            )
            
            conn.commit()
            
            return get_user_by_id(user_id)
            
    except Exception as e:
        return {"error": f"Failed to update watchlist: {str(e)}"}


def add_to_watchlist(user_id: str, ticker: str) -> Dict:
    """Add a single ticker to a user's watchlist."""
    user = get_user_by_id(user_id)
    if not user:
        return {"error": "User not found"}
    
    ticker = ticker.strip().upper()
    if not ticker:
        return {"error": "Invalid ticker symbol"}
    
    now = datetime.now().isoformat()
    
    try:
        with _get_db() as conn:
            cursor = conn.cursor()
            
            # Check if already exists
            cursor.execute(
                "SELECT 1 FROM user_watchlist WHERE user_id = ? AND ticker = ?",
                (user_id, ticker)
            )
            
            if not cursor.fetchone():
                cursor.execute(
                    "INSERT INTO user_watchlist (user_id, ticker, added_at) VALUES (?, ?, ?)",
                    (user_id, ticker, now)
                )
                cursor.execute(
                    "UPDATE users SET updated_at = ? WHERE id = ?",
                    (now, user_id)
                )
                conn.commit()
            
            return get_user_by_id(user_id)
            
    except Exception as e:
        return {"error": f"Failed to add to watchlist: {str(e)}"}


def remove_from_watchlist(user_id: str, ticker: str) -> Dict:
    """Remove a ticker from a user's watchlist."""
    user = get_user_by_id(user_id)
    if not user:
        return {"error": "User not found"}
    
    ticker = ticker.strip().upper()
    now = datetime.now().isoformat()
    
    try:
        with _get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM user_watchlist WHERE user_id = ? AND ticker = ?",
                (user_id, ticker)
            )
            cursor.execute(
                "UPDATE users SET updated_at = ? WHERE id = ?",
                (now, user_id)
            )
            conn.commit()
            
            return get_user_by_id(user_id)
            
    except Exception as e:
        return {"error": f"Failed to remove from watchlist: {str(e)}"}


# ============== USER CONTEXT MANAGEMENT ==============

def get_user_context(user_id: str) -> Dict:
    """Get a user's investment context/profile."""
    user = get_user_by_id(user_id)
    if not user:
        return {"error": "User not found"}
    
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM user_context WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        
        if not row:
            # Return default empty context
            return {
                "user_id": user_id,
                "investment_philosophy": "",
                "goals": "",
                "risk_tolerance": "moderate",
                "time_horizon": "medium",
                "income_level": "",
                "age_range": "",
                "investment_experience": "beginner",
                "knowledge_assessment": {},
                "notes": "",
                "updated_at": None
            }
        
        # Parse knowledge_assessment JSON
        import json
        knowledge = {}
        try:
            ka = row["knowledge_assessment"] if "knowledge_assessment" in row.keys() else "{}"
            knowledge = json.loads(ka) if ka else {}
        except:
            knowledge = {}
        
        return {
            "user_id": row["user_id"],
            "investment_philosophy": row["investment_philosophy"] or "",
            "goals": row["goals"] or "",
            "risk_tolerance": row["risk_tolerance"] or "moderate",
            "time_horizon": row["time_horizon"] or "medium",
            "income_level": row["income_level"] or "",
            "age_range": row["age_range"] or "",
            "investment_experience": row["investment_experience"] or "beginner",
            "knowledge_assessment": knowledge,
            "notes": row["notes"] or "",
            "updated_at": row["updated_at"]
        }


def update_user_context(user_id: str, context_data: Dict) -> Dict:
    """
    Update a user's investment context/profile.
    
    Args:
        user_id: The user's ID
        context_data: Dict with any of these fields:
            - investment_philosophy
            - goals
            - risk_tolerance (conservative, moderate, aggressive)
            - time_horizon (short, medium, long)
            - income_level
            - age_range
            - investment_experience (beginner, intermediate, advanced)
            - knowledge_assessment (dict with category scores)
            - notes
    
    Returns:
        Updated context or error dict
    """
    import json
    
    user = get_user_by_id(user_id)
    if not user:
        return {"error": "User not found"}
    
    now = datetime.now().isoformat()
    
    # Valid options for constrained fields
    valid_risk = ['conservative', 'moderate', 'aggressive']
    valid_horizon = ['short', 'medium', 'long']
    valid_experience = ['beginner', 'intermediate', 'advanced']
    
    try:
        with _get_db() as conn:
            cursor = conn.cursor()
            
            # Check if context exists
            cursor.execute("SELECT user_id FROM user_context WHERE user_id = ?", (user_id,))
            exists = cursor.fetchone()
            
            if exists:
                # Update existing context
                updates = []
                values = []
                
                if 'investment_philosophy' in context_data:
                    updates.append("investment_philosophy = ?")
                    values.append(context_data['investment_philosophy'])
                    
                if 'goals' in context_data:
                    updates.append("goals = ?")
                    values.append(context_data['goals'])
                    
                if 'risk_tolerance' in context_data:
                    rt = context_data['risk_tolerance'].lower()
                    if rt in valid_risk:
                        updates.append("risk_tolerance = ?")
                        values.append(rt)
                        
                if 'time_horizon' in context_data:
                    th = context_data['time_horizon'].lower()
                    if th in valid_horizon:
                        updates.append("time_horizon = ?")
                        values.append(th)
                        
                if 'income_level' in context_data:
                    updates.append("income_level = ?")
                    values.append(context_data['income_level'])
                    
                if 'age_range' in context_data:
                    updates.append("age_range = ?")
                    values.append(context_data['age_range'])
                    
                if 'investment_experience' in context_data:
                    exp = context_data['investment_experience'].lower()
                    if exp in valid_experience:
                        updates.append("investment_experience = ?")
                        values.append(exp)
                        
                if 'notes' in context_data:
                    updates.append("notes = ?")
                    values.append(context_data['notes'])
                
                if 'knowledge_assessment' in context_data:
                    updates.append("knowledge_assessment = ?")
                    values.append(json.dumps(context_data['knowledge_assessment']))
                
                if updates:
                    updates.append("updated_at = ?")
                    values.append(now)
                    values.append(user_id)
                    
                    cursor.execute(
                        f"UPDATE user_context SET {', '.join(updates)} WHERE user_id = ?",
                        values
                    )
            else:
                # Insert new context
                cursor.execute('''
                    INSERT INTO user_context 
                    (user_id, investment_philosophy, goals, risk_tolerance, time_horizon, 
                     income_level, age_range, investment_experience, knowledge_assessment, notes, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    user_id,
                    context_data.get('investment_philosophy', ''),
                    context_data.get('goals', ''),
                    context_data.get('risk_tolerance', 'moderate').lower() if context_data.get('risk_tolerance', '').lower() in valid_risk else 'moderate',
                    context_data.get('time_horizon', 'medium').lower() if context_data.get('time_horizon', '').lower() in valid_horizon else 'medium',
                    context_data.get('income_level', ''),
                    context_data.get('age_range', ''),
                    context_data.get('investment_experience', 'beginner').lower() if context_data.get('investment_experience', '').lower() in valid_experience else 'beginner',
                    json.dumps(context_data.get('knowledge_assessment', {})),
                    context_data.get('notes', ''),
                    now
                ))
            
            conn.commit()
            return get_user_context(user_id)
            
    except Exception as e:
        return {"error": f"Failed to update user context: {str(e)}"}


# ============== PORTFOLIO HOLDINGS MANAGEMENT ==============

def get_user_holdings(user_id: str) -> Dict:
    """Get all portfolio holdings for a user."""
    user = get_user_by_id(user_id)
    if not user:
        return {"error": "User not found"}
    
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM user_holdings WHERE user_id = ? ORDER BY ticker
        ''', (user_id,))
        rows = cursor.fetchall()
        
        holdings = []
        for row in rows:
            holdings.append({
                "id": row["id"],
                "ticker": row["ticker"],
                "shares": row["shares"],
                "cost_basis": row["cost_basis"],
                "purchase_date": row["purchase_date"],
                "account_type": row["account_type"],
                "notes": row["notes"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"]
            })
        
        return {"holdings": holdings, "count": len(holdings)}


def add_holding(user_id: str, holding_data: Dict) -> Dict:
    """
    Add a new holding to the user's portfolio.
    
    Args:
        user_id: The user's ID
        holding_data: Dict with:
            - ticker (required)
            - shares (required)
            - cost_basis (optional)
            - purchase_date (optional)
            - account_type (optional: taxable, ira, roth_ira, 401k)
            - notes (optional)
    
    Returns:
        Updated holdings list or error dict
    """
    user = get_user_by_id(user_id)
    if not user:
        return {"error": "User not found"}
    
    ticker = holding_data.get('ticker', '').strip().upper()
    shares = holding_data.get('shares')
    
    if not ticker:
        return {"error": "Ticker is required"}
    if shares is None or shares <= 0:
        return {"error": "Valid number of shares is required"}
    
    now = datetime.now().isoformat()
    
    try:
        with _get_db() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO user_holdings 
                (user_id, ticker, shares, cost_basis, purchase_date, account_type, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                user_id,
                ticker,
                shares,
                holding_data.get('cost_basis'),
                holding_data.get('purchase_date'),
                holding_data.get('account_type', 'taxable'),
                holding_data.get('notes', ''),
                now,
                now
            ))
            
            conn.commit()
            return get_user_holdings(user_id)
            
    except Exception as e:
        return {"error": f"Failed to add holding: {str(e)}"}


def update_holding(user_id: str, holding_id: int, updates: Dict) -> Dict:
    """Update an existing holding."""
    user = get_user_by_id(user_id)
    if not user:
        return {"error": "User not found"}
    
    now = datetime.now().isoformat()
    
    try:
        with _get_db() as conn:
            cursor = conn.cursor()
            
            # Verify holding belongs to user
            cursor.execute(
                "SELECT id FROM user_holdings WHERE id = ? AND user_id = ?",
                (holding_id, user_id)
            )
            if not cursor.fetchone():
                return {"error": "Holding not found"}
            
            update_parts = []
            values = []
            
            if 'ticker' in updates:
                update_parts.append("ticker = ?")
                values.append(updates['ticker'].strip().upper())
                
            if 'shares' in updates:
                update_parts.append("shares = ?")
                values.append(updates['shares'])
                
            if 'cost_basis' in updates:
                update_parts.append("cost_basis = ?")
                values.append(updates['cost_basis'])
                
            if 'purchase_date' in updates:
                update_parts.append("purchase_date = ?")
                values.append(updates['purchase_date'])
                
            if 'account_type' in updates:
                update_parts.append("account_type = ?")
                values.append(updates['account_type'])
                
            if 'notes' in updates:
                update_parts.append("notes = ?")
                values.append(updates['notes'])
            
            if update_parts:
                update_parts.append("updated_at = ?")
                values.append(now)
                values.append(holding_id)
                
                cursor.execute(
                    f"UPDATE user_holdings SET {', '.join(update_parts)} WHERE id = ?",
                    values
                )
                conn.commit()
            
            return get_user_holdings(user_id)
            
    except Exception as e:
        return {"error": f"Failed to update holding: {str(e)}"}


def delete_holding(user_id: str, holding_id: int) -> Dict:
    """Delete a holding from the user's portfolio."""
    user = get_user_by_id(user_id)
    if not user:
        return {"error": "User not found"}
    
    try:
        with _get_db() as conn:
            cursor = conn.cursor()
            
            # Verify holding belongs to user
            cursor.execute(
                "SELECT id FROM user_holdings WHERE id = ? AND user_id = ?",
                (holding_id, user_id)
            )
            if not cursor.fetchone():
                return {"error": "Holding not found"}
            
            cursor.execute("DELETE FROM user_holdings WHERE id = ?", (holding_id,))
            conn.commit()
            
            return get_user_holdings(user_id)
            
    except Exception as e:
        return {"error": f"Failed to delete holding: {str(e)}"}


def replace_all_holdings(user_id: str, holdings: List[Dict]) -> Dict:
    """
    Replace all holdings for a user (bulk update).
    
    Args:
        user_id: The user's ID
        holdings: List of holding dicts with ticker, shares, etc.
    
    Returns:
        Updated holdings list or error dict
    """
    user = get_user_by_id(user_id)
    if not user:
        return {"error": "User not found"}
    
    now = datetime.now().isoformat()
    
    try:
        with _get_db() as conn:
            cursor = conn.cursor()
            
            # Delete all existing holdings
            cursor.execute("DELETE FROM user_holdings WHERE user_id = ?", (user_id,))
            
            # Insert new holdings
            for h in holdings:
                ticker = h.get('ticker', '').strip().upper()
                shares = h.get('shares')
                
                if ticker and shares and shares > 0:
                    cursor.execute('''
                        INSERT INTO user_holdings 
                        (user_id, ticker, shares, cost_basis, purchase_date, account_type, notes, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        user_id,
                        ticker,
                        shares,
                        h.get('cost_basis'),
                        h.get('purchase_date'),
                        h.get('account_type', 'taxable'),
                        h.get('notes', ''),
                        now,
                        now
                    ))
            
            conn.commit()
            return get_user_holdings(user_id)
            
    except Exception as e:
        return {"error": f"Failed to replace holdings: {str(e)}"}


def get_full_user_profile(user_id: str) -> Dict:
    """
    Get complete user profile including context, holdings, and preferences.
    This is the main function for the recommendation engine.
    """
    user = get_user_by_id(user_id)
    if not user:
        return {"error": "User not found"}
    
    context = get_user_context(user_id)
    holdings = get_user_holdings(user_id)
    
    return {
        "user": user,
        "context": context if 'error' not in context else {},
        "holdings": holdings.get('holdings', []) if 'error' not in holdings else [],
        "holdings_count": holdings.get('count', 0) if 'error' not in holdings else 0
    }


# ============== PROFILE COMPLETENESS & AI ANALYSIS CACHING ==============

def check_profile_completeness(user_id: str) -> Dict:
    """
    Check if user has completed all required profile sections.
    
    Required sections:
    1. Investment Philosophy & Goals (investment_philosophy, goals, risk_tolerance)
    2. Knowledge Assessment (at least 4 categories rated)
    3. Current Portfolio (at least 1 holding)
    
    Returns:
        Dict with is_complete, missing_sections, and completion_percentage
    """
    import json
    
    user = get_user_by_id(user_id)
    if not user:
        return {"error": "User not found", "is_complete": False}
    
    context = get_user_context(user_id)
    holdings = get_user_holdings(user_id)
    
    missing_sections = []
    completed_items = 0
    total_items = 3
    
    # Check Philosophy & Goals
    philosophy_complete = bool(
        context.get('investment_philosophy', '').strip() and
        context.get('goals', '').strip()
    )
    if philosophy_complete:
        completed_items += 1
    else:
        missing_sections.append({
            "section": "philosophy_goals",
            "name": "Investment Philosophy & Goals",
            "message": "Please fill out your investment philosophy and goals"
        })
    
    # Check Knowledge Assessment (at least 4 categories rated > 0)
    knowledge = context.get('knowledge_assessment', {})
    rated_categories = sum(1 for v in knowledge.values() if v > 0)
    knowledge_complete = rated_categories >= 4
    if knowledge_complete:
        completed_items += 1
    else:
        missing_sections.append({
            "section": "knowledge",
            "name": "Knowledge Assessment",
            "message": f"Please rate at least 4 knowledge categories ({rated_categories}/4 completed)"
        })
    
    # Check Current Portfolio (at least 1 holding)
    holdings_list = holdings.get('holdings', []) if 'error' not in holdings else []
    portfolio_complete = len(holdings_list) >= 1
    if portfolio_complete:
        completed_items += 1
    else:
        missing_sections.append({
            "section": "portfolio",
            "name": "Current Portfolio",
            "message": "Please add at least one holding to your portfolio"
        })
    
    return {
        "is_complete": len(missing_sections) == 0,
        "missing_sections": missing_sections,
        "completion_percentage": int((completed_items / total_items) * 100),
        "completed_items": completed_items,
        "total_items": total_items
    }


def _compute_profile_hash(user_id: str) -> str:
    """
    Compute a hash of the user's profile to detect changes.
    Used to determine if analysis needs regeneration.
    """
    import hashlib
    import json
    
    context = get_user_context(user_id)
    holdings = get_user_holdings(user_id)
    
    # Create a string representation of the profile
    profile_data = {
        "context": {
            "investment_philosophy": context.get('investment_philosophy', ''),
            "goals": context.get('goals', ''),
            "risk_tolerance": context.get('risk_tolerance', ''),
            "time_horizon": context.get('time_horizon', ''),
            "knowledge_assessment": context.get('knowledge_assessment', {}),
        },
        "holdings": sorted([
            {"ticker": h.get('ticker', ''), "shares": h.get('shares', 0)}
            for h in holdings.get('holdings', [])
        ], key=lambda x: x['ticker'])
    }
    
    profile_str = json.dumps(profile_data, sort_keys=True)
    return hashlib.md5(profile_str.encode()).hexdigest()


def get_cached_analysis(user_id: str) -> Dict:
    """
    Get cached AI analysis for a user.
    
    Returns:
        Dict with analysis, generated_at, profile_hash, or None if no cache exists
    """
    import json
    
    user = get_user_by_id(user_id)
    if not user:
        return {"error": "User not found"}
    
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT analysis_json, generated_at, profile_hash FROM user_ai_analysis WHERE user_id = ?",
            (user_id,)
        )
        row = cursor.fetchone()
        
        if not row:
            return None
        
        try:
            analysis = json.loads(row["analysis_json"]) if row["analysis_json"] else None
        except:
            analysis = None
        
        return {
            "analysis": analysis,
            "generated_at": row["generated_at"],
            "profile_hash": row["profile_hash"]
        }


def save_cached_analysis(user_id: str, analysis: Dict) -> Dict:
    """
    Save AI analysis to cache.
    """
    import json
    
    user = get_user_by_id(user_id)
    if not user:
        return {"error": "User not found"}
    
    now = datetime.now().isoformat()
    profile_hash = _compute_profile_hash(user_id)
    analysis_json = json.dumps(analysis)
    
    try:
        with _get_db() as conn:
            cursor = conn.cursor()
            
            # Upsert the analysis
            cursor.execute('''
                INSERT INTO user_ai_analysis (user_id, analysis_json, generated_at, profile_hash)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    analysis_json = excluded.analysis_json,
                    generated_at = excluded.generated_at,
                    profile_hash = excluded.profile_hash
            ''', (user_id, analysis_json, now, profile_hash))
            
            conn.commit()
            
            return {
                "success": True,
                "generated_at": now,
                "profile_hash": profile_hash
            }
            
    except Exception as e:
        return {"error": f"Failed to save analysis: {str(e)}"}


def should_regenerate_analysis(user_id: str, cooldown_minutes: int = 5) -> Dict:
    """
    Check if analysis should be regenerated.
    
    Analysis should be regenerated if:
    1. No cached analysis exists
    2. Profile has changed (different hash)
    3. Cooldown period has passed AND profile changed
    
    Returns:
        Dict with should_regenerate, reason, and cached analysis if available
    """
    cached = get_cached_analysis(user_id)
    
    if cached is None or cached.get('analysis') is None:
        return {
            "should_regenerate": True,
            "reason": "no_cache",
            "cached_analysis": None
        }
    
    current_hash = _compute_profile_hash(user_id)
    cached_hash = cached.get('profile_hash', '')
    
    # Check if profile changed
    profile_changed = current_hash != cached_hash
    
    if not profile_changed:
        return {
            "should_regenerate": False,
            "reason": "no_changes",
            "cached_analysis": cached
        }
    
    # Profile changed - check cooldown
    generated_at = cached.get('generated_at')
    if generated_at:
        from datetime import datetime, timedelta
        try:
            gen_time = datetime.fromisoformat(generated_at)
            cooldown_end = gen_time + timedelta(minutes=cooldown_minutes)
            
            if datetime.now() < cooldown_end:
                # Still in cooldown, return cached but note it's stale
                remaining = (cooldown_end - datetime.now()).seconds // 60
                return {
                    "should_regenerate": False,
                    "reason": "cooldown",
                    "cooldown_remaining_minutes": remaining + 1,
                    "cached_analysis": cached,
                    "profile_changed": True
                }
        except:
            pass
    
    # Profile changed and cooldown passed
    return {
        "should_regenerate": True,
        "reason": "profile_changed",
        "cached_analysis": cached
    }


# ============== PORTFOLIO NEWS CACHING ==============

def get_cached_portfolio_news(user_id: str) -> Optional[Dict]:
    """
    Get cached portfolio news for a user.
    
    Returns:
        Dict with news data and generated_at, or None if no cache exists
    """
    import json
    
    user = get_user_by_id(user_id)
    if not user:
        return None
    
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT news_json, generated_at FROM user_portfolio_news WHERE user_id = ?",
            (user_id,)
        )
        row = cursor.fetchone()
        
        if not row:
            return None
        
        try:
            news_data = json.loads(row["news_json"]) if row["news_json"] else None
        except:
            news_data = None
        
        return {
            "news": news_data,
            "generated_at": row["generated_at"]
        }


def save_cached_portfolio_news(user_id: str, news_data: Dict) -> Dict:
    """
    Save portfolio news to cache.
    """
    import json
    
    user = get_user_by_id(user_id)
    if not user:
        return {"error": "User not found"}
    
    now = datetime.now().isoformat()
    news_json = json.dumps(news_data)
    
    try:
        with _get_db() as conn:
            cursor = conn.cursor()
            
            # Upsert the news
            cursor.execute('''
                INSERT INTO user_portfolio_news (user_id, news_json, generated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    news_json = excluded.news_json,
                    generated_at = excluded.generated_at
            ''', (user_id, news_json, now))
            
            conn.commit()
            
            return {
                "success": True,
                "generated_at": now
            }
            
    except Exception as e:
        return {"error": f"Failed to save portfolio news: {str(e)}"}


def should_refresh_portfolio_news(user_id: str) -> Dict:
    """
    Check if portfolio news should be refreshed.
    
    News should be refreshed if:
    1. No cached news exists
    2. Cache is older than 24 hours
    
    Returns:
        Dict with should_refresh, reason, hours_since_refresh, and cached news if available
    """
    cached = get_cached_portfolio_news(user_id)
    
    if cached is None or cached.get('news') is None:
        return {
            "should_refresh": True,
            "reason": "no_cache",
            "cached_news": None,
            "hours_since_refresh": None
        }
    
    generated_at = cached.get('generated_at')
    if generated_at:
        try:
            gen_time = datetime.fromisoformat(generated_at)
            hours_elapsed = (datetime.now() - gen_time).total_seconds() / 3600
            
            if hours_elapsed >= 24:
                return {
                    "should_refresh": True,
                    "reason": "stale",
                    "hours_since_refresh": round(hours_elapsed, 1),
                    "cached_news": cached
                }
            
            return {
                "should_refresh": False,
                "reason": "fresh",
                "hours_since_refresh": round(hours_elapsed, 1),
                "cached_news": cached
            }
        except:
            pass
    
    # If we can't determine age, assume stale
    return {
        "should_refresh": True,
        "reason": "unknown_age",
        "cached_news": cached,
        "hours_since_refresh": None
    }
