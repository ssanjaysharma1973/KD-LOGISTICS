"""
Database configuration and connection management
"""
import sqlite3
from contextlib import contextmanager
from config.settings import get_config

config = get_config()


class DatabaseManager:
    """Manages database connections and operations"""
    
    def __init__(self, db_path=None):
        self.db_path = db_path or config.DATABASE_PATH
        self.connection = None
    
    def connect(self):
        """Create a new database connection"""
        try:
            self.connection = sqlite3.connect(self.db_path)
            self.connection.row_factory = sqlite3.Row
            return self.connection
        except sqlite3.Error as e:
            print(f"Database connection error: {e}")
            raise
    
    def disconnect(self):
        """Close the database connection"""
        if self.connection:
            self.connection.close()
            self.connection = None
    
    @contextmanager
    def get_connection(self):
        """Context manager for database connections"""
        conn = self.connect()
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            self.disconnect()
    
    def execute_query(self, query, params=None):
        """Execute a SELECT query"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            return cursor.fetchall()
    
    def execute_update(self, query, params=None):
        """Execute INSERT, UPDATE, or DELETE query"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            conn.commit()
            return cursor.rowcount


# Global database manager instance
db = DatabaseManager()
