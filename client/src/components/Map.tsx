// Map.tsx — Google Maps direto (sem proxy Manus)
// Configure VITE_GOOGLE_MAPS_API_KEY no .env para habilitar mapas

import { useEffect, useRef } from "react";

interface MapViewProps {
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
  className?: string;
  style?: React.CSSProperties;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

function loadGoogleMaps(): Promise<void> {
  if (typeof google !== "undefined" && google.maps) return Promise.resolve();
  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error("VITE_GOOGLE_MAPS_API_KEY não configurado no .env"));
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,drawing,geometry`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar Google Maps"));
    document.head.appendChild(script);
  });
}

export function MapView({
  initialCenter = { lat: -23.5505, lng: -46.6333 },
  initialZoom = 14,
  onMapReady,
  className,
  style,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const map = new google.maps.Map(containerRef.current, {
          center: initialCenter,
          zoom: initialZoom,
        });
        mapRef.current = map;
        onMapReady?.(map);
      })
      .catch((err) => {
        if (cancelled) return;
        if (containerRef.current) {
          containerRef.current.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#888;font-size:12px;padding:16px;text-align:center">${err.message}</div>`;
        }
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "300px", background: "#f5f5f5", borderRadius: "8px", ...style }}
    />
  );
}

export default MapView;
