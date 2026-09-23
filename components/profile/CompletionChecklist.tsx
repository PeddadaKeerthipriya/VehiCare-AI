"use client";

import React from "react";
import {
  CheckCircle2,
  Circle,
  Car,
  ShieldCheck,
  FileCheck,
  CreditCard,
  User,
  Plus,
  Edit2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ProfileCompletionState,
  RCDetails,
  InsuranceDetails,
  PUCDetails,
  FASTagDetails,
} from "@/lib/types";

interface CompletionChecklistProps {
  completion: ProfileCompletionState;
  rcData?: RCDetails | null;
  insuranceData?: InsuranceDetails | null;
  pucData?: PUCDetails | null;
  fastagData?: FASTagDetails | null;
  onOpenEditProfile: () => void;
  onOpenRCModal: () => void;
  onOpenInsuranceModal: () => void;
  onOpenPUCModal: () => void;
  onOpenFASTagModal: () => void;
}

export function CompletionChecklist({
  completion,
  rcData,
  insuranceData,
  pucData,
  fastagData,
  onOpenEditProfile,
  onOpenRCModal,
  onOpenInsuranceModal,
  onOpenPUCModal,
  onOpenFASTagModal,
}: CompletionChecklistProps) {
  const sections = [
    {
      id: "basicProfile",
      title: "Basic Profile",
      weight: "20%",
      isComplete: completion.basicProfile,
      icon: User,
      summary: completion.basicProfile
        ? "Full name and primary contact verified"
        : "Name, phone number and driver role",
      actionText: completion.basicProfile ? "Edit Profile" : "Complete Profile",
      onAction: onOpenEditProfile,
      isRealSync: true,
    },
    {
      id: "vehicleRc",
      title: "Vehicle / RC Details",
      weight: "35%",
      isComplete: completion.vehicleRc,
      icon: Car,
      summary: rcData
        ? `${rcData.registrationNumber} • ${rcData.year} ${rcData.make} ${rcData.model}`
        : "Registration certificate, VIN, and specs",
      actionText: rcData ? "Edit RC Details" : "Add RC Details",
      onAction: onOpenRCModal,
      isRealSync: false,
    },
    {
      id: "insurance",
      title: "Insurance Policy",
      weight: "20%",
      isComplete: completion.insurance,
      icon: ShieldCheck,
      summary: insuranceData
        ? `${insuranceData.provider} • Policy: ${insuranceData.policyNumber}`
        : "Policy provider, number, and validity dates",
      actionText: insuranceData ? "Edit Insurance" : "Add Insurance",
      onAction: onOpenInsuranceModal,
      isRealSync: false,
    },
    {
      id: "puc",
      title: "PUC Certificate",
      weight: "10%",
      isComplete: completion.puc,
      icon: FileCheck,
      summary: pucData
        ? `Cert: ${pucData.certificateNumber} (${pucData.status})`
        : "Pollution Under Control certificate & expiry",
      actionText: pucData ? "Edit PUC" : "Add PUC",
      onAction: onOpenPUCModal,
      isRealSync: false,
    },
    {
      id: "fastag",
      title: "FASTag Toll Pass",
      weight: "15%",
      isComplete: completion.fastag,
      icon: CreditCard,
      summary: fastagData
        ? `${fastagData.provider} • ID: ${fastagData.fastagNumber}`
        : "RFID toll tag ID and issuing bank",
      actionText: fastagData ? "Edit FASTag" : "Add FASTag",
      onAction: onOpenFASTagModal,
      isRealSync: false,
    },
  ];

  return (
    <Card className="rounded-2xl border border-[#203131] bg-[#0B1515] shadow-xs">
      <CardHeader className="pb-3 border-b border-[#203131]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <CardTitle className="text-base sm:text-lg font-bold text-[#F5F7F6]">
            Information Completion Checklist
          </CardTitle>
          <span className="text-xs text-[#81918E]">
            Weighted progress toward 100% completion
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0 divide-y divide-[#203131]">
        {sections.map((sec) => {
          const Icon = sec.icon;

          return (
            <div
              key={sec.id}
              className="checklist-row flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 gap-4 hover:bg-[#101C1C] transition-colors"
            >
              {/* Left Details */}
              <div className="flex items-start gap-3.5 min-w-0">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 mt-0.5 ${
                    sec.isComplete
                      ? "bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/30"
                      : "bg-[#132020] text-[#81918E] border border-[#203131]"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-bold text-[#F5F7F6]">
                      {sec.title}
                    </h4>
                    <span className="checklist-weight-badge text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#101C1C] text-[#B8C4C2] border border-[#203131]">
                      +{sec.weight}
                    </span>
                    {sec.isComplete ? (
                      <span className="checklist-completed-badge inline-flex items-center gap-1 text-[11px] font-semibold text-[#66C56A] bg-[#101C1C] px-2 py-0.5 rounded-full border border-[#2E7D32]/40">
                        <CheckCircle2 className="h-3 w-3" />
                        Completed
                      </span>
                    ) : (
                      <span className="checklist-pending-badge inline-flex items-center gap-1 text-[11px] font-medium text-[#D9A441] bg-[#1C180E] px-2 py-0.5 rounded-full border border-[#D9A441]/30">
                        <Circle className="h-3 w-3" />
                        Not completed
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#81918E] mt-1 truncate max-w-md">
                    {sec.summary}
                  </p>
                </div>
              </div>

              {/* Right Action Button */}
              <div className="shrink-0 pl-13 sm:pl-0">
                <Button
                  onClick={sec.onAction}
                  size="sm"
                  variant={sec.isComplete ? "outline" : "default"}
                  className={`rounded-xl text-xs font-semibold shadow-xs ${
                    sec.isComplete
                      ? "checklist-edit-btn border-[#203131] bg-[#101C1C] text-[#B8C4C2] hover:bg-[#132020] hover:text-[#F5F7F6]"
                      : "bg-[#2E7D32] text-white hover:bg-[#256628]"
                  }`}
                >
                  {sec.isComplete ? (
                    <>
                      <Edit2 className="mr-1.5 h-3.5 w-3.5 text-[#66C56A]" />
                      {sec.actionText}
                    </>
                  ) : (
                    <>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      {sec.actionText}
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
