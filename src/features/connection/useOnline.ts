import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/** Device network reachability. `null` until the first reading arrives. */
export function useOnline(): boolean | null {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(
    () =>
      NetInfo.addEventListener((s) => {
        // isInternetReachable is null while unknown; trust isConnected then.
        setOnline(Boolean(s.isConnected) && s.isInternetReachable !== false);
      }),
    [],
  );
  return online;
}
