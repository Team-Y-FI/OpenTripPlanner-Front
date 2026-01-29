import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

interface NetworkContextType {
  /** 현재 온라인 여부 (간단한 추정 값) */
  isOnline: boolean;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // 웹 환경에서는 navigator.onLine 을 사용해서 대략적인 온라인 여부를 판단
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'navigator' in window) {
      const updateStatus = () => {
        setIsOnline(window.navigator.onLine);
      };

      updateStatus();
      window.addEventListener('online', updateStatus);
      window.addEventListener('offline', updateStatus);

      return () => {
        window.removeEventListener('online', updateStatus);
        window.removeEventListener('offline', updateStatus);
      };
    }

    // 네이티브 환경에서는 추후 NetInfo 등을 붙일 수 있도록 true 로 고정
    setIsOnline(true);
    return undefined;
  }, []);

  return (
    <NetworkContext.Provider value={{ isOnline }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}

