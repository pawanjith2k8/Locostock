'use client';

import React, { useEffect, useRef } from 'react';

interface MapProps {
  center: [number, number];
  zoom?: number;
  markers?: Array<{
    lat: number;
    lon: number;
    title: string;
    description?: string;
    isPrimary?: boolean;
  }>;
  onLocationSelect?: (lat: number, lon: number) => void;
  height?: string;
}

export default function LeafletMap({
  center,
  zoom = 13,
  markers = [],
  onLocationSelect,
  height = '360px',
}: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletInstance = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    let isMounted = true;

    // Dynamically import Leaflet in browser only
    import('leaflet').then(L => {
      if (!isMounted || !mapRef.current) return;

      // Clean up previous instance if exists
      if (leafletInstance.current) {
        leafletInstance.current.remove();
        leafletInstance.current = null;
      }

      // Initialize map
      const map = L.map(mapRef.current, {
        zoomControl: true,
      }).setView(center, zoom);
      leafletInstance.current = map;

      // CartoDB Dark Matter tiles (premium dark mode map)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      // Custom Emerald pin for premium dark mode
      const EmeraldIcon = L.divIcon({
        className: 'custom-emerald-pin',
        html: `
          <div style="
            position: relative;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <span style="
              position: absolute;
              width: 100%;
              height: 100%;
              border-radius: 50%;
              background-color: rgba(34, 197, 94, 0.35);
              animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
            "></span>
            <div style="
              position: relative;
              width: 20px;
              height: 20px;
              background: #22C55E;
              border: 2.5px solid #101512;
              border-radius: 50%;
              box-shadow: 0 0 12px rgba(34, 197, 94, 0.8);
            "></div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      });

      // Markers
      markers.forEach(m => {
        const marker = L.marker([m.lat, m.lon], { icon: EmeraldIcon }).addTo(map);
        if (m.title) {
          marker.bindPopup(`
            <div style="padding: 2px 4px;">
              <div style="font-weight: 700; font-size: 13px; color: #34D399; margin-bottom: 3px;">
                ${m.title}
              </div>
              <div style="font-size: 11px; color: #A1ADA5; line-height: 1.4;">
                ${m.description || ''}
              </div>
            </div>
          `);
        }
      });

      // Click callback
      if (onLocationSelect) {
        map.on('click', (e: any) => {
          onLocationSelect(e.latlng.lat, e.latlng.lng);
        });
      }
    });

    return () => {
      isMounted = false;
      if (leafletInstance.current) {
        leafletInstance.current.remove();
        leafletInstance.current = null;
      }
    };
  }, [center[0], center[1], zoom, markers.length]);

  return (
    <div
      ref={mapRef}
      style={{ height }}
      className="w-full rounded-2xl overflow-hidden shadow-2xl border border-[#303D34] bg-[#101512] z-10"
    />
  );
}
