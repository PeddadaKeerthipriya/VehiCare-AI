"use client";

import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsRowProps {
  icon?: LucideIcon;
  label: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  destructive?: boolean;
}

export function SettingsRow({
  icon: Icon,
  label,
  description,
  children,
  className,
  destructive = false,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 py-3.5 px-2 min-h-[52px]",
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl shrink-0 transition-colors",
              destructive
                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                : "bg-secondary text-[#66C56A] border border-[#2E7D32]/30"
            )}
          >
            <Icon className="h-4.5 w-4.5" />
          </div>
        )}
        <div className="min-w-0">
          <p
            className={cn(
              "text-sm font-semibold leading-snug truncate",
              destructive ? "text-rose-600 dark:text-rose-400" : "text-foreground"
            )}
          >
            {label}
          </p>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="shrink-0 flex items-center">{children}</div>
    </div>
  );
}
