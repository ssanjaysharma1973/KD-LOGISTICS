"""
Configuration module for the backend application
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Base configuration"""
    DEBUG = False
    TESTING = False
    
    # Database
    DATABASE_PATH = os.getenv('DATABASE_PATH', 'fleet_erp_backend_sqlite.db')
    DATABASE_URL = f"sqlite:///{DATABASE_PATH}"
    
    # API
    API_HOST = os.getenv('API_HOST', '0.0.0.0')
    API_PORT = int(os.getenv('API_PORT', 3000))
    API_DEBUG = os.getenv('API_DEBUG', 'False').lower() == 'true'
    
    # CORS
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://localhost:5173').split(',')
    
    # Logging
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE = 'logs/app.log'


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    API_DEBUG = True


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    API_DEBUG = False


class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    DATABASE_PATH = ':memory:'
    DATABASE_URL = 'sqlite:///:memory:'


def get_config():
    """Get configuration based on environment"""
    env = os.getenv('FLASK_ENV', 'development')
    
    if env == 'production':
        return ProductionConfig()
    elif env == 'testing':
        return TestingConfig()
    else:
        return DevelopmentConfig()
