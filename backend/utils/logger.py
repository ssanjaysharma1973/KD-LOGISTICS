"""
Logging configuration
"""
import logging
import os
from config.settings import get_config

config = get_config()


def setup_logger(name=None, log_file=None):
    """Setup logger with file and console handlers"""
    logger = logging.getLogger(name or __name__)
    logger.setLevel(getattr(logging, config.LOG_LEVEL))
    
    # Create logs directory if it doesn't exist
    os.makedirs('logs', exist_ok=True)
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(getattr(logging, config.LOG_LEVEL))
    
    # File handler
    file_path = log_file or config.LOG_FILE
    file_handler = logging.FileHandler(file_path)
    file_handler.setLevel(getattr(logging, config.LOG_LEVEL))
    
    # Formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    console_handler.setFormatter(formatter)
    file_handler.setFormatter(formatter)
    
    # Add handlers
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    
    return logger
