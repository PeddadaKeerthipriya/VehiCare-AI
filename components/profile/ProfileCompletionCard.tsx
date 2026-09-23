"use client";

import React from "react";
import { CheckCircle2, ArrowRight, ShieldCheck, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileCompletionState } from "@/lib/types";
import { calculateCompletionPercentage } from "@/lib/profileCompletion";
import { CircularProgress } from "./CircularProgress";

interface ProfileCompletionCardProps {
  completion: ProfileCompletionState;
  onOpenNextMissingSection: () => void;
  nextStepName: string;
}

export function ProfileCompletionCard({
  completion,
  onOpenNextMissingSection,
  nextStepName,
}: ProfileCompletionCardProps) {
  const percentage = calculateCompletionPercentage(completion);
  const totalCompleted = Object.values(completion).filter(Boolean).length;
  const isAllComplete = percentage >= 100;

  const missingItems: string[] = [];
  if (!completion.vehicleRc) missingItems.push("RC Details");
  if (!completion.insurance) missingItems.push("Insurance");
  if (!completion.puc) missingItems.push("PUC");
  if (!completion.fastag) missingItems.push("FASTag");
  if (!completion.basicProfile) missingItems.push("Basic Profile");

  return (
    <Card className="overflow-hidden rounded-2xl border border-[#203131] bg-[#0B1515] shadow-xs">
      <div className="h-1.5 w-full bg-[#2E7D32]"></div>
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left section: Circular Progress + Info */}
          <div className="flex flex-col sm:flex-row items-start gap-4 flex-1 min-w-0">
            {/* Circular Progress Ring */}
            <div className="shrink-0 pt-0.5 self-center sm:self-start">
              <CircularProgress
                percentage={percentage}
                size={64}
                strokeWidth={6}
                trackColor="#101C1C"
                progressColor="#2E7D32"
                textColor="#66C56A"
              />
            </div>

            {/* Content Details */}
            <div className="space-y-3 flex-1 min-w-0 w-full">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/30">
                    {isAllComplete ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <ClipboardCheck className="h-4 w-4" />
                    )}
                  </div>
                  <h3 className="text-base font-bold text-[#F5F7F6]">
                    Profile & Vehicle Completion
                  </h3>
                </div>
                <span className="text-xs font-bold text-[#66C56A] bg-[#101C1C] px-2.5 py-0.5 rounded-full border border-[#2E7D32]/40">
                  {totalCompleted} of 5 Sections Complete
                </span>
              </div>

              {/* Progress bar and label */}
              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-xs font-semibold text-[#F5F7F6]">
                    {percentage}% Completed
                  </span>
                  <span className="text-xs font-semibold text-[#81918E]">
                    {isAllComplete ? "Fully Completed" : "In Progress"}
                  </span>
                </div>

                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#101C1C] p-0.5 border border-[#203131]">
                  <div
                    className="h-full rounded-full bg-[#66C56A] transition-all duration-500 ease-out shadow-[0_0_8px_rgba(102,197,106,0.5)]"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>

              <p className="text-xs text-[#B8C4C2]">
                {isAllComplete
                  ? "Congratulations! Your profile, vehicle registration, and document records are 100% complete."
                  : "Complete your vehicle and document information to unlock comprehensive fleet tracking, automatic renewal reminders, and service logs."}
              </p>

              {/* Missing items list */}
              {!isAllComplete && missingItems.length > 0 && (
                <div className="rounded-xl bg-[#101C1C] border border-[#203131] p-3 text-xs">
                  <span className="font-semibold text-[#B8C4C2] block mb-1">
                    Pending completion:
                  </span>
                  <div className="flex flex-wrap gap-2 text-[#81918E]">
                    {missingItems.map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-1 rounded-md bg-[#132020] px-2 py-1 text-[11px] font-medium text-[#B8C4C2] border border-[#203131]"
                      >
                        • {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Action CTA */}
          <div className="shrink-0 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-[#203131] pt-4 lg:pt-0 lg:pl-6 space-y-3">
            {isAllComplete ? (
              <div className="flex items-center gap-2 rounded-xl bg-[#101C1C] p-4 text-[#66C56A] border border-[#2E7D32]/40">
                <ShieldCheck className="h-6 w-6 shrink-0" />
                <span className="text-xs font-bold">100% Verified Profile</span>
              </div>
            ) : (
              <>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#81918E] block">
                    Next Recommended Step
                  </span>
                  <p className="text-sm font-bold text-[#F5F7F6] truncate max-w-[220px]">
                    {nextStepName}
                  </p>
                </div>

                <Button
                  onClick={onOpenNextMissingSection}
                  className="rounded-xl bg-[#2E7D32] text-white hover:bg-[#256628] shadow-xs font-semibold w-full sm:w-auto"
                >
                  <span>Complete {nextStepName}</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
