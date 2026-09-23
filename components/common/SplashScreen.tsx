"use client";

import React, { useEffect, useState } from "react";
import { VehiCareLogo } from "./VehiCareLogo";
import { cn } from "@/lib/utils";

interface SplashScreenProps {
  onFinish?: () => void;
  duration?: number;
  className?: string;
}

export function SplashScreen({
  onFinish,
  duration = 1800,
  className,
}: SplashScreenProps) {
  const [phase, setPhase] = useState<"enter" | "active" | "exit">("enter");

  useEffect(() => {
    // Phase 1: Enter -> Active (subtle scale & fade in)
    const enterTimer = setTimeout(() => {
      setPhase("active");
    }, 50);

    // Phase 2: Start exit transition before unmounting
    const exitTimer = setTimeout(() => {
      setPhase("exit");
    }, Math.max(duration - 400, 800));

    // Phase 3: Finish callback
    const finishTimer = setTimeout(() => {
      onFinish?.();
    }, duration);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(finishTimer);
    };
  }, [duration, onFinish]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#071011] text-[#F5F7F6] select-none transition-opacity duration-400 ease-out",
        phase === "enter" && "opacity-0",
        phase === "active" && "opacity-100",
        phase === "exit" && "opacity-0 pointer-events-none",
        className
      )}
      aria-label="VehiCare AI Splash Screen"
      role="dialog"
      aria-modal="true"
    >
      {/* Subtle Atmospheric Ambient Glow */}
      <div
        className={cn(
          "pointer-events-none absolute h-64 w-64 sm:h-80 sm:w-80 rounded-full bg-[#66C56A]/10 blur-3xl transition-transform duration-1000 ease-out",
          phase === "active" ? "scale-110 opacity-100" : "scale-75 opacity-0"
        )}
        aria-hidden="true"
      />

      {/* Centered Brand Content */}
      <div
        className={cn(
          "relative z-10 flex flex-col items-center text-center px-6 transition-all duration-700 ease-out",
          phase === "enter" && "scale-90 opacity-0 translate-y-2",
          phase === "active" && "scale-100 opacity-100 translate-y-0",
          phase === "exit" && "scale-105 opacity-0 -translate-y-1"
        )}
      >
        {/* Official VehiCare AI Logo Badge */}
        <div className="relative mb-6">
          <div className="absolute -inset-2 rounded-full bg-gradient-to-b from-[#66C56A]/20 via-[#2E7D32]/10 to-transparent blur-md" />
          <VehiCareLogo size="splash" priority withGlow />
        </div>

        {/* Brand Typography */}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F7F6] leading-tight">
          VehiCare <span className="text-[#66C56A]">AI</span>
        </h1>

        <p className="mt-1 text-xs sm:text-sm font-medium text-[#81918E] tracking-wide">
          by Credencer Technologies
        </p>

        {/* Minimal Subtle Loading Indicator */}
        <div className="mt-8 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#66C56A] animate-pulse" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#66C56A]/60 animate-pulse [animation-delay:200ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#66C56A]/30 animate-pulse [animation-delay:400ms]" />
        </div>
      </div>
    </div>
  );
}
