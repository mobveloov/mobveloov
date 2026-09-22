import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { GeoPoint } from '@/types';

interface MapViewProps {
  origin: GeoPoint | null;
  destination: GeoPoint | null;
  className?: string;
}

const goldIcon = L.divIcon({
  className: '',
  html: `<div style="background:#D4AF37;width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #0F172A;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});

const destIcon = L.divIcon({
  className: '',
  html: `<div style="background:#2563EB;width:22px;height:22px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

async function fetchRoadRoute(
  origin: GeoPoint,
  destination: GeoPoint
): Promise<[number, number][] | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const coords = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    return coords.map(([lng, lat]: [number, number]) => [lat, lng]);
  } catch {
    return null;
  }
}

export function MapView({ origin, destination, className }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const routeRef = useRef<L.Polyline | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([-23.5505, -46.6333], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (routeRef.current) {
      routeRef.current.remove();
      routeRef.current = null;
    }

    if (origin) {
      const m = L.marker([origin.lat, origin.lng], { icon: goldIcon }).addTo(map);
      m.bindPopup(`<b>Origem</b><br/>${origin.label}`);
      markersRef.current.push(m);
    }

    if (destination) {
      const m = L.marker([destination.lat, destination.lng], { icon: destIcon }).addTo(map);
      m.bindPopup(`<b>Destino</b><br/>${destination.label}`);
      markersRef.current.push(m);
    }

    if (origin && destination) {
      setRouteLoading(true);
      fetchRoadRoute(origin, destination).then((roadCoords) => {
        setRouteLoading(false);
        const mapInstance = mapRef.current;
        if (!mapInstance) return;

        if (roadCoords) {
          const route = L.polyline(roadCoords, {
            color: '#D4AF37',
            weight: 4,
            opacity: 0.85,
          }).addTo(mapInstance);
          routeRef.current = route;
          mapInstance.fitBounds(L.latLngBounds(roadCoords), { padding: [50, 50] });
        } else {
          const latlngs: [number, number][] = [
            [origin.lat, origin.lng],
            [destination.lat, destination.lng],
          ];
          const route = L.polyline(latlngs, {
            color: '#D4AF37',
            weight: 4,
            opacity: 0.8,
            dashArray: '10 8',
          }).addTo(mapInstance);
          routeRef.current = route;
          mapInstance.fitBounds(L.latLngBounds(latlngs), { padding: [50, 50] });
        }
      });
    } else if (origin) {
      map.setView([origin.lat, origin.lng], 14);
    }
  }, [origin, destination]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setTimeout(() => map.invalidateSize(), 100);
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className={className} />
      {routeLoading && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs text-white shadow-lg">
          Traçando rota...
        </div>
      )}
    </div>
  );
}
