"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Car,
  Bike,
  Plus,
  Sparkles,
  Wrench,
  ShieldCheck,
  Fuel,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

interface DashboardOnboardingProps {
  userName?: string;
}

export function DashboardOnboarding({ userName = "Driver" }: DashboardOnboardingProps) {
  return (
    <div className="space-y-6 max-w-5xl mx-auto py-4 sm:py-8">
      {/* ========================================================================
          HERO ONBOARDING BANNER
          ======================================================================== */}
      <div className="relative overflow-hidden rounded-3xl border border-[#203131] bg-gradient-to-br from-[#071011] via-[#0B1515] to-[#122222] p-6 sm:p-10 md:p-12 text-[#F5F7F6] shadow-2xl">
        {/* Ambient Glows */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-[#66C56A]/15 blur-3xl"></div>
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-72 w-72 rounded-full bg-[#2E7D32]/20 blur-3xl"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#2E7D32]/40 bg-[#101C1C] px-3.5 py-1 text-xs font-semibold text-[#66C56A]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Getting Started with VehiCare-AI</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#F5F7F6] leading-tight">
              Welcome aboard, {userName}! Let&apos;s set up your garage.
            </h1>

            <p className="text-sm sm:text-base text-[#B8C4C2] leading-relaxed">
              Your smart vehicle companion is ready. Add your first car or motorcycle to unlock
              predictive maintenance schedules, AI symptom diagnostics, digital document tracking,
              and fuel budgeting.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link href="/vehicles/add" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto rounded-2xl font-bold bg-[#2E7D32] text-white hover:bg-[#256628] shadow-lg hover:shadow-[#2E7D32]/30 transition-all h-12 px-6 text-sm flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4 stroke-[3]" />
                  <span>Add Your First Vehicle</span>
                </Button>
              </Link>
              <Link href="/profile" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto rounded-2xl font-semibold border-[#203131] bg-[#101C1C]/80 text-[#F5F7F6] hover:bg-[#132020] hover:border-[#66C56A]/40 transition-all h-12 px-6 text-sm flex items-center justify-center gap-2"
                >
                  <span>Complete Profile</span>
                  <ArrowRight className="h-4 w-4 text-[#66C56A]" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Right Icon Illustration Graphic */}
          <div className="hidden md:flex flex-col items-center justify-center p-6 rounded-3xl border border-[#203131] bg-[#101C1C]/60 backdrop-blur-sm w-64 h-64 shrink-0 shadow-inner">
            <div className="relative flex items-center justify-center">
              <div className="absolute h-24 w-24 rounded-full bg-[#66C56A]/20 animate-pulse"></div>
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#132020] border border-[#2E7D32]/50 text-[#66C56A] shadow-md">
                <Car className="h-10 w-10" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Bike className="h-5 w-5 text-[#81918E]" />
              <span className="text-xs font-semibold text-[#81918E]">Car &amp; Bike Ready</span>
            </div>
            <div className="mt-2 text-center text-[11px] text-[#66C56A] font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Free Forever for Fleet 1-5</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================
          THREE SIMPLE ONBOARDING STEPS
          ======================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Step 1 */}
        <Card className="border-[#203131] bg-[#0B1515] rounded-2xl shadow-sm hover:border-[#66C56A]/40 transition-all">
          <CardContent className="p-5 sm:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#101C1C] border border-[#2E7D32]/30 text-[#66C56A]">
                <Car className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#66C56A] bg-[#101C1C] px-2 py-0.5 rounded-full border border-[#2E7D32]/20">
                Step 1
              </span>
            </div>
            <h3 className="text-base font-bold text-[#F5F7F6]">Register Your Vehicle</h3>
            <p className="text-xs text-[#81918E] leading-relaxed">
              Enter your vehicle make, model, year, VIN, and current odometer reading. We support both cars and motorcycles.
            </p>
          </CardContent>
        </Card>

        {/* Step 2 */}
        <Card className="border-[#203131] bg-[#0B1515] rounded-2xl shadow-sm hover:border-[#66C56A]/40 transition-all">
          <CardContent className="p-5 sm:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#101C1C] border border-[#2E7D32]/30 text-[#66C56A]">
                <Wrench className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#66C56A] bg-[#101C1C] px-2 py-0.5 rounded-full border border-[#2E7D32]/20">
                Step 2
              </span>
            </div>
            <h3 className="text-base font-bold text-[#F5F7F6]">Log Services &amp; Slips</h3>
            <p className="text-xs text-[#81918E] leading-relaxed">
              Upload service receipts for automated OCR parsing or log maintenance to automatically synchronize your odometer.
            </p>
          </CardContent>
        </Card>

        {/* Step 3 */}
        <Card className="border-[#203131] bg-[#0B1515] rounded-2xl shadow-sm hover:border-[#66C56A]/40 transition-all">
          <CardContent className="p-5 sm:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#101C1C] border border-[#2E7D32]/30 text-[#66C56A]">
                <Sparkles className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#66C56A] bg-[#101C1C] px-2 py-0.5 rounded-full border border-[#2E7D32]/20">
                Step 3
              </span>
            </div>
            <h3 className="text-base font-bold text-[#F5F7F6]">Automated Health &amp; Alerts</h3>
            <p className="text-xs text-[#81918E] leading-relaxed">
              Receive smart notifications before tasks are overdue, get AI diagnostic recommendations, and monitor compliance.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ========================================================================
          WHAT YOU CAN DO WITH VEHICARE-AI
          ======================================================================== */}
      <div className="rounded-2xl border border-[#203131] bg-[#0B1515] p-5 sm:p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#81918E] mb-4">
          Key Platform Capabilities
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[#101C1C] border border-[#203131] text-[#66C56A] shrink-0">
              <Wrench className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#F5F7F6]">Predictive Schedules</h4>
              <p className="text-[11px] text-[#81918E] mt-0.5">Rules engine calculates service intervals automatically.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[#101C1C] border border-[#203131] text-[#66C56A] shrink-0">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#F5F7F6]">Compliance Vault</h4>
              <p className="text-[11px] text-[#81918E] mt-0.5">Track Insurance, PUC, and FASTag validity in one place.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[#101C1C] border border-[#203131] text-[#66C56A] shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#F5F7F6]">AI Symptom Diagnosis</h4>
              <p className="text-[11px] text-[#81918E] mt-0.5">Identify abnormal noises and mechanical faults with confidence.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[#101C1C] border border-[#203131] text-[#66C56A] shrink-0">
              <Fuel className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#F5F7F6]">Fuel &amp; Budget Tracker</h4>
              <p className="text-[11px] text-[#81918E] mt-0.5">Monitor real monthly fuel spend based on your driving distance.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
