import React, { createContext, useContext, useState, type ReactNode, useCallback } from 'react';

type GlobalError = {
  message: string;
  code?: string;
} | null;

interface SessionContextType {
  /** Auth 등 필수 부팅 작업이 끝나 앱을 보여줄 준비가 되었는지 여부 */
  isAppReady: boolean;
  /** 전역 로딩 카운터 (0보다 크면 전역 로딩 중으로 간주) */
  globalLoadingCount: number;
  /** 전역 에러 (배너/다이얼로그 등에 사용 가능) */
  globalError: GlobalError;
  /** 앱이 준비되었음을 표시 */
  setAppReady: () => void;
  /** 전역 로딩 시작 */
  startGlobalLoading: () => void;
  /** 전역 로딩 종료 */
  endGlobalLoading: () => void;
  /** 전역 에러 설정/초기화 */
  setGlobalError: (error: GlobalError) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isAppReady, setIsAppReady] = useState(false);
  const [globalLoadingCount, setGlobalLoadingCount] = useState(0);
  const [globalError, setGlobalErrorState] = useState<GlobalError>(null);

  const setAppReady = useCallback(() => {
    setIsAppReady(true);
  }, []);

  const startGlobalLoading = useCallback(() => {
    setGlobalLoadingCount((count) => count + 1);
  }, []);

  const endGlobalLoading = useCallback(() => {
    setGlobalLoadingCount((count) => (count > 0 ? count - 1 : 0));
  }, []);

  const setGlobalError = useCallback((error: GlobalError) => {
    setGlobalErrorState(error);
  }, []);

  return (
    <SessionContext.Provider
      value={{
        isAppReady,
        globalLoadingCount,
        globalError,
        setAppReady,
        startGlobalLoading,
        endGlobalLoading,
        setGlobalError,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}

