import { useEffect, useRef } from 'react';

const KAKAO_API_KEY = process.env.EXPO_PUBLIC_KAKAO_MAPS_KEY || '';

declare global {
  interface Window {
    kakao: any;
  }
}

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };
const DEFAULT_LEVEL = 5;

const loadKakaoMapsScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return reject(new Error('Not in browser environment'));
    }
    if (!KAKAO_API_KEY) return reject(new Error('NO_API_KEY'));
    if (window.kakao && window.kakao.maps) return resolve();

    const id = 'kakao-maps-script';
    const existingScript = document.getElementById(id);
    if (existingScript) {
      const checkInterval = setInterval(() => {
        if (window.kakao && window.kakao.maps) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.id = id;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_API_KEY}&libraries=services&autoload=false`;
    script.onload = () => {
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => resolve());
      } else {
        reject(new Error('Kakao Maps failed to load'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Kakao Maps'));
    document.head.appendChild(script);
  });
};

type PlacePickerMapProps = {
  lat: number | null;
  lng: number | null;
  onSelect: (lat: number, lng: number) => void;
};

export default function PlacePickerMap({ lat, lng, onSelect }: PlacePickerMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !KAKAO_API_KEY) return;
    if (mapRef.current) return;

    loadKakaoMapsScript()
      .then(() => {
        if (!containerRef.current || !window.kakao) return;
        if (mapRef.current) return;

        const centerLat = lat ?? DEFAULT_CENTER.lat;
        const centerLng = lng ?? DEFAULT_CENTER.lng;
        const center = new window.kakao.maps.LatLng(centerLat, centerLng);

        const map = new window.kakao.maps.Map(containerRef.current, {
          center,
          level: DEFAULT_LEVEL,
        });
        mapRef.current = map;

        window.kakao.maps.event.addListener(map, 'click', (mouseEvent: any) => {
          const clickedLat = mouseEvent.latLng.getLat();
          const clickedLng = mouseEvent.latLng.getLng();
          onSelect(clickedLat, clickedLng);
        });
      })
      .catch((err) => console.error('PlacePickerMap load error:', err));
  }, [lat, lng, onSelect]);

  useEffect(() => {
    if (!mapRef.current || !window.kakao) return;

    if (lat == null || lng == null) {
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      return;
    }

    const position = new window.kakao.maps.LatLng(lat, lng);
    if (!markerRef.current) {
      markerRef.current = new window.kakao.maps.Marker({ position, map: mapRef.current });
    } else {
      markerRef.current.setPosition(position);
    }
    mapRef.current.setCenter(position);
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    />
  );
}
