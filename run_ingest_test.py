from streamlit_app import _read_env_var, fetch_and_ingest_client_live

api = _read_env_var('CLIENT1_PROVIDER') or _read_env_var('API_LINK') or 'http://127.0.0.1:3001/gps_current'
print('Using API URL:', api)
try:
    n = fetch_and_ingest_client_live(api, client_id=None)
    print('Inserted rows:', n)
except Exception as e:
    import traceback
    traceback.print_exc()
    print('Error:', e)
