import React from "react";
import { VehiCareLogo } from "./VehiCareLogo";

interface LoadingProps {
  fullPage?: boolean;
}

export function Loading({ fullPage = false }: LoadingProps) {
  if (fullPage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 dark:bg-[#071011]/90 backdrop-blur-md">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center">
            {/* Subtle spinning green accent ring */}
            <div className="absolute -inset-2 rounded-full border-2 border-transparent border-t-[#66C56A] border-r-[#2E7D32] animate-spin" />
            <VehiCareLogo size="lg" withGlow priority />
          </div>
          <div className="flex flex-col items-center">
            <p className="text-sm font-semibold tracking-wider text-slate-200 dark:text-[#F5F7F6]">
              VehiCare <span className="text-[#66C56A]">AI</span>
            </p>
            <span className="text-[11px] text-slate-400 dark:text-[#81918E] animate-pulse mt-0.5">
              Loading workspace...
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Inside-page Skeleton Loader
  return (
    <div className="w-full space-y-4 py-6">
      <div className="flex items-center space-x-4">
        <div className="h-12 w-12 animate-pulse rounded-xl bg-slate-200"></div>
        <div className="space-y-2 flex-1">
          <div className="h-4 w-1/4 animate-pulse rounded-md bg-slate-200"></div>
          <div className="h-3 w-1/2 animate-pulse rounded-md bg-slate-200"></div>
        </div>
      </div>
      <div className="space-y-3 pt-4">
        <div className="h-24 w-full animate-pulse rounded-2xl bg-slate-100"></div>
        <div className="h-32 w-full animate-pulse rounded-2xl bg-slate-100"></div>
      </div>
    </div>
  );
}

export default Loading;
