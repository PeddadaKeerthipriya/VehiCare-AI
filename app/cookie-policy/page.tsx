"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Cookie, ShieldCheck, HardDrive, Settings, MessageSquare, Mail, Phone, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";

export default function CookiePolicyPage() {
  useTheme(); // Theme synchronization

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#071011] text-slate-900 dark:text-[#F5F7F6] py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-[#81918E] hover:text-[#2E7D32] dark:hover:text-[#66C56A] transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2E7D32] rounded-lg px-2 py-1"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Settings</span>
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#2E7D32] dark:text-[#66C56A] hover:underline"
          >
            Dashboard →
          </Link>
        </div>

        {/* Header Hero Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-[#203131] bg-white dark:bg-[#0B1515] p-6 sm:p-8 shadow-xs dark:shadow-xl space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2E7D32]/15 text-[#2E7D32] dark:text-[#66C56A] border border-[#2E7D32]/30">
            <Cookie className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-[#F5F7F6]">
              Cookie & Local Storage Policy
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-[#81918E] mt-1">
              Last updated: September 2026 • VehiCare AI Transparent Data Notice
            </p>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 dark:text-[#B8C4C2] leading-relaxed pt-1">
            This policy explains how VehiCare AI uses cookies and browser local storage technologies when you access the VehiCare AI platform.
          </p>
        </div>

        {/* Content Sections */}
        <div className="space-y-4">
          {/* Section 1: What Are Cookies & Local Storage */}
          <div className="rounded-2xl border border-slate-200 dark:border-[#203131] bg-white dark:bg-[#0B1515] p-5 sm:p-6 space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F5F7F6] flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-[#2E7D32] dark:text-[#66C56A]" />
              1. What Cookies & Browser Storage Are
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-[#81918E] leading-relaxed">
              Cookies and local browser storage (<code className="text-xs font-mono bg-slate-100 dark:bg-[#101C1C] px-1 py-0.5 rounded text-slate-800 dark:text-[#B8C4C2]">localStorage</code> and <code className="text-xs font-mono bg-slate-100 dark:bg-[#101C1C] px-1 py-0.5 rounded text-slate-800 dark:text-[#B8C4C2]">sessionStorage</code>) are standard browser features that allow web applications to store small text values securely on your device to remember authentication states and interface preferences.
            </p>
          </div>

          {/* Section 2: How VehiCare AI Uses Storage */}
          <div className="rounded-2xl border border-slate-200 dark:border-[#203131] bg-white dark:bg-[#0B1515] p-5 sm:p-6 space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F5F7F6] flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#2E7D32] dark:text-[#66C56A]" />
              2. Strictly Necessary Technologies
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-[#81918E] leading-relaxed">
              VehiCare AI only stores data strictly necessary for core application functionality, security, and your user preferences. The specific keys utilized include:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#203131] text-slate-700 dark:text-[#B8C4C2]">
                    <th className="py-2 pr-3 font-semibold">Storage Key / Item</th>
                    <th className="py-2 pr-3 font-semibold">Type</th>
                    <th className="py-2 font-semibold">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#203131] text-slate-600 dark:text-[#81918E]">
                  <tr>
                    <td className="py-2.5 pr-3 font-mono font-medium text-slate-800 dark:text-[#F5F7F6]">sb-*-auth-token</td>
                    <td className="py-2.5 pr-3">Session Storage</td>
                    <td className="py-2.5">Maintains your authenticated session token securely with Supabase.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-3 font-mono font-medium text-slate-800 dark:text-[#F5F7F6]">vehicare_theme</td>
                    <td className="py-2.5 pr-3">Local Storage</td>
                    <td className="py-2.5">Remembers your visual theme mode (Light, Dark, or System).</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-3 font-mono font-medium text-slate-800 dark:text-[#F5F7F6]">vehicare-settings</td>
                    <td className="py-2.5 pr-3">Local Storage</td>
                    <td className="py-2.5">Stores distance units (km/mi), default vehicle selection, and notification preferences.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-3 font-mono font-medium text-slate-800 dark:text-[#F5F7F6]">vehicare-onboarding-completed</td>
                    <td className="py-2.5 pr-3">Local Storage</td>
                    <td className="py-2.5">Records whether the initial product introduction tour has been completed.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Third-Party Trackers & Advertising */}
          <div className="rounded-2xl border border-slate-200 dark:border-[#203131] bg-white dark:bg-[#0B1515] p-5 sm:p-6 space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F5F7F6] flex items-center gap-2">
              <Lock className="h-5 w-5 text-[#2E7D32] dark:text-[#66C56A]" />
              3. No Advertising or Third-Party Tracking
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-[#81918E] leading-relaxed">
              VehiCare AI does not use third-party advertising pixels, marketing trackers, or behavioural profiling scripts (such as Google Analytics, Meta Pixel, Hotjar, or Microsoft Clarity). We do not sell your telemetry or vehicle records to third parties.
            </p>
          </div>

          {/* Section 4: How to Manage Storage */}
          <div className="rounded-2xl border border-slate-200 dark:border-[#203131] bg-white dark:bg-[#0B1515] p-5 sm:p-6 space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F5F7F6] flex items-center gap-2">
              <Settings className="h-5 w-5 text-[#2E7D32] dark:text-[#66C56A]" />
              4. How to Manage Local Storage
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-[#81918E] leading-relaxed">
              You have full control over your local device storage. You can clear cookies and site storage at any time through your browser settings or by signing out of your account. Note that clearing local storage will require signing in again and will reset your theme preference to default.
            </p>
          </div>

          {/* Section 5: Contact Information */}
          <div className="rounded-2xl border border-slate-200 dark:border-[#203131] bg-white dark:bg-[#0B1515] p-5 sm:p-6 space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F5F7F6]">
              5. Contact Us
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-[#81918E] leading-relaxed">
              If you have any questions regarding our storage practices or data protection, please reach out to our support desk:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <a
                href="mailto:support@vehicare.ai"
                className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-[#203131] bg-slate-50 dark:bg-[#101C1C] hover:border-[#2E7D32] dark:hover:border-[#66C56A] transition-colors"
              >
                <Mail className="h-4 w-4 text-[#2E7D32] dark:text-[#66C56A] shrink-0" />
                <span className="text-xs font-semibold text-slate-800 dark:text-[#F5F7F6] truncate">support@vehicare.ai</span>
              </a>
              <a
                href="https://wa.me/918500587501"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Chat with VehiCare AI on WhatsApp"
                className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-[#203131] bg-slate-50 dark:bg-[#101C1C] hover:border-[#2E7D32] dark:hover:border-[#66C56A] transition-colors"
              >
                <MessageSquare className="h-4 w-4 text-[#2E7D32] dark:text-[#66C56A] shrink-0" />
                <span className="text-xs font-semibold text-slate-800 dark:text-[#F5F7F6] truncate">+91 85005 87501</span>
              </a>
              <div className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-[#203131] bg-slate-50 dark:bg-[#101C1C]">
                <Phone className="h-4 w-4 text-[#2E7D32] dark:text-[#66C56A] shrink-0" />
                <span className="text-xs font-semibold text-slate-800 dark:text-[#F5F7F6] truncate">+91 1800-VEHICARE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex justify-center">
          <Link href="/dashboard">
            <Button className="rounded-xl bg-[#2E7D32] hover:bg-[#256628] text-white px-6 py-2.5 text-xs font-semibold shadow-xs">
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
