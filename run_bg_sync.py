import time
import os
from pathlib import Path

# Use local venv python when run by run_in_terminal
try:
    from streamlit_app import start_multi_background_sync, start_background_sync, _read_clients_config
except Exception as e:
    print('Failed to import from streamlit_app:', e)
    raise

INTERVAL = float(os.environ.get('BG_SYNC_INTERVAL', '60'))

clients = _read_clients_config()
print('Found clients:', clients)

try:
    if clients:
        print('Starting multi-client background sync, interval=', INTERVAL)
        start_multi_background_sync(INTERVAL)
    else:
        # Try to find default API from env vars used by streamlit_app
        api = os.environ.get('CLIENT1_PROVIDER') or os.environ.get('API_LINK') or 'http://127.0.0.1:3001/gps_current'
        print('Starting single-client background sync to', api, 'interval=', INTERVAL)
        start_background_sync(api, INTERVAL, client_id=os.environ.get('CLIENT1_ID'))
except Exception as e:
    print('Failed to start background sync:', e)

print('Background sync runner started; process will keep running to keep thread alive.')
try:
    while True:
        time.sleep(3600)
except KeyboardInterrupt:
    print('Background sync runner exiting')
