import { useRef, useEffect } from 'react';

const KAKAO_API_KEY = process.env.EXPO_PUBLIC_KAKAO_MAPS_KEY || '';

declare global {
  interface Window {
    kakao: any;
  }
}

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

type SpotMapProps = {
  lat: number;
  lng: number;
  name: string;
  address?: string;
};

export default function SpotMap({ lat, lng, name, address }: SpotMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !KAKAO_API_KEY) return;

    loadKakaoMapsScript()
      .then(() => {
        if (!containerRef.current || !window.kakao) return;

        const position = new window.kakao.maps.LatLng(lat, lng);
        const map = new window.kakao.maps.Map(containerRef.current, {
          center: position,
          level: 3,
        });
        mapRef.current = map;

        // 마커
        const marker = new window.kakao.maps.Marker({
          position,
          map,
        });

        // 장소명 + 주소 카드 오버레이
        const addressLine = address ? `<div style="font-size:11px;color:#64748b;margin-top:2px;white-space:nowrap;">${address}</div>` : '';
        const overlay = new window.kakao.maps.CustomOverlay({
          position,
          content: `<div style="padding:8px 12px;background:#fff;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.15);border:1px solid #e2e8f0;"><div style="font-size:13px;font-weight:700;color:#1e293b;white-space:nowrap;">${name}</div>${addressLine}</div>`,
          yAnchor: 1.8,
          map,
        });
      })
      .catch((err) => console.error('SpotMap load error:', err));
  }, [lat, lng, name]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: 220,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    />
  );
}
