import React, { useEffect } from 'react';
import { MapContainer, TileLayer, useMap, Marker, Popup } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Vite/Leaflet.heat workaround: expose L to window before importing plugin
(window as any).L = L;
import 'leaflet.heat';

// Fix for default Leaflet marker icons in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface Ticket {
  _id: string;
  status: string;
  user_category: string;
  district_id: string;
  location: { coordinates: [number, number] };
  isEmergency?: boolean;
}

interface MapViewerProps {
  tickets: Ticket[];
}

const HeatmapLayer = ({ points }: { points: [number, number, number][] }) => {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;

    // @ts-ignore
    const heat = L.heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 14,
      gradient: {
        0.4: 'blue',
        0.6: 'cyan',
        0.7: 'lime',
        0.8: 'yellow',
        1.0: 'red'
      }
    }).addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [map, points]);

  return null;
};

export const MapViewer: React.FC<MapViewerProps> = ({ tickets }) => {
  const delhiCenter: [number, number] = [28.6139, 77.2090];
  
  // Convert tickets to heatmap points
  const points: [number, number, number][] = tickets.map(t => [
    t.location.coordinates[1], // lat
    t.location.coordinates[0], // lng
    t.status === 'High Priority' || t.isEmergency ? 1 : 0.5 // intensity
  ]);

  return (
    <div className="w-full h-[500px] rounded-xl overflow-hidden border border-gray-200 shadow-sm relative z-0">
      <MapContainer 
        center={delhiCenter} 
        zoom={11} 
        className="w-full h-full z-0"
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        
        {/* Heatmap Layer */}
        <HeatmapLayer points={points} />

        {/* Interactive Clickable Markers */}
        {tickets.map(t => (
          <Marker key={t._id} position={[t.location.coordinates[1], t.location.coordinates[0]]}>
            <Popup>
              <div className="text-sm font-sans min-w-[150px]">
                <strong className="block mb-1">{t.user_category}</strong>
                <span className="text-xs font-mono text-gray-500 block mb-2">ID: {t._id.slice(-6)}</span>
                
                <span className={`px-2 py-0.5 text-xs font-bold rounded-sm ${
                  t.status.includes('Closed') ? 'bg-gray-200 text-gray-700' 
                  : t.status.includes('High') || t.isEmergency ? 'bg-red-100 text-red-700' 
                  : 'bg-teal-100 text-teal-800'
                }`}>
                  {t.status}
                </span>
                
                {t.isEmergency && (
                  <p className="text-red-600 font-bold text-xs mt-2">! IMMEDIATE DANGER !</p>
                )}
                <p className="text-gray-500 text-xs mt-2 border-t pt-1">District: {t.district_id}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
