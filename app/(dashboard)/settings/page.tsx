"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Palette,
  Bell,
  Car,
  Globe,
  Shield,
  User,
  HelpCircle,
  Sun,
  Moon,
  Laptop,
  Check,
  KeyRound,
  Smartphone,
  LogOut,
  Trash2,
  Mail,
  AlertTriangle,
  CheckCircle2,
  Phone,
  MessageSquare,
} from "lucide-react";
import { useTheme, ThemeMode } from "@/lib/theme";
import { fetchVehicles } from "@/lib/api";
import { Vehicle } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { SettingsToggle } from "@/components/settings/SettingsToggle";
import { SettingsNavigationRow } from "@/components/settings/SettingsNavigationRow";
import { SettingsModal } from "@/components/settings/SettingsModal";

// Namespaced storage key
const SETTINGS_STORAGE_KEY = "vehicare-settings";

interface NotificationPreferences {
  maintenanceReminders: boolean;
  insuranceExpiryAlerts: boolean;
  pucExpiryAlerts: boolean;
  fastagAlerts: boolean;
  serviceReminders: boolean;
}

interface UserSettings {
  notifications: NotificationPreferences;
  defaultVehicleId: string;
  distanceUnit: "km" | "mi";
  fuelEconomyUnit: "km/L" | "L/100km" | "MPG";
  language: string;
  country: string;
  biometricLogin: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  notifications: {
    maintenanceReminders: true,
    insuranceExpiryAlerts: true,
    pucExpiryAlerts: true,
    fastagAlerts: true,
    serviceReminders: true,
  },
  defaultVehicleId: "",
  distanceUnit: "km",
  fuelEconomyUnit: "km/L",
  language: "English (US)",
  country: "India (IN)",
  biometricLogin: true,
};

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme, mounted: themeMounted } = useTheme();

  // Local settings state
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Vehicle data state
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);

  // Dialog states
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [problemText, setProblemText] = useState("");
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [deleteConfirmationStep, setDeleteConfirmationStep] = useState(false);

  // 1. Safe SSR Hydration: Read persisted settings on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings((prev) => ({
          ...prev,
          ...parsed,
          notifications: {
            ...prev.notifications,
            ...(parsed.notifications || {}),
          },
        }));
      }
    } catch (err) {
      console.warn("Failed to parse persisted vehicare-settings:", err);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // 2. Persist settings changes to localStorage
  const updateSettings = (partial: Partial<UserSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...partial };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
        } catch (err) {
          console.error("Failed to save vehicare-settings to localStorage:", err);
        }
      }
      return updated;
    });
  };

  const updateNotification = (key: keyof NotificationPreferences, val: boolean) => {
    setSettings((prev) => {
      const updated = {
        ...prev,
        notifications: {
          ...prev.notifications,
          [key]: val,
        },
      };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
        } catch (err) {
          console.error("Failed to save vehicare-settings to localStorage:", err);
        }
      }
      return updated;
    });
  };

  // 3. Fetch Vehicles safely without crashing the screen
  useEffect(() => {
    let isSubscribed = true;

    async function loadVehicles() {
      try {
        setVehiclesLoading(true);
        const data = await fetchVehicles();
        if (isSubscribed && Array.isArray(data)) {
          setVehicles(data);
          // Set default vehicle ID if not set yet and vehicles exist
          setSettings((prev) => {
            if (!prev.defaultVehicleId && data.length > 0) {
              const updated = { ...prev, defaultVehicleId: data[0].id };
              try {
                localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
              } catch {
                // Ignore storage error
              }
              return updated;
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn("Could not load vehicles in settings:", err);
      } finally {
        if (isSubscribed) {
          setVehiclesLoading(false);
        }
      }
    }

    loadVehicles();

    return () => {
      isSubscribed = false;
    };
  }, []);

  // 4. Logout handler
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Error signing out:", err);
    } finally {
      router.push("/login");
    }
  };

  // Theme option definitions
  const themeOptions: { mode: ThemeMode; label: string; desc: string; icon: typeof Sun }[] = [
    {
      mode: "light",
      label: "Light",
      desc: "Clean bright theme for daytime",
      icon: Sun,
    },
    {
      mode: "dark",
      label: "Dark",
      desc: "Cockpit dark theme for low light",
      icon: Moon,
    },
    {
      mode: "system",
      label: "System",
      desc: "Matches your device OS theme",
      icon: Laptop,
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-5 pb-8 max-w-3xl mx-auto">
      {/* Page Header */}
      <div className="px-1 pt-1">
        <h1 className="text-2xl font-bold tracking-tight text-[#F5F7F6]">
          Settings
        </h1>
        <p className="text-xs sm:text-sm text-[#81918E] mt-1">
          Customize cockpit appearance, notifications, vehicles, and account preferences
        </p>
      </div>

      {/* 1. Appearance Section */}
      <SettingsSection
        title="Appearance"
        description="Theme & visual cockpit preferences"
        icon={Palette}
      >
        <div className="py-3 sm:py-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {themeOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = themeMounted && theme === opt.mode;

              return (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={() => setTheme(opt.mode)}
                  className={`flex flex-col items-start p-3.5 sm:p-4 rounded-xl border text-left transition-all relative focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2E7D32] min-h-[88px] ${
                    isSelected
                      ? "border-[#2E7D32] bg-[#101C1C] text-[#F5F7F6] shadow-xs ring-1 ring-[#2E7D32]"
                      : "border-[#203131] bg-[#071011] text-[#81918E] hover:border-[#81918E]/40 hover:text-[#F5F7F6]"
                  }`}
                  aria-label={`Select ${opt.label} theme`}
                  aria-pressed={isSelected}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                        isSelected
                          ? "bg-[#2E7D32] text-white"
                          : "bg-[#132020] text-[#81918E]"
                      }`}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </div>

                    {isSelected && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2E7D32] text-white">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  <span className="text-sm font-bold text-[#F5F7F6]">
                    {opt.label}
                  </span>
                  <span className="text-xs text-[#81918E] mt-0.5 line-clamp-1">
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </SettingsSection>

      {/* 2. Notifications Section */}
      <SettingsSection
        title="Notifications"
        description="Alerts for maintenance, compliance & renewals"
        icon={Bell}
      >
        <SettingsRow
          label="Maintenance Reminders"
          description="Alerts when scheduled service or parts maintenance is due"
        >
          <SettingsToggle
            checked={settings.notifications.maintenanceReminders}
            onChange={(val) => updateNotification("maintenanceReminders", val)}
            label="Toggle Maintenance Reminders"
            disabled={!isLoaded}
          />
        </SettingsRow>

        <SettingsRow
          label="Insurance Expiry Alerts"
          description="Advance warning before vehicle insurance policy expires"
        >
          <SettingsToggle
            checked={settings.notifications.insuranceExpiryAlerts}
            onChange={(val) => updateNotification("insuranceExpiryAlerts", val)}
            label="Toggle Insurance Expiry Alerts"
            disabled={!isLoaded}
          />
        </SettingsRow>

        <SettingsRow
          label="PUC Expiry Alerts"
          description="Reminders before Pollution Under Control certificate renewal"
        >
          <SettingsToggle
            checked={settings.notifications.pucExpiryAlerts}
            onChange={(val) => updateNotification("pucExpiryAlerts", val)}
            label="Toggle PUC Expiry Alerts"
            disabled={!isLoaded}
          />
        </SettingsRow>

        <SettingsRow
          label="FASTag Alerts"
          description="Notifications for low toll wallet balance & recent debits"
        >
          <SettingsToggle
            checked={settings.notifications.fastagAlerts}
            onChange={(val) => updateNotification("fastagAlerts", val)}
            label="Toggle FASTag Alerts"
            disabled={!isLoaded}
          />
        </SettingsRow>

        <SettingsRow
          label="Service Reminders"
          description="Follow-up checks for unresolved diagnostics & workshop visits"
        >
          <SettingsToggle
            checked={settings.notifications.serviceReminders}
            onChange={(val) => updateNotification("serviceReminders", val)}
            label="Toggle Service Reminders"
            disabled={!isLoaded}
          />
        </SettingsRow>
      </SettingsSection>

      {/* 3. Vehicle Preferences */}
      <SettingsSection
        title="Vehicle Preferences"
        description="Default fleet, distance and fuel consumption units"
        icon={Car}
      >
        <SettingsRow
          label="Default Vehicle"
          description="Vehicle loaded automatically across dashboard and diagnostics"
        >
          {vehiclesLoading ? (
            <span className="text-xs text-[#81918E]">Loading fleet...</span>
          ) : vehicles.length === 0 ? (
            <span className="text-xs text-[#81918E]">No vehicles available</span>
          ) : (
            <select
              value={settings.defaultVehicleId}
              onChange={(e) => updateSettings({ defaultVehicleId: e.target.value })}
              className="rounded-xl border border-[#203131] bg-[#101C1C] px-3 py-1.5 text-xs sm:text-sm font-medium text-[#F5F7F6] focus:border-[#2E7D32] focus:outline-hidden focus:ring-1 focus:ring-[#2E7D32] transition-colors max-w-[170px] sm:max-w-[220px]"
              aria-label="Select Default Vehicle"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id} className="bg-[#0B1515] text-[#F5F7F6]">
                  {v.make} {v.model} ({v.year})
                </option>
              ))}
            </select>
          )}
        </SettingsRow>

        <SettingsRow
          label="Distance Unit"
          description="Measurement used for odometer and service milestones"
        >
          <div className="flex items-center rounded-xl bg-[#101C1C] p-0.5 border border-[#203131]">
            <button
              type="button"
              onClick={() => updateSettings({ distanceUnit: "km" })}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                settings.distanceUnit === "km"
                  ? "bg-[#2E7D32] text-white shadow-xs"
                  : "text-[#81918E] hover:text-[#F5F7F6]"
              }`}
            >
              km
            </button>
            <button
              type="button"
              onClick={() => updateSettings({ distanceUnit: "mi" })}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                settings.distanceUnit === "mi"
                  ? "bg-[#2E7D32] text-white shadow-xs"
                  : "text-[#81918E] hover:text-[#F5F7F6]"
              }`}
            >
              mi
            </button>
          </div>
        </SettingsRow>

        <SettingsRow
          label="Fuel Economy Unit"
          description="Measurement standard for fuel logs and efficiency ratings"
        >
          <div className="flex items-center rounded-xl bg-[#101C1C] p-0.5 border border-[#203131]">
            {(["km/L", "L/100km", "MPG"] as const).map((unit) => (
              <button
                key={unit}
                type="button"
                onClick={() => updateSettings({ fuelEconomyUnit: unit })}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  settings.fuelEconomyUnit === unit
                    ? "bg-[#2E7D32] text-white shadow-xs"
                    : "text-[#81918E] hover:text-[#F5F7F6]"
                }`}
              >
                {unit}
              </button>
            ))}
          </div>
        </SettingsRow>
      </SettingsSection>

      {/* 4. Language & Region */}
      <SettingsSection
        title="Language & Region"
        description="Localization, dialect and regional standards"
        icon={Globe}
      >
        <SettingsNavigationRow
          label="Language"
          description="Display language for cockpit controls and summaries"
          value={settings.language}
          onClick={() => setActiveModal("language")}
        />

        <SettingsNavigationRow
          label="Country / Region"
          description="Regional compliance, currency and regulatory formats"
          value={settings.country}
          onClick={() => setActiveModal("country")}
        />
      </SettingsSection>

      {/* 5. Security */}
      <SettingsSection
        title="Security"
        description="Authentication and device access controls"
        icon={Shield}
      >
        <SettingsNavigationRow
          icon={KeyRound}
          label="Change Password"
          description="Update your credentials and manage login security"
          href="/settings/change-password"
        />

        <SettingsRow
          icon={Smartphone}
          label="Biometric Login"
          description="Use Fingerprint or Face ID for fast and secure login"
        >
          <SettingsToggle
            checked={settings.biometricLogin}
            onChange={(val) => updateSettings({ biometricLogin: val })}
            label="Toggle Biometric Login"
            disabled={!isLoaded}
          />
        </SettingsRow>
      </SettingsSection>

      {/* 6. Account */}
      <SettingsSection
        title="Account"
        description="Personal profile, session management and data ownership"
        icon={User}
      >
        <SettingsNavigationRow
          icon={User}
          label="Edit Profile"
          description="Update personal details, contact number and driver info"
          href="/profile"
        />

        <SettingsNavigationRow
          icon={LogOut}
          label="Logout"
          description="End current session on this device"
          onClick={() => setActiveModal("logout")}
        />

        <SettingsNavigationRow
          icon={Trash2}
          label="Delete Account"
          description="Permanently delete account profile and stored vehicle records"
          destructive
          onClick={() => {
            setDeleteConfirmationStep(false);
            setActiveModal("deleteAccount");
          }}
        />
      </SettingsSection>

      {/* 7. Help & About */}
      <SettingsSection
        title="Help & About"
        description="Support, documentation and app version info"
        icon={HelpCircle}
      >
        <SettingsNavigationRow
          label="Help & FAQ"
          description="Frequently asked questions and guides"
          onClick={() => setActiveModal("faq")}
        />

        <SettingsNavigationRow
          label="Contact Support"
          description="Reach out to VehiCare AI engineering & customer assistance"
          onClick={() => setActiveModal("support")}
        />

        <SettingsNavigationRow
          label="Report a Problem"
          description="Submit feedback, diagnostic glitches or bug reports"
          onClick={() => {
            setProblemText("");
            setReportSubmitted(false);
            setActiveModal("report");
          }}
        />

        <SettingsNavigationRow
          label="Privacy Policy"
          description="How vehicle data, OCR bills and telemetry are safeguarded"
          onClick={() => setActiveModal("privacy")}
        />

        <SettingsNavigationRow
          label="Terms & Conditions"
          description="Service terms, AI diagnostic disclaimers and usage terms"
          onClick={() => setActiveModal("terms")}
        />

        <SettingsNavigationRow
          label="Cookie Policy"
          description="Information about essential cookies and local browser storage"
          onClick={() => setActiveModal("cookie")}
        />

        <div className="flex items-center justify-between py-3.5 px-2 min-h-[52px]">
          <div>
            <p className="text-sm font-semibold text-foreground">App Version</p>
            <p className="text-xs text-muted-foreground mt-0.5">VehiCare AI Cockpit</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 border border-border">
            <span className="h-1.5 w-1.5 rounded-full bg-[#66C56A]" />
            <span className="text-xs font-semibold text-foreground">v1.2.0 (Build 2026.09)</span>
          </div>
        </div>
      </SettingsSection>

      {/* ========================================================================= */}
      {/* MODALS / DIALOGS                                                          */}
      {/* ========================================================================= */}

      {/* Language Selection Modal */}
      <SettingsModal
        isOpen={activeModal === "language"}
        onClose={() => setActiveModal(null)}
        title="Select Language"
        description="Choose your preferred display language"
      >
        <div className="space-y-1.5">
          {[
            { code: "English (US)", label: "English (US)", native: "English (United States)" },
            { code: "English (UK)", label: "English (UK)", native: "English (United Kingdom)" },
            { code: "Hindi (हिन्दी)", label: "Hindi", native: "हिन्दी" },
            { code: "Marathi (मराठी)", label: "Marathi", native: "मराठी" },
            { code: "Tamil (தமிழ்)", label: "Tamil", native: "தமிழ்" },
            { code: "Telugu (తెలుగు)", label: "Telugu", native: "తెలుగు" },
            { code: "Gujarati (ગુજરાતી)", label: "Gujarati", native: "ગુજરાતી" },
          ].map((lang) => {
            const isSelected = settings.language === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  updateSettings({ language: lang.code });
                  setActiveModal(null);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "border-[#2E7D32] bg-secondary text-foreground ring-1 ring-[#2E7D32]"
                    : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{lang.label}</p>
                  <p className="text-xs text-muted-foreground">{lang.native}</p>
                </div>
                {isSelected && <Check className="h-4 w-4 text-[#66C56A]" />}
              </button>
            );
          })}
        </div>
      </SettingsModal>

      {/* Country Selection Modal */}
      <SettingsModal
        isOpen={activeModal === "country"}
        onClose={() => setActiveModal(null)}
        title="Select Country / Region"
        description="Sets vehicle compliance standards, date formats and units"
      >
        <div className="space-y-1.5">
          {[
            { code: "India (IN)", label: "India", detail: "FASTag, PUC, Parivahan standards" },
            { code: "United States (US)", label: "United States", detail: "EPA, VIN & State DMV standards" },
            { code: "United Kingdom (UK)", label: "United Kingdom", detail: "MOT & DVLA compliance" },
            { code: "United Arab Emirates (AE)", label: "United Arab Emirates", detail: "RTA & Salik toll standards" },
            { code: "Canada (CA)", label: "Canada", detail: "Transport Canada & provincial standards" },
            { code: "Germany (DE)", label: "Germany", detail: "TÜV inspection & EU norms" },
          ].map((country) => {
            const isSelected = settings.country === country.code;
            return (
              <button
                key={country.code}
                type="button"
                onClick={() => {
                  updateSettings({ country: country.code });
                  setActiveModal(null);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "border-[#2E7D32] bg-secondary text-foreground ring-1 ring-[#2E7D32]"
                    : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{country.label}</p>
                  <p className="text-xs text-muted-foreground">{country.detail}</p>
                </div>
                {isSelected && <Check className="h-4 w-4 text-[#66C56A]" />}
              </button>
            );
          })}
        </div>
      </SettingsModal>

      {/* Logout Confirmation Modal */}
      <SettingsModal
        isOpen={activeModal === "logout"}
        onClose={() => setActiveModal(null)}
        title="Confirm Logout"
        description="Are you sure you want to end your session?"
        footer={
          <>
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="rounded-xl border border-[#203131] bg-[#101C1C] px-4 py-2 text-xs sm:text-sm font-semibold text-[#F5F7F6] hover:bg-[#132020] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl bg-rose-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-rose-700 transition-colors shadow-xs"
            >
              Log Out
            </button>
          </>
        }
      >
        <p className="text-sm text-[#81918E]">
          You will be signed out of your VehiCare AI session on this device. Your saved vehicle
          records, service slips, and offline settings will remain securely stored.
        </p>
      </SettingsModal>

      {/* Delete Account Confirmation Modal */}
      <SettingsModal
        isOpen={activeModal === "deleteAccount"}
        onClose={() => setActiveModal(null)}
        title="Account Deletion Notice"
        description="Permanent removal of your profile and vehicle data"
        footer={
          <>
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="rounded-xl border border-[#203131] bg-[#101C1C] px-4 py-2 text-xs sm:text-sm font-semibold text-[#F5F7F6] hover:bg-[#132020] transition-colors"
            >
              Close
            </button>
            {!deleteConfirmationStep ? (
              <button
                type="button"
                onClick={() => setDeleteConfirmationStep(true)}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-rose-700 transition-colors shadow-xs"
              >
                Proceed with Request
              </button>
            ) : (
              <a
                href="mailto:support@vehicare.ai?subject=Account%20Deletion%20Request"
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-rose-700 transition-colors shadow-xs inline-flex items-center gap-1.5"
              >
                <Mail className="h-3.5 w-3.5" />
                Contact Support to Delete
              </a>
            )}
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-xl bg-rose-950/20 border border-rose-900/30 p-3.5 text-rose-400">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm space-y-1">
              <p className="font-semibold text-rose-300">Backend Support Required</p>
              <p className="text-rose-400/90 leading-relaxed">
                Permanent account deletion requires verified administrative authorization.
                Your account is currently safe and has <strong>not</strong> been deleted.
              </p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#81918E] leading-relaxed">
            Deleting an account involves irreversible erasure of your vehicle service slips, AI
            diagnostic logs, maintenance records, and document vaults. To complete this action safely,
            please initiate a verified request with customer support.
          </p>
        </div>
      </SettingsModal>

      {/* Help & FAQ Modal */}
      <SettingsModal
        isOpen={activeModal === "faq"}
        onClose={() => setActiveModal(null)}
        title="Help & FAQ"
        description="Answers to common questions about VehiCare AI"
      >
        <div className="space-y-3.5">
          <div className="rounded-xl border border-[#203131] bg-[#071011] p-3.5">
            <p className="text-sm font-semibold text-[#F5F7F6]">How does AI Slip Processing work?</p>
            <p className="text-xs text-[#81918E] mt-1 leading-relaxed">
              Upload a clear photo or PDF invoice from your mechanic. The OCR engine extracts service
              date, odometer readings, replaced parts, and cost breakdowns automatically.
            </p>
          </div>

          <div className="rounded-xl border border-[#203131] bg-[#071011] p-3.5">
            <p className="text-sm font-semibold text-[#F5F7F6]">Are diagnostic predictions accurate?</p>
            <p className="text-xs text-[#81918E] mt-1 leading-relaxed">
              VehiCare AI models are trained on mechanical repair datasets. They provide preliminary
              guidance and severity triage, but should be corroborated with a qualified automotive technician.
            </p>
          </div>

          <div className="rounded-xl border border-[#203131] bg-[#071011] p-3.5">
            <p className="text-sm font-semibold text-[#F5F7F6]">Where is my vehicle data stored?</p>
            <p className="text-xs text-[#81918E] mt-1 leading-relaxed">
              Your service slips and records are secured in encrypted Supabase cloud storage, accessible
              only via authenticated user credentials.
            </p>
          </div>
        </div>
      </SettingsModal>

      {/* Contact Support Modal */}
      <SettingsModal
        isOpen={activeModal === "support"}
        onClose={() => setActiveModal(null)}
        title="Contact Support"
        description="VehiCare AI assistance and customer support desk"
      >
        <div className="space-y-3">
          {/* Email Support */}
          <div className="flex items-center gap-3 rounded-xl border border-[#203131] bg-[#071011] p-3.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/30 shrink-0">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-[#81918E]">Email Support</p>
              <a
                href="mailto:support@vehicare.ai"
                className="text-sm font-semibold text-[#66C56A] hover:underline"
              >
                support@vehicare.ai
              </a>
            </div>
          </div>

          {/* WhatsApp Business Support */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#203131] bg-[#071011] p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/30 shrink-0">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium text-[#81918E]">WhatsApp Business</p>
                  <span className="text-[10px] text-[#81918E]">(Opens WhatsApp)</span>
                </div>
                <p className="text-sm font-semibold text-[#F5F7F6]">+91 85005 87501</p>
              </div>
            </div>
            <a
              href="https://wa.me/918500587501"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat with VehiCare AI on WhatsApp"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2E7D32] hover:bg-[#256628] text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#66C56A] shrink-0 cursor-pointer"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Chat on WhatsApp</span>
            </a>
          </div>

          {/* Toll-Free Helpline */}
          <div className="flex items-center gap-3 rounded-xl border border-[#203131] bg-[#071011] p-3.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/30 shrink-0">
              <Phone className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-[#81918E]">Toll-Free Helpline (India)</p>
              <p className="text-sm font-semibold text-[#F5F7F6]">+91 1800-VEHICARE</p>
            </div>
          </div>

          {/* Support Hours */}
          <div className="rounded-xl border border-[#203131] bg-[#101C1C] p-3 text-xs text-[#81918E] leading-relaxed">
            <p className="font-semibold text-[#F5F7F6] mb-0.5">Support Hours</p>
            Monday to Saturday: 9:00 AM – 7:00 PM IST.
          </div>
        </div>
      </SettingsModal>

      {/* Report a Problem Modal */}
      <SettingsModal
        isOpen={activeModal === "report"}
        onClose={() => setActiveModal(null)}
        title="Report a Problem"
        description="Tell us about a bug, diagnostic glitch, or UI issue"
        footer={
          <>
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="rounded-xl border border-[#203131] bg-[#101C1C] px-4 py-2 text-xs sm:text-sm font-semibold text-[#F5F7F6] hover:bg-[#132020] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!problemText.trim() || reportSubmitted}
              onClick={() => setReportSubmitted(true)}
              className="rounded-xl bg-[#2E7D32] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#256628] disabled:opacity-50 transition-colors shadow-xs"
            >
              Submit Report
            </button>
          </>
        }
      >
        {reportSubmitted ? (
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2E7D32]/20 text-[#66C56A] border border-[#2E7D32]/30">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-base font-bold text-[#F5F7F6]">Feedback Received</p>
            <p className="text-xs sm:text-sm text-[#81918E] max-w-xs">
              Thank you for helping improve VehiCare AI. Our engineering team will review the issue.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs sm:text-sm text-[#81918E]">
              Describe the issue encountered. Device telemetry and cockpit version will be attached.
            </p>
            <textarea
              rows={4}
              value={problemText}
              onChange={(e) => setProblemText(e.target.value)}
              placeholder="e.g. Service slip OCR misread the odometer field on my Hyundai invoice..."
              className="w-full rounded-xl border border-[#203131] bg-[#071011] p-3 text-xs sm:text-sm text-[#F5F7F6] placeholder-[#81918E]/60 focus:border-[#2E7D32] focus:outline-hidden focus:ring-1 focus:ring-[#2E7D32] transition-colors"
            />
          </div>
        )}
      </SettingsModal>

      {/* Privacy Policy Modal */}
      <SettingsModal
        isOpen={activeModal === "privacy"}
        onClose={() => setActiveModal(null)}
        title="Privacy Policy"
        description="VehiCare AI Data Protection & Encryption Summary"
      >
        <div className="space-y-3 text-xs sm:text-sm text-[#81918E] leading-relaxed">
          <p>
            <strong className="text-[#F5F7F6]">Data Ownership:</strong> You retain full ownership of
            all vehicle documentation, registration certificates, and maintenance bills uploaded to
            VehiCare AI.
          </p>
          <p>
            <strong className="text-[#F5F7F6]">OCR & AI Processing:</strong> Invoices are scanned
            using automated OCR pipelines solely to digitize service history and calculate predictive
            wear-and-tear. Data is never sold or used for third-party advertising.
          </p>
          <p>
            <strong className="text-[#F5F7F6]">Security Protocols:</strong> All API communications
            utilize TLS 1.3 encryption. At-rest vehicle profiles and authentication tokens are
            safeguarded using enterprise-grade database encryption.
          </p>
        </div>
      </SettingsModal>

      {/* Terms & Conditions Modal */}
      <SettingsModal
        isOpen={activeModal === "terms"}
        onClose={() => setActiveModal(null)}
        title="Terms & Conditions"
        description="VehiCare AI Cockpit Usage & Diagnostic Disclaimer"
      >
        <div className="space-y-3 text-xs sm:text-sm text-[#81918E] leading-relaxed">
          <p>
            <strong className="text-[#F5F7F6]">Diagnostic Disclaimer:</strong> VehiCare AI fault
            evaluations and predictive maintenance milestones are algorithmic estimates designed for
            informational reference. Always consult qualified automotive technicians before undertaking
            mechanical repairs.
          </p>
          <p>
            <strong className="text-[#F5F7F6]">User Responsibility:</strong> Users are responsible
            for verifying the accuracy of digitized slip totals, insurance renewal dates, and PUC
            compliance milestones.
          </p>
          <p>
            <strong className="text-[#F5F7F6]">Platform Availability:</strong> VehiCare AI strives for
            uninterrupted service availability, with local caching enabled to ensure cockpit access
            during intermittent network connectivity.
          </p>
        </div>
      </SettingsModal>

      {/* Cookie Policy Modal */}
      <SettingsModal
        isOpen={activeModal === "cookie"}
        onClose={() => setActiveModal(null)}
        title="Cookie & Local Storage Policy"
        description="Transparent overview of cookies and storage technologies used by VehiCare AI"
      >
        <div className="space-y-3 text-xs sm:text-sm text-[#81918E] leading-relaxed">
          <p>
            <strong className="text-[#F5F7F6]">Essential Browser Storage:</strong> VehiCare AI uses essential browser localStorage and session tokens solely to maintain authenticated sessions, persist UI theme preferences, and store client configuration.
          </p>
          <p>
            <strong className="text-[#F5F7F6]">No Advertising or Tracking Cookies:</strong> We do not load advertising pixels, third-party analytics trackers, or cross-site tracking scripts.
          </p>
          <p>
            <strong className="text-[#F5F7F6]">Managing Storage:</strong> You can clear local storage and session data anytime through your browser settings or by logging out.
          </p>
          <div className="pt-2">
            <Link
              href="/cookie-policy"
              className="text-xs font-semibold text-[#66C56A] hover:underline"
              onClick={() => setActiveModal(null)}
            >
              Read full Cookie Policy →
            </Link>
          </div>
        </div>
      </SettingsModal>
    </div>
  );
}