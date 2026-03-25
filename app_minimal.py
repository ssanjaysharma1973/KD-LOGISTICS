from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/api/clients')
def get_clients():
    clients = [
        {'id': 'CLIENT_001', 'name': 'Atul Logistics Main'},
        {'id': 'CLIENT_002', 'name': 'Reliance Petro'},
        {'id': 'CLIENT_003', 'name': 'Tata Steel'}
    ]
    return jsonify({'clients': clients})

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8080, debug=True)
