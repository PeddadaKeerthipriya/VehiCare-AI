"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Wrench,
  Sparkles,
  Shield,
  FileText,
  BellRing,
  Car,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  CreditCard,
  FileCheck,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VehiCareLogo } from "@/components/common/VehiCareLogo";

export const ONBOARDING_STORAGE_KEY = "vehicare-onboarding-completed";

interface OnboardingModalProps {
  onComplete?: () => void;
}

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const totalSteps = 4;

  // SSR-Safe check on client mount
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY);
        if (completed !== "true") {
          previousFocusRef.current = document.activeElement as HTMLElement | null;
          setIsOpen(true);
        }
      }
    } catch (err) {
      console.warn("Could not check onboarding storage:", err);
    }
  }, []);

  // Mark onboarding complete and close
  const handleComplete = useCallback(
    (redirectPath?: string) => {
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
        }
      } catch (err) {
        console.error("Could not persist onboarding completion:", err);
      }
      setIsOpen(false);
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
      if (onComplete) {
        onComplete();
      }
      if (redirectPath) {
        router.push(redirectPath);
      }
    },
    [router, onComplete]
  );

  // Focus management inside dialog
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        primaryButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, currentStep]);

  // Trap focus & listen to Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleComplete();
        return;
      }

      if (e.key === "Tab" && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleComplete]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-step-title"
      aria-describedby="onboarding-step-desc"
      ref={dialogRef}
    >
      <div className="relative w-full max-w-lg rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-[#203131] bg-white dark:bg-[#0B1515] p-5 sm:p-7 text-slate-900 dark:text-[#F5F7F6] shadow-2xl transition-all my-auto motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95">
        {/* Top Header Controls: Step indicator & Skip button */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-[#203131]">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-bold text-[#2E7D32] dark:text-[#66C56A] bg-[#2E7D32]/10 dark:bg-[#101C1C] px-2.5 py-1 rounded-full border border-[#2E7D32]/25"
              aria-label={`Step ${currentStep} of ${totalSteps}`}
            >
              {currentStep} / {totalSteps}
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`h-1.5 rounded-full transition-all ${
                    step === currentStep
                      ? "w-6 bg-[#2E7D32] dark:bg-[#66C56A]"
                      : step < currentStep
                      ? "w-3 bg-[#2E7D32]/50 dark:bg-[#66C56A]/50"
                      : "w-3 bg-slate-200 dark:bg-[#203131]"
                  }`}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleComplete()}
            className="text-xs font-semibold text-slate-500 dark:text-[#81918E] hover:text-slate-800 dark:hover:text-[#F5F7F6] px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#101C1C] transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2E7D32]"
            aria-label="Skip onboarding tour"
          >
            Skip
          </button>
        </div>

        {/* Step 1: Welcome */}
        {currentStep === 1 && (
          <div className="py-6 sm:py-8 space-y-5 text-center flex flex-col items-center">
            <VehiCareLogo size="xl" withGlow priority className="mb-1" />

            <div className="space-y-2 max-w-sm">
              <h2
                id="onboarding-step-title"
                className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-[#F5F7F6]"
              >
                Welcome to VehiCare AI
              </h2>
              <p
                id="onboarding-step-desc"
                className="text-sm sm:text-base text-slate-600 dark:text-[#81918E]"
              >
                Your intelligent vehicle health companion.
              </p>
            </div>

            <p className="text-xs text-slate-500 dark:text-[#81918E] max-w-xs leading-relaxed">
              Simplify vehicle upkeep, diagnose symptoms early, and manage maintenance, slips, and documents in one seamless workspace.
            </p>
          </div>
        )}

        {/* Step 2: AI Diagnosis */}
        {currentStep === 2 && (
          <div className="py-6 sm:py-7 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/30 shrink-0">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h2
                  id="onboarding-step-title"
                  className="text-lg sm:text-xl font-bold text-slate-900 dark:text-[#F5F7F6]"
                >
                  Understand what&apos;s wrong
                </h2>
                <span className="text-xs text-[#2E7D32] dark:text-[#66C56A] font-semibold">
                  AI Symptom Evaluation
                </span>
              </div>
            </div>

            <p
              id="onboarding-step-desc"
              className="text-xs sm:text-sm text-slate-600 dark:text-[#B8C4C2] leading-relaxed"
            >
              Describe a vehicle symptom and VehiCare AI helps identify possible causes, severity and recommended action.
            </p>

            <div className="space-y-2 rounded-xl border border-slate-200 dark:border-[#203131] bg-slate-50 dark:bg-[#101C1C] p-3.5 text-xs text-slate-700 dark:text-[#B8C4C2]">
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-[#F5F7F6]">
                <Activity className="h-4 w-4 text-[#2E7D32] dark:text-[#66C56A]" />
                <span>What AI Diagnosis Offers:</span>
              </div>
              <ul className="space-y-1.5 pl-6 list-disc text-slate-600 dark:text-[#81918E]">
                <li>Interactive symptom intake and multi-cause matching</li>
                <li>Estimated component urgency ratings (Low, Medium, High, Critical)</li>
                <li>Clear recommended next steps for maintenance scheduling</li>
              </ul>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-[#81918E] italic">
              AI diagnostic insights are preliminary estimates designed for informational guidance.
            </p>
          </div>
        )}

        {/* Step 3: Vehicle Health */}
        {currentStep === 3 && (
          <div className="py-6 sm:py-7 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/30 shrink-0">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h2
                  id="onboarding-step-title"
                  className="text-lg sm:text-xl font-bold text-slate-900 dark:text-[#F5F7F6]"
                >
                  Stay ahead of vehicle problems
                </h2>
                <span className="text-xs text-[#2E7D32] dark:text-[#66C56A] font-semibold">
                  Comprehensive Fleet Health
                </span>
              </div>
            </div>

            <p
              id="onboarding-step-desc"
              className="text-xs sm:text-sm text-slate-600 dark:text-[#B8C4C2] leading-relaxed"
            >
              Keep track of maintenance, insurance, PUC, FASTag and service history in one place.
            </p>

            {/* Feature Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {[
                { label: "Maintenance", icon: Wrench },
                { label: "Insurance", icon: Shield },
                { label: "PUC Status", icon: FileCheck },
                { label: "FASTag", icon: CreditCard },
                { label: "Service Slips", icon: FileText },
                { label: "Reminders", icon: BellRing },
              ].map((feat, idx) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-[#203131] bg-slate-50 dark:bg-[#101C1C] text-xs font-semibold text-slate-800 dark:text-[#F5F7F6]"
                  >
                    <Icon className="h-3.5 w-3.5 text-[#2E7D32] dark:text-[#66C56A] shrink-0" />
                    <span className="truncate">{feat.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 4: Vehicle Cockpit */}
        {currentStep === 4 && (
          <div className="py-6 sm:py-7 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/30 shrink-0">
                <Car className="h-6 w-6" />
              </div>
              <div>
                <h2
                  id="onboarding-step-title"
                  className="text-lg sm:text-xl font-bold text-slate-900 dark:text-[#F5F7F6]"
                >
                  Everything about your vehicle in one place
                </h2>
                <span className="text-xs text-[#2E7D32] dark:text-[#66C56A] font-semibold">
                  Garage Ready
                </span>
              </div>
            </div>

            <p
              id="onboarding-step-desc"
              className="text-xs sm:text-sm text-slate-600 dark:text-[#B8C4C2] leading-relaxed"
            >
              Track your vehicles, health activity, documents, reminders and service history from a single dashboard.
            </p>

            <div className="rounded-xl border border-[#2E7D32]/30 bg-[#2E7D32]/10 dark:bg-[#101C1C] p-4 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-[#2E7D32] dark:text-[#66C56A]">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Ready to configure your first car?</span>
              </div>
              <p className="text-slate-600 dark:text-[#81918E] leading-relaxed">
                Add your vehicle model, year, and license details now to unlock automated reminders and personalized AI diagnosis.
              </p>
            </div>
          </div>
        )}

        {/* Bottom Footer Actions */}
        <div className="pt-4 border-t border-slate-100 dark:border-[#203131] flex items-center justify-between gap-3">
          {/* Back Button (for steps > 1) */}
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-[#81918E] hover:text-slate-900 dark:hover:text-[#F5F7F6] hover:bg-slate-100 dark:hover:bg-[#101C1C] transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2E7D32]"
              aria-label="Go to previous onboarding step"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleComplete()}
              className="text-xs font-semibold text-slate-500 dark:text-[#81918E] hover:text-slate-800 dark:hover:text-[#F5F7F6] px-2 py-1 transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2E7D32] rounded-lg"
              aria-label="Skip onboarding"
            >
              Skip
            </button>
          )}

          {/* Primary Action Button */}
          {currentStep === 1 && (
            <Button
              ref={primaryButtonRef}
              onClick={() => setCurrentStep(2)}
              className="rounded-xl bg-[#2E7D32] hover:bg-[#256628] text-white px-5 py-2 text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#66C56A]"
              aria-label="Get Started with onboarding tour"
            >
              <span>Get Started</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}

          {(currentStep === 2 || currentStep === 3) && (
            <Button
              ref={primaryButtonRef}
              onClick={() => setCurrentStep((prev) => prev + 1)}
              className="rounded-xl bg-[#2E7D32] hover:bg-[#256628] text-white px-5 py-2 text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#66C56A]"
              aria-label={`Go to step ${currentStep + 1}`}
            >
              <span>Next</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}

          {currentStep === 4 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleComplete()}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-[#81918E] hover:text-slate-900 dark:hover:text-[#F5F7F6] hover:bg-slate-100 dark:hover:bg-[#101C1C] transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2E7D32]"
                aria-label="Skip adding vehicle for now and go to dashboard"
              >
                Skip for now
              </button>
              <Button
                ref={primaryButtonRef}
                onClick={() => handleComplete("/vehicles/add")}
                className="rounded-xl bg-[#2E7D32] hover:bg-[#256628] text-white px-4 py-2 text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#66C56A]"
                aria-label="Add my vehicle and complete onboarding"
              >
                <Car className="h-3.5 w-3.5" />
                <span>Add My Vehicle</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
