"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Car,
  Wrench,
  BellRing,
  User,
} from "lucide-react";

const mobileItems = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Vehicles",
    href: "/vehicles",
    icon: Car,
  },
  {
    name: "Maintenance",
    href: "/maintenance",
    icon: Wrench,
  },
  {
    name: "Reminders",
    href: "/reminders",
    icon: BellRing,
  },
  {
    name: "Profile",
    href: "/profile",
    icon: User,
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#203131] bg-[#0B1515] pb-safe backdrop-blur-md md:hidden">
      <div className="flex h-16 items-center justify-around px-2">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex flex-col items-center justify-center flex-1 h-full py-1 text-[#81918E] hover:text-[#F5F7F6] active:scale-95 transition-all"
            >
              <div
                className={cn(
                  "flex items-center justify-center rounded-xl w-11 h-7 transition-all duration-150",
                  isActive
                    ? "bg-[#101C1C] text-[#66C56A] border border-[#203131] shadow-xs"
                    : "text-[#81918E]"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium tracking-tight mt-1 transition-colors",
                  isActive ? "text-[#66C56A] font-semibold" : "text-[#81918E]"
                )}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
