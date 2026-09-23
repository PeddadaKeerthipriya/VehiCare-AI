"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, User, Settings } from "lucide-react";
import Link from "next/link";
import { navItems } from "@/constants/navigation";
import { fetchAttentionRequiredRemindersCount } from "@/lib/reminders";
import { subscribeToSyncEvents } from "@/lib/realtimeSync";
import { supabase } from "@/lib/supabase";
import { VehiCareLogo } from "@/components/common/VehiCareLogo";

export function Header() {
  const pathname = usePathname();
  const currentItem = navItems.find((item) => item.href === pathname);
  const pageTitle = currentItem ? currentItem.name : "VehiCare AI";

  const [attentionCount, setAttentionCount] = useState<number>(0);

  useEffect(() => {
    let active = true;

    const loadAttentionCount = async () => {
      try {
        const count = await fetchAttentionRequiredRemindersCount();
        if (active) {
          setAttentionCount(count);
        }
      } catch (err) {
        if (active) {
          console.error("Failed to load attention-required reminders count in Header:", err);
          setAttentionCount(0);
        }
      }
    };

    loadAttentionCount();

    // Supabase Realtime: subscribe to reminder-related tables
    const channel = supabase
      .channel("header-reminders-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "maintenance_schedules",
        },
        () => {
          console.log("[Realtime] maintenance_schedules changed — reloading header reminder count");
          loadAttentionCount();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "insurance_policies",
        },
        () => {
          console.log("[Realtime] insurance_policies changed — reloading header reminder count");
          loadAttentionCount();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "puc_certificates",
        },
        () => {
          console.log("[Realtime] puc_certificates changed — reloading header reminder count");
          loadAttentionCount();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vehicles",
        },
        () => {
          console.log("[Realtime] vehicles changed — reloading header reminder count");
          loadAttentionCount();
        }
      )
      .subscribe((status) => {
        console.log("[Realtime] header reminders channel:", status);
      });

    // Sync bus: instant same-tab, cross-tab, and Supabase broadcast updates
    const unsubscribeSync = subscribeToSyncEvents((payload) => {
      console.log("[RealtimeSync] Header received sync event — reloading reminder count:", payload);
      loadAttentionCount();
    });

    return () => {
      active = false;
      unsubscribeSync();
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#203131] bg-[#0B1515] px-4 sm:px-6">
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between">
        {/* Left Side: App Title & Mobile Brand Icon */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2.5 md:hidden">
            <VehiCareLogo size="xs" className="shrink-0" />
            <div className="flex flex-col">
              <span className="text-sm font-bold text-[#F5F7F6] leading-tight">
                VehiCare <span className="text-[#66C56A]">AI</span>
              </span>
              <span className="text-[9px] font-medium text-[#81918E] tracking-tight">
                by Credencer Technologies
              </span>
            </div>
          </Link>

          <h1 className="hidden md:block text-lg font-bold text-[#F5F7F6] sm:text-xl">
            {pageTitle}
          </h1>
        </div>

        {/* Right Side: Quick Action Navigation */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Reminders Icon Link with Live Unread Badge */}
          <Link
            href="/reminders"
            className="relative flex h-9 w-9 items-center justify-center rounded-xl text-[#B8C4C2] transition-colors hover:text-[#66C56A] hover:bg-[#101C1C] border border-transparent hover:border-[#203131] active:scale-95"
            title="Reminders"
            aria-label="Reminders"
          >
            <Bell className="h-5 w-5" />
            {attentionCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2E7D32] px-1 text-[10px] font-bold text-white shadow-xs">
                {attentionCount > 9 ? "9+" : attentionCount}
              </span>
            )}
          </Link>

          {/* Profile Icon Link */}
          <Link
            href="/profile"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#B8C4C2] transition-colors hover:text-[#66C56A] hover:bg-[#101C1C] border border-transparent hover:border-[#203131] active:scale-95"
            title="Profile"
            aria-label="Profile"
          >
            <User className="h-5 w-5" />
          </Link>

          {/* Settings Icon Link */}
          <Link
            href="/settings"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#B8C4C2] transition-colors hover:text-[#66C56A] hover:bg-[#101C1C] border border-transparent hover:border-[#203131] active:scale-95"
            title="Settings"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
