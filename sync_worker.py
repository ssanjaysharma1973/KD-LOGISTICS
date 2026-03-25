#!/usr/bin/env python
"""
Lightweight GPS sync worker - fetches from WHEELSEYE API and syncs to database.
No streamlit dependency. Can run standalone or as background process.
Logs all operations for debugging.
"""
import os
import sys
import time
import sqlite3
import json
import logging
from datetime import datetime
from threading import Event, Thread
from typing import Optional, Dict, List
import requests

try:
    import importlib
    _dotenv = importlib.import_module('dotenv')
    load_dotenv = getattr(_dotenv, 'load_dotenv')
except Exception:
    def load_dotenv(*args, **kwargs):
        return False

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('gps_sync.log', mode='a'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class GPSSyncWorker:
    """Direct sync worker for GPS live data."""
    
    def __init__(self, api_url: str, interval: float = 60, client_id: str = 'CLIENT_001', db_path: str = 'fleet_erp_backend_sqlite.db'):
        self.api_url = api_url
        self.interval = interval
        self.client_id = client_id
        self.db_path = db_path
        self.stop_event = None
        self.thread = None
        self.last_sync_time = None
        
        logger.info(f"GPSSyncWorker initialized: api_url={api_url[:50]}..., interval={interval}s, client_id={client_id}")
    
    def fetch_from_api(self, timeout: float = 10) -> List[Dict]:
        """Fetch GPS data from WHEELSEYE API."""
        try:
            logger.debug(f"Fetching from API: {self.api_url[:60]}...")
            response = requests.get(self.api_url, timeout=timeout)
            response.raise_for_status()
            
            data = response.json()
            logger.debug(f"API response type: {type(data).__name__}")
            
            # Extract records from various possible structures
            records = []
            if isinstance(data, dict):
                if 'list' in data and isinstance(data['list'], list):
                    records = data['list']
                elif 'data' in data:
                    data_inner = data['data']
                    if isinstance(data_inner, list):
                        records = data_inner
                    elif isinstance(data_inner, dict) and 'list' in data_inner:
                        records = data_inner['list']
                elif 'rows' in data:
                    records = data['rows']
            elif isinstance(data, list):
                records = data
            
            logger.info(f"API returned {len(records)} records")
            return records
            
        except requests.Timeout:
            logger.error(f"API timeout after {timeout}s")
            return []
        except requests.RequestException as e:
            logger.error(f"API request failed: {e}")
            return []
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse API response: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching from API: {e}")
            return []
    
    def insert_into_db(self, records: List[Dict]) -> int:
        """Insert records into gps_live_data table."""
        if not records:
            return 0

        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            table_info = cursor.execute("PRAGMA table_info(gps_current)").fetchall()
            if not table_info:
                logger.error("gps_current table not found or has no columns")
                conn.close()
                return 0

            column_names = {row[1] for row in table_info}
            ordered_columns = [
                col for col in ['vehicle_id', 'vehicle_number', 'latitude', 'longitude', 'gps_time', 'client_id']
                if col in column_names
            ]
            if not ordered_columns:
                logger.error("gps_current has no expected columns")
                conn.close()
                return 0

            placeholders = ", ".join(["?"] * len(ordered_columns))
            insert_sql = f"REPLACE INTO gps_current ({', '.join(ordered_columns)}) VALUES ({placeholders})"

            inserted = 0
            for record in records:
                try:
                    vehicle_number = record.get('vehicle_number') or record.get('vehicle_no') or record.get('vehicleNumber')
                    latitude = float(record.get('latitude') or record.get('lat') or 0)
                    longitude = float(record.get('longitude') or record.get('lon') or 0)

                    gps_time = None
                    if 'createdDate' in record and isinstance(record['createdDate'], int):
                        try:
                            gps_time = datetime.utcfromtimestamp(record['createdDate']).isoformat() + 'Z'
                        except (ValueError, OSError):
                            gps_time = None

                    if not gps_time:
                        gps_time = record.get('gps_time') or record.get('time') or record.get('createdDateReadable')

                    if not gps_time:
                        gps_time = datetime.utcnow().isoformat() + 'Z'

                    if not vehicle_number or latitude == 0 or longitude == 0:
                        continue

                    values = []
                    for col in ordered_columns:
                        if col == 'vehicle_id':
                            values.append(vehicle_number)
                        elif col == 'vehicle_number':
                            values.append(vehicle_number)
                        elif col == 'latitude':
                            values.append(latitude)
                        elif col == 'longitude':
                            values.append(longitude)
                        elif col == 'gps_time':
                            values.append(gps_time)
                        elif col == 'client_id':
                            values.append(self.client_id)

                    cursor.execute(insert_sql, values)
                    inserted += 1

                except (ValueError, TypeError) as e:
                    logger.debug(f"Skipped record due to data error: {e}")
                    continue

            conn.commit()
            conn.close()

            logger.info(f"Inserted {inserted}/{len(records)} records into database")
            return inserted

        except sqlite3.Error as e:
            logger.error(f"Database error: {e}")
            return 0
        except Exception as e:
            logger.error(f"Unexpected error inserting into database: {e}")
            return 0
         
    def sync_once(self) -> int:
        """Run one sync cycle: fetch from API, insert to DB."""
        try:
            records = self.fetch_from_api()
            if records:
                inserted = self.insert_into_db(records)
                logger.info(f"Sync cycle complete: fetched {len(records)}, inserted {inserted}")
                return inserted
            else:
                logger.warning("No records fetched from API")
                return 0
        except Exception as e:
            logger.error(f"Sync cycle failed: {e}")
            return 0
    
    def run_loop(self, stop_event: Event):
        """Background sync loop."""
        logger.info(f"Starting background sync loop (interval={self.interval}s)")
        
        while not stop_event.is_set():
            try:
                self.sync_once()
                self.last_sync_time = datetime.utcnow().isoformat() + 'Z'
            except Exception as e:
                logger.error(f"Unexpected error in sync loop: {e}")
            
            # Wait for interval or until stop event is set
            stop_event.wait(self.interval)
        
        logger.info("Background sync loop stopped")
    
    def start(self):
        """Start background sync thread."""
        if self.thread and self.thread.is_alive():
            logger.warning("Sync already running")
            return
        
        self.stop_event = Event()
        self.thread = Thread(target=self.run_loop, args=(self.stop_event,), daemon=True)
        self.thread.start()
        logger.info(f"Background sync started (PID: {os.getpid()})")
    
    def stop(self):
        """Stop background sync thread."""
        if self.stop_event:
            self.stop_event.set()
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=5)
        logger.info("Background sync stopped")
    
    def is_running(self) -> bool:
        """Check if sync worker is running."""
        return self.thread is not None and self.thread.is_alive()
    
    def sync_now(self) -> int:
        """Trigger an immediate sync cycle."""
        logger.info("Manual sync triggered")
        return self.sync_once()


def main():
    """Main entry point for sync worker."""
    load_dotenv()
    load_dotenv('.env.production')

    api_url = os.environ.get('CLIENT1_PROVIDER') or os.environ.get('API_URL')
    ...
    # Get configuration from environment
    api_url = os.environ.get('CLIENT1_PROVIDER') or os.environ.get('API_URL')
    interval = float(os.environ.get('BG_SYNC_INTERVAL', '60'))
    client_id = os.environ.get('CLIENT1_ID', 'CLIENT_001')
    db_path = os.environ.get('DB_PATH', 'fleet_erp_backend_sqlite.db')
    
    if not api_url:
        logger.error("CLIENT1_PROVIDER or API_URL environment variable not set")
        sys.exit(1)
    
    logger.info(f"Starting GPS Sync Worker")
    logger.info(f"  API: {api_url[:60]}...")
    logger.info(f"  Client ID: {client_id}")
    logger.info(f"  Interval: {interval}s")
    logger.info(f"  Database: {db_path}")
    
    # Create and start worker
    worker = GPSSyncWorker(api_url, interval, client_id, db_path)
    worker.start()
    
    # Keep main thread alive
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        logger.info("Received interrupt signal, shutting down...")
        worker.stop()
    except Exception as e:
        logger.error(f"Unexpected error in main: {e}")
        worker.stop()


if __name__ == '__main__':
    main()
