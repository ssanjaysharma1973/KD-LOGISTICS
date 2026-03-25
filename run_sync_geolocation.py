from streamlit_app import sync_geolocation

print('Running sync_geolocation()...')
try:
    n = sync_geolocation()
    print('Processed rows (gps_current entries):', n)
except Exception as e:
    import traceback
    traceback.print_exc()
    print('Error:', e)
