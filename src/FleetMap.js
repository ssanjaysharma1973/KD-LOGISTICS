import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export default function FleetMap({ vehicles }) {
  const defaultPosition = vehicles.length > 0 ? [vehicles[0].lat, vehicles[0].lng] : [28.6139, 77.2090];
  return (
    <div style={{ height: 400, width: '100%', margin: '24px 0', borderRadius: 12, overflow: 'hidden' }}>
      <MapContainer center={defaultPosition} zoom={7} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {vehicles
  .filter(v => v.lat && v.lng)
  .map(v => (
    <Marker key={v.id} position={[v.lat, v.lng]}>
      <Popup>
        <b>{v.number}</b><br />{v.driver}<br />{v.lastUpdate}
      </Popup>
    </Marker>
  ))}
      </MapContainer>
    </div>
  );
}
