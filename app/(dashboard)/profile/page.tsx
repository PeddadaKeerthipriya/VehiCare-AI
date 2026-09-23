"use client";

import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Phone,
  Calendar,
  Shield,
  Edit3,
  Camera,
} from "lucide-react";
import {
  UserProfileInfo,
  RCDetails,
  InsuranceDetails,
  PUCDetails,
  FASTagDetails,
  ProfileCompletionState,
  Vehicle,
  InsuranceApiResponse,
} from "@/lib/types";
import {
  fetchVehicles,
  getInsurancePolicies,
  getVehiclePuc,
  getVehicleFastag,
} from "@/lib/api";
import { getLatestInsurancePolicy } from "@/lib/documents";
import { subscribeToSyncEvents } from "@/lib/realtimeSync";
import {
  getStoredCompletionState,
  saveStoredCompletionState,
  getStoredDocs,
  saveStoredDocs,
} from "@/lib/profileCompletion";
import { EditProfileModal } from "@/components/profile/EditProfileModal";
import { EditCoverModal } from "@/components/profile/EditCoverModal";
import { ProfileCompletionCard } from "@/components/profile/ProfileCompletionCard";
import { CompletionChecklist } from "@/components/profile/CompletionChecklist";
import { RCDetailsModal } from "@/components/profile/modals/RCDetailsModal";
import { InsuranceModal } from "@/components/profile/modals/InsuranceModal";
import { PUCModal } from "@/components/profile/modals/PUCModal";
import { FASTagModal } from "@/components/profile/modals/FASTagModal";

export default function ProfilePage() {
  const checklistRef = useRef<HTMLDivElement>(null);

  // User Profile state
  const [profile, setProfile] = useState<UserProfileInfo>({
    name: "User",
    email: "user@vehicare.com",
    phone: "+91 98765 43210",
    joined: "August 2026",
    role: "Owner / Primary Driver",
    avatar: "U",
    coverUrl: null,
    isVerified: true,
  });

  // Modal visibility states
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isEditCoverOpen, setIsEditCoverOpen] = useState(false);
  const [isRCOpen, setIsRCOpen] = useState(false);
  const [isInsuranceOpen, setIsInsuranceOpen] = useState(false);
  const [isPUCOpen, setIsPUCOpen] = useState(false);
  const [isFASTagOpen, setIsFASTagOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Document states (synced with session storage)
  const [existingVehicles, setExistingVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [rcData, setRcData] = useState<RCDetails | null>(null);
  const [insuranceData, setInsuranceData] = useState<InsuranceDetails | null>(null);
  const [pucData, setPucData] = useState<PUCDetails | null>(null);
  const [fastagData, setFastagData] = useState<FASTagDetails | null>(null);

  // Completion calculation state
  const [completion, setCompletion] = useState<ProfileCompletionState>({
    basicProfile: false,
    vehicleRc: false,
    insurance: false,
    puc: false,
    fastag: false,
  });

  // Fetch real Supabase Auth user, stored docs, & garage fleet on mount
  useEffect(() => {
    let active = true;

    const getUserAndFleet = async () => {
      try {
        const [userResult, vehiclesResult] = await Promise.allSettled([
          supabase.auth.getUser(),
          fetchVehicles(),
        ]);

        if (!active) return;

        if (userResult.status === "fulfilled" && userResult.value.data?.user) {
          const user = userResult.value.data.user;
          setUserId(user.id);

          // Load data only for the currently authenticated user
          const storedDocs = getStoredDocs(user.id);

          if (storedDocs.rcData) setRcData(storedDocs.rcData);
          if (storedDocs.insuranceData) setInsuranceData(storedDocs.insuranceData);
          if (storedDocs.pucData) setPucData(storedDocs.pucData);
          if (storedDocs.fastagData) setFastagData(storedDocs.fastagData);

          if (storedDocs.coverUrl) {
            setProfile((prev) => ({
              ...prev,
              coverUrl: storedDocs.coverUrl,
            }));
          }

          const storedCompletion = getStoredCompletionState(user.id);
          setCompletion(storedCompletion);

          const email = user.email ?? "";
          const fullName = user.user_metadata?.full_name || "";
          const phoneMeta = user.user_metadata?.phone || "";
          const roleMeta = user.user_metadata?.role || "";

          setProfile((prev) => ({
            ...prev,
            email,
            name: fullName,
            phone: phoneMeta,
            role: roleMeta,
            avatar: fullName
              ? fullName.charAt(0).toUpperCase()
              : user.email?.charAt(0).toUpperCase() || "U",
          }));
        }

        if (vehiclesResult.status === "fulfilled") {
          const vehicles = vehiclesResult.value;
          if (Array.isArray(vehicles) && vehicles.length > 0) {
            setExistingVehicles(vehicles);
            let storedId: string | null = null;
            try {
              storedId =
                typeof window !== "undefined"
                  ? localStorage.getItem("vehicare_active_vehicle_id")
                  : null;
            } catch {
              // ignore
            }
            if (storedId && vehicles.some((v) => v.id === storedId)) {
              setSelectedVehicleId(storedId);
            } else {
              setSelectedVehicleId((prev) => prev || vehicles[0].id);
            }
          }
        }
      } catch (err) {
        console.error("Error loading user profile or fleet:", err);
      }
    };

    getUserAndFleet();

    return () => {
      active = false;
    };
  }, []);

  // Helper to fetch documents for a specific vehicle
  const fetchDocumentsForVehicle = async (vehicleId: string) => {
    if (!vehicleId) return;

    try {
      const [insurancePolicies, puc, fastag] = await Promise.all([
        getInsurancePolicies(vehicleId).catch((): InsuranceApiResponse[] => []),
        getVehiclePuc(vehicleId).catch(() => null),
        getVehicleFastag(vehicleId).catch(() => null),
      ]);

      const latestInsurance = getLatestInsurancePolicy<InsuranceApiResponse>(insurancePolicies);
      if (latestInsurance) {
        setInsuranceData({
          provider: latestInsurance.insurer,
          policyNumber: latestInsurance.policy_number,
          startDate: latestInsurance.start_date ? latestInsurance.start_date.split("T")[0] : "",
          expiryDate: latestInsurance.expiry_date ? latestInsurance.expiry_date.split("T")[0] : "",
        });
      } else {
        setInsuranceData(null);
      }

      if (puc) {
        setPucData({
          certificateNumber: puc.certificate_number,
          issueDate: puc.issued_date ? puc.issued_date.split("T")[0] : "",
          expiryDate: puc.expiry_date ? puc.expiry_date.split("T")[0] : "",
          status: puc.status === "Expired" || puc.status === "Pending" ? puc.status : "Valid",
        });
      } else {
        setPucData(null);
      }

      if (fastag) {
        setFastagData({
          provider: "FASTag Electronic Toll",
          fastagNumber: fastag.tag_id,
          vehicleClass: "VC4 (Car / Jeep / Van)",
          status: fastag.status === "Blocked" ? "Inactive" : fastag.status || "Active",
          lastRechargeDate: fastag.last_recharge_date ? fastag.last_recharge_date.split("T")[0] : "",
        });
      } else {
        setFastagData(null);
      }
    } catch (err) {
      console.error("Failed to fetch documents for vehicle:", err);
    }
  };

  // Fetch documents whenever the selected vehicle changes
  useEffect(() => {
    if (!selectedVehicleId) return;

    // Synchronously clear document states so previous vehicle's data doesn't bleed
    setInsuranceData(null);
    setPucData(null);
    setFastagData(null);

    // Read vehicle-scoped cache if available
    const cached = getStoredDocs(userId, selectedVehicleId);
    if (cached.insuranceData) setInsuranceData(cached.insuranceData);
    if (cached.pucData) setPucData(cached.pucData);
    if (cached.fastagData) setFastagData(cached.fastagData);

    fetchDocumentsForVehicle(selectedVehicleId);
  }, [selectedVehicleId, userId]);

  // Update completion flags & save whenever documents change
  useEffect(() => {
    const updatedCompletion: ProfileCompletionState = {
      basicProfile: Boolean(profile.name && profile.phone),
      vehicleRc: Boolean(rcData),
      insurance: Boolean(insuranceData),
      puc: Boolean(pucData),
      fastag: Boolean(fastagData),
    };
    setCompletion(updatedCompletion);
    saveStoredCompletionState(updatedCompletion, userId);

    saveStoredDocs(
      {
        rcData,
        insuranceData,
        pucData,
        fastagData,
        coverUrl: profile.coverUrl,
      },
      userId,
      selectedVehicleId
    );
  }, [profile, rcData, insuranceData, pucData, fastagData, userId, selectedVehicleId]);

  // Sync bus: live update if another tab updates the active vehicle's papers or fleet
  useEffect(() => {
    const unsubscribeSync = subscribeToSyncEvents((payload) => {
      if (!payload.vehicleId || payload.vehicleId === selectedVehicleId) {
        console.log(`[RealtimeSync] Profile reloading documents for vehicle: ${selectedVehicleId}`);
        fetchDocumentsForVehicle(selectedVehicleId);
      }
      if (payload.type === "vehicle") {
        fetchVehicles().then((vehicles) => {
          if (Array.isArray(vehicles) && vehicles.length > 0) {
            setExistingVehicles(vehicles);
          }
        }).catch(() => {});
      }
    });

    return () => {
      unsubscribeSync();
    };
  }, [selectedVehicleId]);

  // Determine the next recommended step
  const getNextMissingStep = () => {
    if (!completion.basicProfile) return { name: "Basic Profile", open: () => setIsEditProfileOpen(true) };
    if (!completion.vehicleRc) return { name: "RC Details", open: () => setIsRCOpen(true) };
    if (!completion.insurance) return { name: "Insurance", open: () => setIsInsuranceOpen(true) };
    if (!completion.puc) return { name: "PUC Certificate", open: () => setIsPUCOpen(true) };
    if (!completion.fastag) return { name: "FASTag Toll Pass", open: () => setIsFASTagOpen(true) };
    return { name: "All Done", open: () => {} };
  };

  const nextStep = getNextMissingStep();

  const handleOpenNextMissingSection = () => {
    if (nextStep.open) {
      nextStep.open();
    }
  };

  // Handlers for updating profile & cover
  const handleProfileUpdated = (updated: { name: string; phone: string; role: string }) => {
    setProfile((prev) => ({
      ...prev,
      name: updated.name,
      phone: updated.phone,
      role: updated.role,
      avatar: updated.name.charAt(0).toUpperCase(),
    }));
  };

  const handleCoverApplied = (coverUrl: string) => {
    setProfile((prev) => ({
      ...prev,
      coverUrl,
    }));
  };

  return (
    <div className="space-y-6 pb-6">
      {/* 1. Main Profile Hero Card */}
      <Card className="overflow-hidden rounded-2xl border border-[#203131] bg-[#0B1515] shadow-xs">
        {/* Cover Banner */}
        <div
          className="relative h-36 sm:h-48 w-full bg-[#101C1C] bg-cover bg-center transition-all duration-300 border-b border-[#203131]"
          style={
            profile.coverUrl
              ? { backgroundImage: `url(${profile.coverUrl})` }
              : undefined
          }
        >
          {profile.coverUrl && (
            <div className="absolute inset-0 bg-black/40" />
          )}

          {/* Edit Cover Button */}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsEditCoverOpen(true)}
            aria-label="Edit Cover Photo"
            className="absolute right-3 top-3 sm:right-4 sm:top-4 rounded-xl bg-[#0B1515]/90 text-[#66C56A] hover:bg-[#101C1C] hover:text-[#F5F7F6] border border-[#203131] font-semibold shadow-sm backdrop-blur-xs transition-transform active:scale-95 z-10 text-xs"
          >
            <Camera className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Edit Cover
          </Button>

          {/* User Avatar - Positioned cleanly on top of the boundary with z-10 */}
          <div className="absolute -bottom-10 sm:-bottom-12 left-4 sm:left-6 z-10">
            <div className="profile-avatar flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-2xl border-4 border-[#0B1515] bg-[#2E7D32] text-2xl sm:text-3xl font-bold text-white shadow-lg">
              {profile.avatar}
            </div>
          </div>
        </div>

        {/* Card Content - Clean padding that makes room for avatar without overlapping */}
        <CardContent className="p-4 sm:p-6">
          {/* Header Row: User Name & Role + Edit Profile Button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-12 sm:pt-0 sm:pl-32 md:pl-36 mb-6 min-h-[52px]">
            {/* User Name & Role */}
            <div className="space-y-0.5 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-[#F5F7F6] truncate">
                {profile.name}
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-[#81918E] truncate">
                {profile.role}
              </p>
            </div>

            {/* Edit Profile Button */}
            <Button
              onClick={() => setIsEditProfileOpen(true)}
              aria-label="Edit Profile Details"
              className="rounded-xl bg-[#2E7D32] text-white hover:bg-[#256628] shadow-xs transition-transform active:scale-95 w-full sm:w-auto font-semibold shrink-0"
            >
              <Edit3 className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
          </div>

          {/* Contact and Status Info Grid */}
          <div className="grid gap-4 border-t border-[#203131] pt-6 sm:grid-cols-2">
            <div className="space-y-3.5">
              <div className="flex items-center gap-3 text-[#B8C4C2] text-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/30 shrink-0">
                  <Mail className="h-4 w-4" />
                </div>
                <span className="truncate">{profile.email}</span>
              </div>

              <div className="flex items-center gap-3 text-[#B8C4C2] text-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/30 shrink-0">
                  <Phone className="h-4 w-4" />
                </div>
                <span className="truncate">{profile.phone}</span>
              </div>
            </div>

            <div className="space-y-3.5">
              <div className="flex items-center gap-3 text-[#B8C4C2] text-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/30 shrink-0">
                  <Calendar className="h-4 w-4" />
                </div>
                <span className="truncate">Member since {profile.joined}</span>
              </div>

              <div className="flex items-center gap-3 text-[#B8C4C2] text-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/30 shrink-0">
                  <Shield className="h-4 w-4" />
                </div>
                <span className="font-semibold text-[#66C56A]">Verified Account</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Profile & Vehicle Information Completion Progress Card */}
      <ProfileCompletionCard
        completion={completion}
        onOpenNextMissingSection={handleOpenNextMissingSection}
        nextStepName={nextStep.name}
      />

      {/* 3. Detailed Information Completion Checklist */}
      <div ref={checklistRef} className="space-y-4">
        {existingVehicles.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#0B1515] border border-[#203131]">
            <div>
              <p className="text-sm font-bold text-[#F5F7F6]">Active Garage Vehicle</p>
              <p className="text-xs text-[#81918E]">Select a vehicle to view and update its compliance papers.</p>
            </div>
            <select
              value={selectedVehicleId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedVehicleId(newId);
                try {
                  localStorage.setItem("vehicare_active_vehicle_id", newId);
                } catch {
                  // ignore
                }
              }}
              className="rounded-xl border border-[#203131] bg-[#101C1C] px-3.5 py-2 text-xs font-semibold text-[#F5F7F6] outline-none focus:border-[#66C56A]"
            >
              {existingVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vehicle_type === "Bike" ? "[Bike] " : "[Car] "}
                  {v.make} {v.model} ({v.year})
                </option>
              ))}
            </select>
          </div>
        )}

        <CompletionChecklist
          completion={completion}
          rcData={rcData}
          insuranceData={insuranceData}
          pucData={pucData}
          fastagData={fastagData}
          onOpenEditProfile={() => setIsEditProfileOpen(true)}
          onOpenRCModal={() => setIsRCOpen(true)}
          onOpenInsuranceModal={() => setIsInsuranceOpen(true)}
          onOpenPUCModal={() => setIsPUCOpen(true)}
          onOpenFASTagModal={() => setIsFASTagOpen(true)}
        />
      </div>

      {/* ======================================================== */}
      {/* MODALS */}
      {/* ======================================================== */}

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        initialName={profile.name}
        initialPhone={profile.phone}
        initialRole={profile.role}
        onProfileUpdated={handleProfileUpdated}
      />

      {/* Edit Cover Modal */}
      <EditCoverModal
        isOpen={isEditCoverOpen}
        onClose={() => setIsEditCoverOpen(false)}
        currentCoverUrl={profile.coverUrl}
        onCoverApplied={handleCoverApplied}
      />

      {/* Vehicle / RC Details Modal */}
      <RCDetailsModal
        isOpen={isRCOpen}
        onClose={() => setIsRCOpen(false)}
        initialData={rcData}
        existingVehicles={existingVehicles}
        onSave={(data) => setRcData(data)}
      />

      {/* Insurance Modal */}
      <InsuranceModal
        isOpen={isInsuranceOpen}
        onClose={() => setIsInsuranceOpen(false)}
        initialData={insuranceData}
        existingVehicles={existingVehicles}
        initialVehicleId={selectedVehicleId}
        onSave={(data, savedVehicleId) => {
          const targetVehicleId = savedVehicleId || selectedVehicleId;
          if (savedVehicleId) setSelectedVehicleId(savedVehicleId);
          setInsuranceData(data);
          fetchDocumentsForVehicle(targetVehicleId);
        }}
      />

      {/* PUC Modal */}
      <PUCModal
        isOpen={isPUCOpen}
        onClose={() => setIsPUCOpen(false)}
        initialData={pucData}
        existingVehicles={existingVehicles}
        initialVehicleId={selectedVehicleId}
        onSave={(data, savedVehicleId) => {
          const targetVehicleId = savedVehicleId || selectedVehicleId;
          if (savedVehicleId) setSelectedVehicleId(savedVehicleId);
          setPucData(data);
          fetchDocumentsForVehicle(targetVehicleId);
        }}
      />

      {/* FASTag Modal */}
      <FASTagModal
        isOpen={isFASTagOpen}
        onClose={() => setIsFASTagOpen(false)}
        initialData={fastagData}
        existingVehicles={existingVehicles}
        initialVehicleId={selectedVehicleId}
        onSave={(data, savedVehicleId) => {
          const targetVehicleId = savedVehicleId || selectedVehicleId;
          if (savedVehicleId) setSelectedVehicleId(savedVehicleId);
          setFastagData(data);
          fetchDocumentsForVehicle(targetVehicleId);
        }}
      />
    </div>
  );
}