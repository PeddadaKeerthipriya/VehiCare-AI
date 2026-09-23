"use client";

import React from "react";
import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
}

export function SettingsSection({
  title,
  description,
  icon: Icon,
  children,
  className,
  headerAction,
}: SettingsSectionProps) {
  return (
    <Card
      className={cn(
        "rounded-2xl border border-border bg-card shadow-xs overflow-hidden transition-colors",
        className
      )}
    >
      <CardHeader className="p-4 sm:p-5 border-b border-border">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-[#66C56A] border border-[#2E7D32]/30 shrink-0">
              <Icon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg font-bold text-foreground truncate">
                {title}
              </CardTitle>
              {description && (
                <CardDescription className="text-xs sm:text-sm text-muted-foreground truncate mt-0.5">
                  {description}
                </CardDescription>
              )}
            </div>
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-5 pt-0 sm:pt-0 divide-y divide-border">
        {children}
      </CardContent>
    </Card>
  );
}
