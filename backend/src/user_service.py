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
        
        # Create index for faster email lookups
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
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


def _row_to_user(row: sqlite3.Row, preferences: List[str] = None) -> Dict:
    """Convert a database row to a user dictionary."""
    return {
        "id": row["id"],
        "email": row["email"],
        "name": row["name"] or "",
        "active": bool(row["active"]),
        "preferences": preferences if preferences is not None else [],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"]
    }


def _get_user_preferences(conn: sqlite3.Connection, user_id: str) -> List[str]:
    """Get all preferences for a user."""
    cursor = conn.cursor()
    cursor.execute("SELECT content_type FROM user_preferences WHERE user_id = ?", (user_id,))
    return [row[0] for row in cursor.fetchall()]


def get_all_users() -> List[Dict]:
    """Get all registered users with their preferences."""
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users ORDER BY created_at DESC")
        rows = cursor.fetchall()
        
        users = []
        for row in rows:
            preferences = _get_user_preferences(conn, row["id"])
            users.append(_row_to_user(row, preferences))
        
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
        return _row_to_user(row, preferences)


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
        return _row_to_user(row, preferences)


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
            users.append(_row_to_user(row, preferences))
        
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
