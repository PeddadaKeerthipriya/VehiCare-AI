"use client";

import React from "react";
import { Check, Loader2, AlertCircle, FileUp, Cpu, FileCheck2, CheckCircle2 } from "lucide-react";
import { SlipStatus } from "@/lib/types";

interface SlipStatusStepperProps {
  status: SlipStatus | string | null;
  errorMessage?: string | null;
}

interface StepConfig {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: StepConfig[] = [
  {
    key: "Uploaded",
    label: "Uploaded",
    description: "Receipt stored securely",
    icon: FileUp,
  },
  {
    key: "OCR running",
    label: "OCR Processing",
    description: "Analyzing text & fields",
    icon: Cpu,
  },
  {
    key: "Parsed",
    label: "Parsed & Ready",
    description: "Extracted for review",
    icon: FileCheck2,
  },
  {
    key: "Confirmed",
    label: "Confirmed",
    description: "Logged to vehicle record",
    icon: CheckCircle2,
  },
];

export const SlipStatusStepper: React.FC<SlipStatusStepperProps> = ({
  status,
  errorMessage,
}) => {
  const isFailed = status === "OCR failed" || Boolean(errorMessage);

  const getStepState = (stepIndex: number): "completed" | "active" | "failed" | "pending" => {
    if (!status) return stepIndex === 0 ? "active" : "pending";

    const statusHierarchy: Record<string, number> = {
      "Uploaded": 0,
      "OCR running": 1,
      "Parsed": 2,
      "Confirmed": 3,
    };

    const currentLevel = statusHierarchy[status] ?? (isFailed ? 1 : 0);

    if (isFailed && stepIndex === currentLevel) {
      return "failed";
    }

    if (currentLevel > stepIndex) {
      return "completed";
    }

    if (currentLevel === stepIndex) {
      return "active";
    }

    return "pending";
  };

  return (
    <div className="w-full space-y-4">
      {/* Mobile/Desktop Stepper Container */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {STEPS.map((step, idx) => {
          const state = getStepState(idx);
          const Icon = step.icon;

          let cardStyle = "border-[#203131] bg-[#0B1515] text-[#81918E]";
          let badgeStyle = "bg-[#101C1C] text-[#81918E] border-[#203131]";

          if (state === "completed") {
            cardStyle = "border-[#2E7D32]/50 bg-[#101C1C]/40 text-[#F5F7F6]";
            badgeStyle = "bg-[#2E7D32] text-white border-[#2E7D32]";
          } else if (state === "active") {
            cardStyle = "border-[#66C56A] bg-[#0B1515] shadow-xs text-[#F5F7F6] ring-1 ring-[#66C56A]/20";
            badgeStyle = "bg-[#101C1C] text-[#66C56A] border-[#2E7D32] animate-pulse";
          } else if (state === "failed") {
            cardStyle = "border-rose-900 bg-rose-950/40 text-rose-300 ring-1 ring-rose-900";
            badgeStyle = "bg-rose-600 text-white border-rose-600";
          }

          return (
            <div
              key={step.key}
              className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all ${cardStyle}`}
            >
              {/* Badge Icon */}
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold ${badgeStyle}`}
              >
                {state === "completed" ? (
                  <Check className="h-4 w-4 text-white" />
                ) : state === "active" && status !== "Confirmed" && status !== "Parsed" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#66C56A]" />
                ) : state === "failed" ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>

              {/* Text Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold truncate">{step.label}</span>
                </div>
                <p className="text-[11px] text-[#81918E] truncate">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
