"use client";

import { useState, useEffect, useRef } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface QuizTimerProps {
  timeLimitMinutes: number;
  startTime: Date;
  onTimeExpired: () => void;
  isSubmitting?: boolean;
}

export function QuizTimer({
  timeLimitMinutes,
  startTime,
  onTimeExpired,
  isSubmitting = false,
}: QuizTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);
  const hasExpiredRef = useRef(false);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - new Date(startTime).getTime()) / 1000);
      const totalSeconds = timeLimitMinutes * 60;
      const remaining = Math.max(0, totalSeconds - elapsed);

      return remaining;
    };

    // Initial calculation
    setTimeRemaining(calculateTimeRemaining());

    // Update every second
    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setTimeRemaining(remaining);

      // Check if time expired
      if (remaining === 0 && !hasExpiredRef.current && !isSubmitting) {
        hasExpiredRef.current = true;
        setIsExpired(true);
        onTimeExpired();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, timeLimitMinutes, onTimeExpired, isSubmitting]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (): string => {
    const percentage = (timeRemaining / (timeLimitMinutes * 60)) * 100;

    if (percentage > 50) return "text-green-600 bg-green-50 border-green-200";
    if (percentage > 20) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const shouldShowWarning = (): boolean => {
    const percentage = (timeRemaining / (timeLimitMinutes * 60)) * 100;
    return percentage <= 20 && timeRemaining > 0;
  };

  if (isExpired) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-2 border-red-500 rounded-lg animate-pulse">
        <AlertTriangle className="h-5 w-5 text-red-600" />
        <span className="font-bold text-red-600">Time's Up!</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-4 py-2 border-2 rounded-lg ${getStatusColor()} transition-colors duration-300`}>
      <Clock className="h-5 w-5" />
      <div className="flex flex-col">
        <span className="text-xs font-medium opacity-75">Time Remaining</span>
        <span className="text-lg font-bold font-mono">
          {formatTime(timeRemaining)}
        </span>
      </div>
      {shouldShowWarning() && (
        <Badge variant="destructive" className="ml-2 animate-pulse">
          Low Time!
        </Badge>
      )}
    </div>
  );
}
