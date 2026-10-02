import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap, Marker, Popup, GeoJSON, Polygon, Tooltip as LeafletTooltip } from 'react-leaflet';
import { apiFetch } from '../../utils/apiClient';
import { cellToBoundary } from 'h3-js';
import mmrGeoJSON from '../../data/mmr_jurisdictions.json';
import jurisdictions from '../../../config/jurisdictions.json';
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
  priority?: string;
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
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterPriority, setFilterPriority] = useState<string>('All');
  const [forecasts, setForecasts] = useState<any[]>([]);

  useEffect(() => {
    const fetchForecasts = async () => {
      try {
        const mlUrl = import.meta.env.VITE_ML_URL || '';
        if (!mlUrl) return; // ML not configured, skip silently
        const data = await apiFetch('/api/analytics/hotspot-forecast');
        if (data.forecast) setForecasts(data.forecast);
      } catch (e) {
        console.error('Hotspot forecast not available (ML service may not be running)', e);
      }
    };
    fetchForecasts();
  }, []);

  // MMR center from config
  const mmrCenter: [number, number] = jurisdictions.region.mapCenter as [number, number];
  
  // Filter tickets based on selection
  const filteredTickets = tickets.filter(t => {
    if (filterCategory !== 'All' && t.user_category !== filterCategory) return false;
    if (filterPriority !== 'All') {
      if (filterPriority === 'Critical' && !t.isEmergency && t.priority !== 'Critical') return false;
      if (filterPriority === 'High' && t.priority !== 'High') return false;
      if (filterPriority === 'Medium' && t.priority !== 'Medium') return false;
      if (filterPriority === 'Low' && t.priority !== 'Low') return false;
    }
    return true;
  });

  // Convert tickets to heatmap points
  const points: [number, number, number][] = filteredTickets.map(t => [
    t.location.coordinates[1], // lat
    t.location.coordinates[0], // lng
    t.priority === 'High' || t.priority === 'Critical' || t.isEmergency ? 1 : 0.5 // intensity
  ]);

  // Get categories from config for filter dropdown
  const categories = jurisdictions.categories;

  return (
    <div className="w-full h-[500px] rounded-xl overflow-hidden border border-[var(--line)] shadow-sm relative z-0">
      
      {/* Floating Control Panel */}
      <div className="absolute top-4 right-4 z-[400] bg-white/90 backdrop-blur-md p-4 rounded-xl border border-[var(--line)] shadow-lg w-64">
        <h4 className="font-display font-semibold text-[14px] mb-3 text-[var(--ink)]">Advanced Filters</h4>
        
        <div className="mb-3">
          <label className="text-[11px] font-bold text-[var(--ink-soft)] uppercase tracking-wider mb-1 block">Category</label>
          <select 
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full text-[13px] p-2 rounded-lg border border-[var(--line)] bg-white/50 text-[var(--ink)] focus:outline-none focus:border-[var(--teal)] transition-colors"
          >
            <option value="All">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold text-[var(--ink-soft)] uppercase tracking-wider mb-1 block">Priority / Urgency</label>
          <select 
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="w-full text-[13px] p-2 rounded-lg border border-[var(--line)] bg-white/50 text-[var(--ink)] focus:outline-none focus:border-[var(--teal)] transition-colors"
          >
            <option value="All">All Priorities</option>
            <option value="Critical">Critical (Emergency)</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      <MapContainer 
        center={mmrCenter} 
        zoom={jurisdictions.region.mapZoom} 
        className="w-full h-full z-0"
        scrollWheelZoom={false}
      >
        {/* Free CARTO dark tiles — no API token required */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        
        {/* MMR Jurisdiction Boundary Layers */}
        <GeoJSON 
          // @ts-ignore
          data={mmrGeoJSON} 
          style={(feature) => ({
            color: '#14b8a6',
            weight: 2, 
            opacity: 0.7, 
            fillColor: '#14b8a6', 
            fillOpacity: 0.05
          })}
          onEachFeature={(feature, layer) => {
            if (feature.properties?.name) {
              layer.bindTooltip(feature.properties.name, {
                permanent: false,
                direction: 'center',
                className: 'font-mono text-[11px] font-bold'
              });
            }
          }}
        />
        
        {/* Heatmap Layer */}
        <HeatmapLayer points={points} />

        {/* ML H3 Forecast Hotspots Layer (only if ML service running) */}
        {forecasts.map(f => {
          const boundary = cellToBoundary(f.h3_index);
          return (
            <Polygon 
              key={f.h3_index} 
              positions={boundary as [number, number][]}
              pathOptions={{ 
                color: '#a23b2e', 
                weight: 1,
                fillColor: '#a23b2e',
                fillOpacity: 0.15
              }}
            >
              <LeafletTooltip sticky className="font-mono text-[10px] font-bold border-[var(--line)]">
                <div className="text-[12px] mb-1 font-display tracking-tight text-[var(--ink)]">Zone: {f.h3_index}</div>
                <div className="flex justify-between gap-4 text-[var(--teal)]">
                  <span>Expected Incidents:</span> <span>{f.expected_incidents}</span>
                </div>
              </LeafletTooltip>
            </Polygon>
          );
        })}

        {/* Interactive Clickable Markers */}
        {filteredTickets.map(t => (
          <Marker key={t._id} position={[t.location.coordinates[1], t.location.coordinates[0]]}>
            <Popup>
              <div className="text-sm font-body min-w-[150px] text-[var(--ink)]">
                <strong className="block mb-1 font-display tracking-tight text-[15px]">{t.user_category}</strong>
                <span className="text-[10px] font-mono text-[var(--ink-soft)] font-bold block mb-2 bg-white/50 border border-[var(--line)] px-1.5 py-0.5 rounded-md w-fit">ID: {t._id.slice(-6)}</span>
                
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider border ${
                  t.status === 'CLOSED' ? 'bg-white/50 text-[var(--ink-soft)] border-[var(--line)]' 
                  : t.priority === 'Critical' || t.isEmergency ? 'bg-[rgba(162,59,46,0.1)] text-[var(--stamp)] border-[rgba(162,59,46,0.5)]' 
                  : 'bg-[var(--teal-light)] text-white border-[var(--teal)]'
                }`}>
                  {t.status}
                </span>
                
                {t.isEmergency && (
                  <p className="text-[var(--stamp)] font-bold text-[10px] uppercase tracking-widest mt-2 border border-[var(--stamp)] bg-[rgba(162,59,46,0.06)] px-1.5 py-0.5 text-center rounded-md">! Immediate Danger</p>
                )}
                <p className="text-[var(--ink-soft)] text-[11px] font-bold mt-2 pt-1 border-t border-[var(--line)]">Jurisdiction: {t.district_id}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
