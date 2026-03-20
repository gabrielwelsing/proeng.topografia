'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface MapPoint {
    id: string;
    title: string;
    utmE: string;
    utmN: string;
    lat: number;
    lon: number;
    isDivisa: boolean;
}

interface MapPreviewProps {
    points: MapPoint[];
    appMode: 'pre_projeto' | 'ambiental' | 'impedimentos';
}

export default function MapPreview({ points, appMode }: MapPreviewProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markersLayerRef = useRef<L.LayerGroup | null>(null);
    const polylineRef = useRef<L.Polyline | null>(null);

    // Initialize map once
    useEffect(() => {
        if (!mapContainerRef.current || mapInstanceRef.current) return;

        // Inject Leaflet CSS if not already present
        if (!document.getElementById('leaflet-css')) {
            const link = document.createElement('link');
            link.id = 'leaflet-css';
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }

        const map = L.map(mapContainerRef.current, {
            center: [-19.92, -43.94], // Belo Horizonte (MG) default
            zoom: 12,
            zoomControl: true,
            attributionControl: false,
        });

        // ESRI World Imagery — free satellite tiles, no API key
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
        }).addTo(map);

        // Labels overlay for street/city names on top of satellite
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
        }).addTo(map);

        const markersLayer = L.layerGroup().addTo(map);
        markersLayerRef.current = markersLayer;
        mapInstanceRef.current = map;

        // Fix Leaflet tile rendering on resize
        setTimeout(() => map.invalidateSize(), 200);

        return () => {
            map.remove();
            mapInstanceRef.current = null;
            markersLayerRef.current = null;
        };
    }, []);

    // Update markers whenever points change
    useEffect(() => {
        const map = mapInstanceRef.current;
        const markersLayer = markersLayerRef.current;
        if (!map || !markersLayer) return;

        // Clear existing markers
        markersLayer.clearLayers();

        // Remove old polyline
        if (polylineRef.current) {
            map.removeLayer(polylineRef.current);
            polylineRef.current = null;
        }

        if (points.length === 0) return;

        const latLngs: L.LatLng[] = [];

        points.forEach((point, idx) => {
            if (!point.lat || !point.lon) return;

            const latLng = L.latLng(point.lat, point.lon);
            latLngs.push(latLng);

            // Determine marker color
            let color = '#3b82f6'; // blue for pre_projeto
            if (appMode === 'ambiental') color = '#10b981'; // emerald
            if (appMode === 'impedimentos') color = '#f59e0b'; // amber
            if (point.isDivisa) color = '#f97316'; // orange for divisa

            const marker = L.circleMarker(latLng, {
                radius: 8,
                fillColor: color,
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9,
            });

            // Tooltip with point number and title
            const label = point.isDivisa ? `D - Divisa` : `#${idx + 1}`;
            marker.bindTooltip(`${label}<br/><small>E:${point.utmE} N:${point.utmN}</small>`, {
                direction: 'top',
                offset: [0, -8],
            });

            markersLayer.addLayer(marker);

            // Add number label inside marker
            const numberIcon = L.divIcon({
                className: 'leaflet-marker-number',
                html: `<span style="
                    display:flex;align-items:center;justify-content:center;
                    width:18px;height:18px;border-radius:50%;
                    background:${color};color:white;
                    font-size:10px;font-weight:800;
                    border:2px solid white;
                    box-shadow:0 1px 4px rgba(0,0,0,0.4);
                    pointer-events:none;
                ">${point.isDivisa ? 'D' : idx + 1}</span>`,
                iconSize: [18, 18],
                iconAnchor: [9, 9],
            });

            L.marker(latLng, { icon: numberIcon, interactive: false }).addTo(markersLayer);
        });

        // Draw polyline for ambiental mode
        if (appMode === 'ambiental' && latLngs.length >= 2) {
            polylineRef.current = L.polyline(latLngs, {
                color: '#ef4444',
                weight: 3,
                opacity: 0.8,
                dashArray: '8, 6',
            }).addTo(map);
        }

        // Fit bounds to show all points
        if (latLngs.length === 1) {
            map.setView(latLngs[0], 16);
        } else if (latLngs.length > 1) {
            const bounds = L.latLngBounds(latLngs);
            map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
        }
    }, [points, appMode]);

    return (
        <div
            ref={mapContainerRef}
            style={{ width: '100%', height: '100%', minHeight: '200px' }}
        />
    );
}
