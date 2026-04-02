/**
 * DeviceCard Component
 * Displays a single device with session controls.
 * Features:
 * - Double-click guard to prevent duplicate operations
 * - Ghost session warning for sessions > 6 hours
 * - Arabic error messages
 * - Disabled state during processing
 */

import { useState, useEffect } from 'react';
import { startSession, stopSession, calculateSessionPrice, Session } from '@/lib/sessions';
import { sanitizeError } from '@/lib/errors';
import { isGhostRisk } from '@/hooks/useDevices';
import { toast } from 'sonner';

interface Device {
  id: number;
  name: string;
  status: 'available' | 'busy';
  hourly_rate: number;
  branch_id: string;
}

interface DeviceCardProps {
  device: Device;
  session?: Session;
  onSessionUpdate: () => void;
}

/**
 * Hook to track elapsed time for active sessions
 */
function useElapsedTime(startTime?: string) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!startTime) {
      setElapsed('');
      return;
    }

    const update = () => {
      const diff = Date.now() - new Date(startTime).getTime();
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setElapsed(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return elapsed;
}

export default function DeviceCard({ device, session, onSessionUpdate }: DeviceCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [estimatedPrice, setEstimatedPrice] = useState(0);

  const isActive = !!session;
  const elapsed = useElapsedTime(session?.start_time);
  const ghostRisk = session ? isGhostRisk(session.start_time) : false;

  // Update estimated price every second
  useEffect(() => {
    if (!session) {
      setEstimatedPrice(0);
      return;
    }

    const update = () => {
      const durationSeconds = (Date.now() - new Date(session.start_time).getTime()) / 1000;
      const price = calculateSessionPrice(durationSeconds, session.hourly_rate);
      setEstimatedPrice(price);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [session]);

  /**
   * Handle starting a new session with double-click guard
   */
  const handleStartSession = async () => {
    if (isProcessing) return; // Idempotency guard

    setIsProcessing(true);
    try {
      await startSession(device.id, undefined, 'single', device.hourly_rate);
      toast.success('تم بدء الجلسة بنجاح');
      onSessionUpdate();
    } catch (error) {
      const appError = sanitizeError(error);
      toast.error(appError.message);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Handle stopping the current session with double-click guard
   */
  const handleStopSession = async () => {
    if (!session || isProcessing) return; // Idempotency guard

    setIsProcessing(true);
    try {
      await stopSession(session.id);
      toast.success(`تمت الجلسة — ${estimatedPrice} جنيه`);
      onSessionUpdate();
    } catch (error) {
      const appError = sanitizeError(error);
      toast.error(appError.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-lg border-2 transition-all duration-300 p-4 ${
        isActive
          ? 'border-green-500 bg-green-50 dark:bg-green-950'
          : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
      }`}
    >
      {/* Device Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{device.name}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {isActive ? 'جلسة نشطة' : 'متاح'}
        </p>
      </div>

      {/* Active Session Info */}
      {isActive && session && (
        <div className="mb-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">المدة:</span>
            <span className="font-mono text-lg font-bold text-green-600 dark:text-green-400">
              {elapsed}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">السعر المتوقع:</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {estimatedPrice.toFixed(2)} جنيه
            </span>
          </div>

          {/* Ghost Session Warning */}
          {ghostRisk && (
            <div className="mt-3 flex items-center gap-2 rounded-md bg-amber-500/20 border border-amber-500/40 px-3 py-2">
              <span className="text-amber-600 dark:text-amber-400 text-sm">⚠️</span>
              <span className="text-amber-700 dark:text-amber-300 text-xs">
                جلسة طويلة — يرجى المراجعة
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {!isActive ? (
          <button
            onClick={handleStartSession}
            disabled={isProcessing}
            className={`flex-1 px-4 py-2 rounded-md font-semibold transition-colors ${
              isProcessing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                : 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600'
            }`}
          >
            {isProcessing ? 'جاري البدء...' : 'بدء الجلسة'}
          </button>
        ) : (
          <button
            onClick={handleStopSession}
            disabled={isProcessing}
            className={`flex-1 px-4 py-2 rounded-md font-semibold transition-colors ${
              isProcessing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                : 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600'
            }`}
          >
            {isProcessing ? 'جاري الإنهاء...' : 'إنهاء الجلسة'}
          </button>
        )}
      </div>
    </div>
  );
}
