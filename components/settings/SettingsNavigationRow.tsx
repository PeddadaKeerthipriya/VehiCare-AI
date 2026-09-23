"use client";

import React from "react";
import Link from "next/link";
import { LucideIcon, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsNavigationRowProps {
  icon?: LucideIcon;
  label: string;
  description?: string;
  value?: string;
  badge?: string;
  onClick?: () => void;
  href?: string;
  destructive?: boolean;
  className?: string;
  disabled?: boolean;
}

export function SettingsNavigationRow({
  icon: Icon,
  label,
  description,
  value,
  badge,
  onClick,
  href,
  destructive = false,
  className,
  disabled = false,
}: SettingsNavigationRowProps) {
  const content = (
    <div
      className={cn(
        "group flex w-full items-center justify-between gap-3 py-3.5 px-2 min-h-[52px] rounded-xl text-left transition-all",
        destructive
          ? "hover:bg-rose-500/10 active:bg-rose-500/20"
          : "hover:bg-secondary/70 active:bg-secondary",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl shrink-0 transition-colors",
              destructive
                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 group-hover:bg-rose-500/25"
                : "bg-secondary text-[#66C56A] border border-[#2E7D32]/30 group-hover:border-[#66C56A]/60"
            )}
          >
            <Icon className="h-4.5 w-4.5" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className={cn(
                "text-sm font-semibold leading-snug truncate",
                destructive
                  ? "text-rose-600 dark:text-rose-400 group-hover:text-rose-700 dark:group-hover:text-rose-300"
                  : "text-foreground group-hover:text-foreground"
              )}
            >
              {label}
            </p>
            {badge && (
              <span className="inline-flex items-center rounded-md bg-[#2E7D32]/20 px-2 py-0.5 text-[11px] font-medium text-[#66C56A] border border-[#2E7D32]/30">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {value && (
          <span className="text-xs sm:text-sm font-medium text-muted-foreground truncate max-w-[120px] sm:max-w-[200px]">
            {value}
          </span>
        )}
        <ChevronRight
          className={cn(
            "h-4 w-4 transition-transform group-hover:translate-x-0.5",
            destructive ? "text-rose-500/70" : "text-muted-foreground"
          )}
        />
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block w-full focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2E7D32] focus-visible:ring-offset-2 focus-visible:ring-offset-card rounded-xl"
        aria-label={label}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2E7D32] focus-visible:ring-offset-2 focus-visible:ring-offset-card rounded-xl"
      aria-label={label}
    >
      {content}
    </button>
  );
}
