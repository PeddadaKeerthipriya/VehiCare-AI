import React from "react";
import { Sidebar } from "@/components/navigation/Sidebar";
import { Header } from "@/components/navigation/Header";
import { BottomNav } from "@/components/navigation/BottomNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#071011] text-[#F5F7F6]">
      {/* Sidebar for Desktop */}
      <Sidebar />

      {/* Main content wrapper */}
      <div className="flex flex-col min-h-screen md:pl-64">
        {/* Dynamic Header */}
        <Header />

        {/* Dynamic Inner Page Contents */}
        <main className="flex-1 px-4 py-6 sm:px-6 md:pb-8 pb-24">
          <div className="mx-auto max-w-5xl">
            {children}
          </div>
        </main>

        {/* Bottom Tab Bar Navigation for Mobile */}
        <BottomNav />
      </div>
    </div>
  );
}
