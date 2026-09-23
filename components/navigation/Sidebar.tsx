"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "@/constants/navigation";
import { VehiCareLogo } from "@/components/common/VehiCareLogo";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState("User");
  const [userEmail, setUserEmail] = useState("");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setUserEmail(user.email ?? "");

        const fullName = user.user_metadata?.full_name;

        if (fullName) {
          setUserName(fullName);
        }
      }
    };

    getUser();
  }, []);

  return (
    <aside className="fixed bottom-0 left-0 top-0 z-30 hidden w-64 border-r border-[#203131] bg-[#0B1515] md:flex md:flex-col">
      {/* Brand Header */}
      <div className="flex h-16 items-center px-6 border-b border-[#203131]">
        <Link href="/dashboard" className="flex items-center gap-3">
          <VehiCareLogo size="sm" className="shrink-0" />
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-[#F5F7F6] leading-tight">
              VehiCare <span className="text-[#66C56A]">AI</span>
            </span>
            <span className="text-[10px] font-medium text-[#81918E] tracking-tight">
              by Credencer Technologies
            </span>
          </div>
        </Link>
      </div>

      {/* Main Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 scrollbar-thin">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "sidebar-nav-item group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150",
                isActive
                  ? "sidebar-nav-item-active bg-[#101C1C] text-[#66C56A] font-semibold border border-[#203131] shadow-xs"
                  : "text-[#B8C4C2] hover:bg-[#101C1C] hover:text-[#F5F7F6]"
              )}
            >
              <Icon
                className={cn(
                  "sidebar-nav-icon h-5 w-5 transition-colors",
                  isActive ? "text-[#66C56A]" : "text-[#81918E] group-hover:text-[#B8C4C2]"
                )}
              />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Footer / User Profile section */}
      <div className="border-t border-[#203131] p-3">
        <div className="flex items-center gap-3 rounded-xl p-2.5 bg-[#101C1C] border border-[#203131] transition-colors">
          <div className="h-9 w-9 rounded-xl bg-[#132020] border border-[#2E7D32]/30 flex items-center justify-center font-bold text-[#66C56A] text-sm shrink-0">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#F5F7F6] truncate">
              {userName}
            </p>
            <p className="text-xs text-[#81918E] truncate">
              {userEmail || "user@vehicare.com"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-[#81918E] hover:text-rose-400 hover:bg-rose-950/40 transition-colors shrink-0"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
