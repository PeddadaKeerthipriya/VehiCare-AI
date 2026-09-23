"use client";

import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export type LogoSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "splash";

interface VehiCareLogoProps {
  size?: LogoSize | number;
  className?: string;
  priority?: boolean;
  withGlow?: boolean;
  alt?: string;
}

const sizeMap: Record<LogoSize, { dimension: number; containerClass: string }> = {
  xs: { dimension: 24, containerClass: "h-6 w-6" },
  sm: { dimension: 32, containerClass: "h-8 w-8" },
  md: { dimension: 40, containerClass: "h-10 w-10" },
  lg: { dimension: 56, containerClass: "h-14 w-14" },
  xl: { dimension: 72, containerClass: "h-18 w-18" },
  "2xl": { dimension: 96, containerClass: "h-24 w-24" },
  splash: { dimension: 140, containerClass: "h-28 w-28 sm:h-36 sm:w-36" },
};

export function VehiCareLogo({
  size = "md",
  className,
  priority = false,
  withGlow = false,
  alt = "VehiCare AI Official Logo",
}: VehiCareLogoProps) {
  let dimension = 40;
  let containerSizeClass = "h-10 w-10";

  if (typeof size === "number") {
    dimension = size;
    containerSizeClass = "";
  } else if (sizeMap[size]) {
    dimension = sizeMap[size].dimension;
    containerSizeClass = sizeMap[size].containerClass;
  }

  return (
    <div
      className={cn(
        "relative shrink-0 flex items-center justify-center select-none aspect-square",
        containerSizeClass,
        className
      )}
      style={typeof size === "number" ? { width: dimension, height: dimension } : undefined}
    >
      {withGlow && (
        <div
          className="pointer-events-none absolute inset-0 rounded-full bg-[#66C56A]/20 blur-xl scale-125"
          aria-hidden="true"
        />
      )}
      <Image
        src="/images/vehicare-logo.webp"
        alt={alt}
        width={dimension * 2}
        height={dimension * 2}
        priority={priority}
        className="h-full w-full object-contain rounded-full shadow-xs"
        quality={95}
      />
    </div>
  );
}
