#!/usr/bin/env python
"""Simple test server to verify Railway connectivity."""
import os
from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/')
def index():
    return jsonify({
        "status": "ok",
        "message": "Test server running",
        "port": os.getenv('PORT', 'not set')
    }), 200

@app.route('/health')
def health():
    return jsonify({"status": "healthy"}), 200

if __name__ == '__main__':
    port = int(os.getenv('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
