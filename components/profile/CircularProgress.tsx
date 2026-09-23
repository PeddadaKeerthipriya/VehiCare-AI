"use client";

import React from "react";
import { Check } from "lucide-react";

interface CircularProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  showText?: boolean;
  className?: string;
  trackColor?: string;
  progressColor?: string;
  textColor?: string;
}

export function CircularProgress({
  percentage,
  size = 56,
  strokeWidth = 5,
  showText = true,
  className = "",
  trackColor = "#101C1C",
  progressColor = "#2E7D32",
  textColor = "#66C56A",
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percentage));
  const offset = circumference - (clamped / 100) * circumference;
  const isComplete = clamped >= 100;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Profile Completion ${clamped}%`}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90 transform"
      >
        {/* Background Track Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          className="circular-progress-track"
        />
        {/* Animated Progress Stroke */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="circular-progress-bar transition-all duration-500 ease-out"
        />
      </svg>

      {/* Center Label */}
      {showText && (
        <div className="absolute inset-0 flex items-center justify-center text-center">
          {isComplete ? (
            <Check className="circular-progress-check h-4 w-4 text-[#66C56A] stroke-[3]" />
          ) : (
            <span
              className="circular-progress-text font-extrabold leading-none"
              style={{
                color: textColor,
                fontSize: Math.max(10, Math.round(size * 0.25)),
              }}
            >
              {clamped}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
