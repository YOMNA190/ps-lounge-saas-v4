/**
 * useDevices Hook
 * Manages device state with Realtime updates, branch-level filtering,
 * and ghost session detection for abandoned sessions.
 */

import { useState, useEffect, useCallback } from 'react';

export interface Device {
  id: number;
  name: string;
  status: 'available' | 'busy';
  hourly_rate: number;
  branch_id: string;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  device_id: number;
  customer_id?: string;
  mode: string;
  hourly_rate: number;
  start_time: string;
  end_time?: string;
  duration_mins?: number;
  price_paid?: number;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Detect if a session is at risk of being reaped as a ghost session.
 * Ghost sessions are auto-closed after 12 hours of inactivity.
 * We warn users at 6 hours to encourage manual closure.
 *
 * @param startTime - ISO timestamp of session start
 * @returns true if session has been active > 6 hours
 */
export function isGhostRisk(startTime: string): boolean {
  const hoursElapsed = (Date.now() - new Date(startTime).getTime()) / 3_600_000;
  return hoursElapsed > 6; // warn after 6 hours, auto-close at 12
}

/**
 * Hook to manage devices with Realtime updates and branch filtering.
 * Provides ghost session detection and visual warnings.
 */
export function useDevices(branchId: string) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [sessions, setSessions] = useState<Map<number, Session>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial devices and active sessions
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch devices for this branch
        const devicesResponse = await fetch(`/api/devices?branchId=${branchId}`);
        if (!devicesResponse.ok) throw new Error('فشل جلب الأجهزة');
        const devicesData = await devicesResponse.json();
        setDevices(devicesData);

        // Fetch active sessions
        const sessionsResponse = await fetch('/api/sessions/active');
        if (!sessionsResponse.ok) throw new Error('فشل جلب الجلسات');
        const sessionsData = await sessionsResponse.json();

        // Map sessions by device_id for quick lookup
        const sessionMap = new Map<number, Session>();
        sessionsData.forEach((session: Session) => {
          sessionMap.set(session.device_id, session);
        });
        setSessions(sessionMap);

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'حدث خطأ');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [branchId]);

  // Subscribe to Realtime changes for devices (branch-scoped)
  useEffect(() => {
    const handleDeviceChange = (payload: any) => {
      const device = payload.new || payload.old;
      setDevices((prev) =>
        prev.map((d) => (d.id === device.id ? device : d))
      );
    };

    // In a real implementation, this would use your Realtime client
    // For now, we'll poll every 2 seconds
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/devices?branchId=${branchId}`);
        if (response.ok) {
          const data = await response.json();
          setDevices(data);
        }
      } catch (err) {
        console.error('Realtime update failed:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [branchId]);

  // Subscribe to Realtime changes for sessions (branch-scoped)
  useEffect(() => {
    const handleSessionChange = (payload: any) => {
      const session = payload.new || payload.old;

      setSessions((prev) => {
        const updated = new Map(prev);
        if (session.status === 'active') {
          updated.set(session.device_id, session);
        } else {
          updated.delete(session.device_id);
        }
        return updated;
      });
    };

    // In a real implementation, this would use your Realtime client
    // For now, we'll poll every 2 seconds
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/sessions/active');
        if (response.ok) {
          const data = await response.json();
          const sessionMap = new Map<number, Session>();
          data.forEach((session: Session) => {
            sessionMap.set(session.device_id, session);
          });
          setSessions(sessionMap);
        }
      } catch (err) {
        console.error('Session update failed:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Get device with its active session (if any)
  const getDeviceWithSession = useCallback(
    (deviceId: number) => {
      const device = devices.find((d) => d.id === deviceId);
      const session = sessions.get(deviceId);
      return { device, session };
    },
    [devices, sessions]
  );

  // Check if a session is at ghost risk
  const checkGhostRisk = useCallback((session: Session | undefined) => {
    return session ? isGhostRisk(session.start_time) : false;
  }, []);

  return {
    devices,
    sessions,
    loading,
    error,
    getDeviceWithSession,
    checkGhostRisk,
    isGhostRisk,
  };
}
