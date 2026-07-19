import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import NetInfo from "@react-native-community/netinfo";

type OfflineContextValue = {
  isOffline: boolean;
  isConnected: boolean;
};

const OfflineContext = createContext<OfflineContextValue>({
  isOffline: false,
  isConnected: true,
});

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      // Treat unknown as connected so we don't force offline UX on cold start.
      const connected =
        state.isConnected !== false && state.isInternetReachable !== false;
      setIsConnected(connected);
    });
    void NetInfo.fetch().then((state) => {
      const connected =
        state.isConnected !== false && state.isInternetReachable !== false;
      setIsConnected(connected);
    });
    return () => unsub();
  }, []);

  const value = useMemo(
    () => ({ isConnected, isOffline: !isConnected }),
    [isConnected]
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline() {
  return useContext(OfflineContext);
}

export function useRequireOnline() {
  const { isOffline } = useOffline();
  return useCallback(() => {
    if (!isOffline) return true;
    return false;
  }, [isOffline]);
}
