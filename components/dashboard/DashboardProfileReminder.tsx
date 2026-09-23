"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CircularProgress } from "@/components/profile/CircularProgress";
import {
  getStoredCompletionState,
  calculateCompletionPercentage,
} from "@/lib/profileCompletion";
import { ProfileCompletionState } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { subscribeToSyncEvents } from "@/lib/realtimeSync";
import { fetchVehicles } from "@/lib/api";

export function DashboardProfileReminder() {
  const [completion, setCompletion] =
    useState<ProfileCompletionState>({
      basicProfile: false,
      vehicleRc: false,
      insurance: false,
      puc: false,
      fastag: false,
    });

  const [mounted, setMounted] = useState(false);

  const loadCompletion = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const state = getStoredCompletionState(user.id);

      let hasVehicles = state.vehicleRc;
      if (!hasVehicles) {
        try {
          const vList = await fetchVehicles();
          if (Array.isArray(vList) && vList.length > 0) {
            hasVehicles = true;
          }
        } catch {
          // ignore
        }
      }

      const updated: ProfileCompletionState = {
        ...state,
        vehicleRc: hasVehicles,
        basicProfile: Boolean(
          user.user_metadata?.full_name ||
          user.email
        ),
      };

      setCompletion(updated);
    } catch (err) {
      console.error("[DashboardProfileReminder] Error loading completion:", err);
    }
  };

  useEffect(() => {
    setMounted(true);
    loadCompletion();

    const unsubscribeSync = subscribeToSyncEvents((payload) => {
      console.log("[RealtimeSync] DashboardProfileReminder received sync event:", payload);
      loadCompletion();
    });

    return () => {
      unsubscribeSync();
    };
  }, []);

  if (!mounted) return null;

  const percentage = calculateCompletionPercentage(completion);
  const isComplete = percentage >= 100;

  // Determine next missing item for the prompt text
  let nextMissingItem = "RC Details";
  if (!completion.basicProfile) nextMissingItem = "Basic Profile";
  else if (!completion.vehicleRc) nextMissingItem = "RC Details";
  else if (!completion.insurance) nextMissingItem = "Insurance";
  else if (!completion.puc) nextMissingItem = "PUC Certificate";
  else if (!completion.fastag) nextMissingItem = "FASTag Toll Pass";

  return (
    <Card className="border-[#203131] bg-[#0B1515] shadow-xs hover:border-[#66C56A]/40 transition-all rounded-2xl overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left: Circular Progress + Text Summary */}
          <div className="flex items-center gap-4 min-w-0">
            <CircularProgress
              percentage={percentage}
              size={54}
              strokeWidth={5}
              trackColor="#101C1C"
              progressColor="#2E7D32"
              textColor="#66C56A"
              className="shrink-0"
            />

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#F5F7F6]">
                  Profile & Vehicle Completion
                </h3>
                {isComplete ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#9BE39A] bg-[#101C1C] px-2 py-0.5 rounded-full border border-[#2E7D32]/40">
                    <CheckCircle2 className="h-3 w-3" /> 100% Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#D9A441] bg-[#1C180E] px-2 py-0.5 rounded-full border border-[#D9A441]/30">
                    <ShieldAlert className="h-3 w-3" /> {percentage}% Complete
                  </span>
                )}
              </div>
              <p className="text-xs text-[#B8C4C2] mt-0.5 truncate max-w-md">
                {isComplete
                  ? "All vehicle documents and profile records are up to date."
                  : `Your profile is incomplete. Complete your ${nextMissingItem} next.`}
              </p>
            </div>
          </div>

          {/* Right: Action CTA */}
          <div className="shrink-0">
            <Link href="/profile" className="w-full sm:w-auto block">
              <Button
                size="sm"
                className={`w-full sm:w-auto rounded-xl text-xs font-semibold shadow-xs ${
                  isComplete
                    ? "bg-[#101C1C] text-[#F5F7F6] hover:bg-[#132020] border border-[#203131]"
                    : "bg-[#2E7D32] text-white hover:bg-[#256628]"
                }`}
              >
                <span>{isComplete ? "View Profile" : "Complete Profile"}</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
