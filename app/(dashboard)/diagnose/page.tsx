"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Sparkles,
  Bot,
  User,
  Car,
  Bike,
  Send,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Wrench,
  Clock,
  Loader2,
  Info,
  Gauge,
  Zap,
  Activity,
  Plus,
  HelpCircle,
  ShieldAlert,
  X,
  Flame,
  ChevronRight,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchVehicles, diagnoseVehicle,getDiagnosisHistory,} from "@/lib/api";
import { Vehicle, BackendDiagnosis } from "@/lib/types";

// ==========================================
// Types & Data Structures
// ==========================================

export type SeverityLevel = "low" | "medium" | "high" | "critical";

export interface DiagnosticCause {
  title: string;
  likelihood: number; // percentage 0-100
  severity: SeverityLevel;
  description: string;
}

export interface DiagnosticResult {
  isAmbiguous?: boolean;
  ambiguousReply?: string;
  followUpQuestions?: string[];
  summary?: string;
  severity?: SeverityLevel;
  urgency?: string;
  system?: string;
  probableIssue?: string;
  causes?: DiagnosticCause[];
  recommendations?: string[];
  safetyNotice?: string;
  estimatedCostRange?: string;
  mechanicRequired?: boolean;
}

export interface ClarificationOption {
  label: string;
  detail: string;
}

export interface ClarificationPrompt {
  question: string;
  options: ClarificationOption[];
}

export interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  timestamp: string;
  text?: string;
  diagnosis?: DiagnosticResult;
  clarificationPrompt?: ClarificationPrompt;
  isError?: boolean;
}

const QUICK_PROMPTS = [
  {
    icon: AlertCircle,
    label: "Brake squealing",
    prompt: "High-pitched squealing sound when braking at slow speeds",
  },
  {
    icon: Zap,
    label: "Check engine light",
    prompt: "Check engine light came on after highway driving; engine feels sluggish",
  },
  {
    icon: Activity,
    label: "Engine vibration",
    prompt: "Rough idling and engine vibration when stopped at traffic lights",
  },
  {
    icon: Gauge,
    label: "Steering wobble",
    prompt: "Steering wheel shakes and vibrates when driving above 70 km/h",
  },
  {
    icon: AlertTriangle,
    label: "AC blowing warm",
    prompt: "Air conditioner is blowing room-temperature air instead of cooling",
  },
  {
    icon: HelpCircle,
    label: "Vague symptom",
    prompt: "My car feels weird.",
  },
];

const AMBIGUOUS_PATTERNS = [
  "feels weird",
  "weird",
  "something is wrong",
  "something feels wrong",
  "not working",
  "car problem",
  "issue with car",
  "acting up",
  "strange",
  "broken",
  "help",
  "makes noise",
  "weird sound",
  "funny sound",
  "dunno",
  "don't know",
  "not running good",
  "not driving right",
  "feels off",
  "something wrong",
  "problem",
];

// ==========================================
// Question -> Sub-options Mapping Engine
// ==========================================

const CLARIFICATION_MAP: Record<
  string,
  {
    question: string;
    options: ClarificationOption[];
  }
> = {
  "When does the problem occur?": {
    question: "When does the problem occur?",
    options: [
      { label: "Starting", detail: "Problem happens while starting the engine or ignition" },
      { label: "Braking", detail: "Problem happens when applying the foot brake or slowing down" },
      { label: "Accelerating", detail: "Problem happens when pressing the gas pedal or accelerating" },
      { label: "While driving", detail: "Problem occurs while cruising or driving at higher speeds" },
      { label: "At idle / stopped", detail: "Problem occurs while stationary or idling at red lights" },
    ],
  },
  "Do you hear any unusual sound?": {
    question: "Do you hear any unusual sound?",
    options: [
      { label: "Squealing / Screeching", detail: "High-pitched squeal or screech from wheels or belt" },
      { label: "Grinding / Scraping", detail: "Harsh metal-on-metal grinding sound" },
      { label: "Clicking / Ticking", detail: "Repetitive clicking or ticking from engine bay" },
      { label: "Knocking / Thumping", detail: "Deep knocking or thumping from underbody or engine" },
      { label: "No unusual sound", detail: "No distinct strange noise, just abnormal feel or vibration" },
    ],
  },
  "Is a warning light showing?": {
    question: "Is a warning light showing?",
    options: [
      { label: "Check Engine Light", detail: "Check engine warning light came on after highway driving" },
      { label: "Brake / ABS Light", detail: "Brake or ABS system warning light is illuminated" },
      { label: "Battery Light", detail: "Battery charging warning light is on" },
      { label: "Oil Pressure Light", detail: "Engine oil pressure warning light is illuminated" },
      { label: "No warning lights", detail: "No warning lights showing on instrument cluster" },
    ],
  },
  "Does it happen while starting, braking, accelerating, or driving?": {
    question: "Does it happen while starting, braking, accelerating, or driving?",
    options: [
      { label: "Starting", detail: "Problem happens during starting the engine or ignition" },
      { label: "Braking", detail: "Problem happens while braking or slowing down" },
      { label: "Accelerating", detail: "Problem happens while accelerating or under engine load" },
      { label: "While driving", detail: "Problem happens while cruising and driving on the road" },
    ],
  },
};

// ==========================================
// Ambiguity Detector for Clarification Flow
// ==========================================

function isVagueSymptom(query: string): boolean {
  const clean = query.trim().toLowerCase();
  if (
    clean.length <= 18 &&
    !clean.includes("brake") &&
    !clean.includes("engine") &&
    !clean.includes("tire") &&
    !clean.includes("ac") &&
    !clean.includes("oil") &&
    !clean.includes("start") &&
    !clean.includes("light") &&
    !clean.includes("driv") &&
    !clean.includes("idle")
  ) {
    return true;
  }
  return AMBIGUOUS_PATTERNS.some((pattern) => clean === pattern || clean.includes(pattern));
}

// ==========================================
// Friendly Error Message Handler
// ==========================================

function getFriendlyErrorMessage(err: unknown): string {
  const status = (err as { status?: number })?.status;
  if (status === 401) {
    return "Your session has expired. Please sign in again.";
  }
  if (status === 422) {
    return "Please provide a little more detail about the vehicle problem.";
  }
  if (status === 500) {
    return "Diagnosis service is not configured correctly. Please try again later.";
  }
  if (status === 502) {
    return "Diagnosis service is temporarily unavailable. Please try again.";
  }
  if (status === 504) {
    return "Diagnosis is taking too long. Please try again.";
  }
  if (status === 0) {
    return "Unable to connect to the diagnosis service. Please check your connection and try again.";
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return "Sorry, we couldn't generate a diagnosis right now. Please try again.";
}

// ==========================================
// Response Adapter: Backend -> Frontend UI
// ==========================================

function adaptBackendDiagnosisToUI(
  backendDiag: BackendDiagnosis,
  vehicle?: Vehicle | null
): DiagnosticResult {
  // 1. Severity Mapping: Critical -> critical, Warning -> high, Advisory -> low
  let severity: SeverityLevel = "low";
  const rawSev = (backendDiag.severity || "").toLowerCase();
  if (rawSev.includes("crit")) {
    severity = "critical";
  } else if (rawSev.includes("warn") || rawSev.includes("high")) {
    severity = "high";
  } else if (rawSev.includes("med")) {
    severity = "medium";
  } else {
    severity = "low";
  }

  // 2. Confidence Score -> Likelihood Percentage (0-100)
  const confidence = typeof backendDiag.confidence_score === "number" ? backendDiag.confidence_score : 0.8;
  const likelihood = Math.min(100, Math.max(0, Math.round(confidence * 100)));

  // 3. Probable Issue & Primary Cause Item
  const probableIssue = backendDiag.possible_cause || "Vehicle Mechanical / Electrical Anomaly";
  const causes: DiagnosticCause[] = [
    {
      title: probableIssue,
      likelihood,
      severity,
      description: backendDiag.possible_cause,
    },
  ];

  // 4. Recommended Action -> Recommendations Array
  let recommendations: string[] = [];
  if (backendDiag.recommended_action) {
    const steps = backendDiag.recommended_action
      .split(/\n+|\r+|(?<=\.)\s+(?=[A-Z0-9])/)
      .map((s) => s.replace(/^\d+\.\s*/, "").trim())
      .filter((s) => s.length > 0);

    recommendations = steps.length > 0 ? steps : [backendDiag.recommended_action.trim()];
  }

  // 5. System Inference
  let system = "Mechanical & Electrical Systems";
  const causeLower = probableIssue.toLowerCase();
  if (causeLower.includes("brake") || causeLower.includes("rotor") || causeLower.includes("caliper") || causeLower.includes("pad")) {
    system = "Braking & Hydraulic System";
  } else if (causeLower.includes("engine") || causeLower.includes("coolant") || causeLower.includes("oil") || causeLower.includes("thermostat") || causeLower.includes("gasket")) {
    system = "Engine & Thermal Cooling System";
  } else if (causeLower.includes("battery") || causeLower.includes("starter") || causeLower.includes("alternator") || causeLower.includes("spark") || causeLower.includes("ignition")) {
    system = "Electrical & Starting System";
  } else if (causeLower.includes("tire") || causeLower.includes("wheel") || causeLower.includes("suspension") || causeLower.includes("steer") || causeLower.includes("strut")) {
    system = "Steering, Suspension & Chassis";
  } else if (causeLower.includes("transmiss") || causeLower.includes("gear") || causeLower.includes("clutch")) {
    system = "Transmission & Powertrain";
  } else if (causeLower.includes("ac") || causeLower.includes("air condition") || causeLower.includes("climate") || causeLower.includes("refrigerant")) {
    system = "HVAC & Cabin Climate";
  }

  // 6. Urgency Determination
  let urgency = "Prompt inspection advised";
  if (severity === "critical") {
    urgency = "Immediate — Pull over safely & stop driving";
  } else if (severity === "high") {
    urgency = "Schedule inspection within 24–48 hours";
  } else if (backendDiag.mechanic_required) {
    urgency = "Professional mechanic inspection recommended";
  }

  // 7. Summary
  const vehicleName = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "your vehicle";
  const summary = backendDiag.confidence_notes?.trim() || `Diagnostic assessment for ${vehicleName}: ${probableIssue}.`;

  // 8. Safety Notice
  let safetyNotice: string | undefined = backendDiag.mechanic_disclaimer || undefined;
  if (!safetyNotice) {
    if (backendDiag.mechanic_required) {
      safetyNotice = "A certified mechanic inspection is recommended to safely diagnose and resolve this issue.";
    } else if (severity === "critical") {
      safetyNotice = "Immediate attention required. Pull over safely and do not continue driving until inspected.";
    } else if (severity === "high") {
      safetyNotice = "Schedule a service inspection promptly to prevent potential component wear or safety hazards.";
    }
  }

  return {
    summary,
    severity,
    probableIssue,
    system,
    urgency,
    causes,
    recommendations,
    safetyNotice,
    mechanicRequired: backendDiag.mechanic_required,
  };
}

// ==========================================
// Main Diagnosis Page Component
// ==========================================

export default function DiagnosePage() {
  // Vehicles State
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [loadingVehicles, setLoadingVehicles] = useState<boolean>(true);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [isDiagnosing, setIsDiagnosing] = useState<boolean>(false);
  const [diagnosingStep, setDiagnosingStep] = useState<string>("Analyzing vehicle symptoms...");
  const [lastUserSymptom, setLastUserSymptom] = useState<string>("");
  const [diagnosisHistory, setDiagnosisHistory] = useState<BackendDiagnosis[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyVehicleFilter, setHistoryVehicleFilter] = useState<string>("all");
  const [historySeverityFilter, setHistorySeverityFilter] =
  useState<SeverityLevel | "all">("all");
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  // Modal / Action State ("See a Mechanic" Action)
  const [mechanicModalOpen, setMechanicModalOpen] = useState<boolean>(false);
  const [mechanicModalContext, setMechanicModalContext] = useState<{
    severity?: SeverityLevel;
    system?: string;
    issue?: string;
  } | null>(null);

  // References
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load Vehicles on mount
  useEffect(() => {
    async function loadVehicles() {
      setLoadingVehicles(true);
      setVehiclesError(null);
      try {
        const list = await fetchVehicles();
        setVehicles(list);
        if (list.length > 0) {
          let preferredId = "";
          try {
            const urlParam =
              typeof window !== "undefined"
                ? new URLSearchParams(window.location.search).get("vehicleId")
                : null;
            const storedId =
              typeof window !== "undefined"
                ? localStorage.getItem("vehicare_active_vehicle_id")
                : null;
            if (urlParam && list.some((v: Vehicle) => v.id === urlParam)) {
              preferredId = urlParam;
            } else if (storedId && list.some((v: Vehicle) => v.id === storedId)) {
              preferredId = storedId;
            }
          } catch {
            // ignore storage errors
          }
          const finalId = preferredId || list[0].id;
          setSelectedVehicleId(finalId);
          try {
            localStorage.setItem("vehicare_active_vehicle_id", finalId);
          } catch {
            // ignore
          }
        }
      } catch (err: unknown) {
        console.error("Failed to fetch vehicles for diagnosis:", err);
        const msg = err instanceof Error ? err.message : "Failed to load vehicle list.";
        setVehiclesError(msg);
      } finally {
        setLoadingVehicles(false);
      }
    }
    loadVehicles();
  }, []);
      // Load diagnosis history based on selected history filter
  useEffect(() => {
    if (vehicles.length === 0) {
      setDiagnosisHistory([]);
      return;
    }

    async function loadDiagnosisHistory() {
      setLoadingHistory(true);
      setHistoryError(null);

      try {
        if (historyVehicleFilter === "all") {
          const histories = await Promise.all(
            vehicles.map((vehicle) => getDiagnosisHistory(vehicle.id))
          );

          const combinedHistory = histories
            .flat()
            .sort(
              (a, b) =>
                new Date(b.created_at || "").getTime() -
                new Date(a.created_at || "").getTime()
            );

          setDiagnosisHistory(combinedHistory);
        } else {
          const history = await getDiagnosisHistory(historyVehicleFilter);

          const sortedHistory = [...history].sort(
            (a, b) =>
              new Date(b.created_at || "").getTime() -
              new Date(a.created_at || "").getTime()
          );

          setDiagnosisHistory(sortedHistory);
        }
      } catch (err: unknown) {
        console.error("Failed to fetch diagnosis history:", err);
        setHistoryError(
          err instanceof Error
            ? err.message
            : "Failed to load diagnosis history."
        );
        setDiagnosisHistory([]);
      } finally {
        setLoadingHistory(false);
      }
    }

    loadDiagnosisHistory();
  }, [historyVehicleFilter, vehicles, historyRefreshKey]);
  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isDiagnosing, diagnosingStep]);

  // Selected Vehicle Helper
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) || null;
    const filteredDiagnosisHistory = diagnosisHistory.filter((item) => {
    const matchesVehicle =
      historyVehicleFilter === "all" ||
      item.vehicle_id === historyVehicleFilter;

    const normalizedSeverity = (item.severity || "").toLowerCase();

    const matchesSeverity =
      historySeverityFilter === "all" ||
      normalizedSeverity.includes(historySeverityFilter);

    return matchesVehicle && matchesSeverity;
  });

  // Handle Form Submission
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query || isDiagnosing) return;

    // Check if the chat was waiting for clarification
    const lastMsg = messages[messages.length - 1];
    const isAnsweringClarification = Boolean(
      lastMsg &&
        lastMsg.sender === "ai" &&
        (lastMsg.clarificationPrompt !== undefined || (lastMsg.diagnosis && lastMsg.diagnosis.isAmbiguous))
    );

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: query,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setLastUserSymptom(query);

    // 1. Client-Side Clarification check for vague inputs
    if (!isAnsweringClarification && isVagueSymptom(query)) {
      const clarificationResult: DiagnosticResult = {
        isAmbiguous: true,
        ambiguousReply: "I need a little more information to understand the issue.",
        followUpQuestions: [
          "When does the problem occur?",
          "Do you hear any unusual sound?",
          "Is a warning light showing?",
          "Does it happen while starting, braking, accelerating, or driving?",
        ],
        summary: "Please provide additional context on when or where the anomaly happens so I can deliver a precise diagnostic evaluation.",
        recommendations: [
          "Note if any dashboard check-engine or ABS light is illuminated.",
          "Observe if the symptom occurs under specific speeds or weather conditions.",
        ],
      };

      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        diagnosis: clarificationResult,
      };

      setMessages((prev) => [...prev, aiMessage]);
      return;
    }

    // 2. Validate Vehicle Selection
    if (!selectedVehicleId) {
      const errorMessage: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: "ai",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: "Please select or add a vehicle to your garage before running AI diagnosis.",
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }

    // 3. Trigger Real Diagnosis API Call
    setIsDiagnosing(true);
    setDiagnosingStep("Analyzing reported symptoms...");

    const stepTimer1 = setTimeout(() => {
      setDiagnosingStep("Cross-referencing vehicle specs & diagnostic database...");
    }, 450);

    const stepTimer2 = setTimeout(() => {
      setDiagnosingStep("Synthesizing probable causes, severity rating & action plan...");
    }, 950);

    try {
      const response = await diagnoseVehicle(selectedVehicleId, query);

      if (response && response.success && response.diagnosis) {
        const adapted = adaptBackendDiagnosisToUI(response.diagnosis, selectedVehicle);
        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: "ai",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          diagnosis: adapted,
        };
        setMessages((prev) => [...prev, aiMessage]);
        setHistoryRefreshKey((prev) => prev + 1);
      } else {
        const errorMessage: ChatMessage = {
          id: `ai-err-${Date.now()}`,
          sender: "ai",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: "Sorry, we couldn't generate a diagnosis right now. Please try again.",
          isError: true,
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (err: unknown) {
      console.error("Diagnosis API call failed:", err);
      const friendlyMsg = getFriendlyErrorMessage(err);
      const errorMessage: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: "ai",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: friendlyMsg,
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setIsDiagnosing(false);
    }
  };

  const handleSelectClarificationQuestion = (question: string) => {
    if (isDiagnosing) return;

    const config = CLARIFICATION_MAP[question] || {
      question,
      options: [
        { label: "Starting", detail: "Problem happens while starting the vehicle" },
        { label: "Braking", detail: "Problem happens while braking or stopping" },
        { label: "Accelerating", detail: "Problem happens while accelerating" },
        { label: "While driving", detail: "Problem happens while cruising or driving" },
      ],
    };

    const clarificationMsg: ChatMessage = {
      id: `ai-${Date.now()}`,
      sender: "ai",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      clarificationPrompt: {
        question: config.question,
        options: config.options,
      },
    };

    setMessages((prev) => [...prev, clarificationMsg]);
  };

  const handleSelectAnswerOption = async (optionLabel: string, optionDetail: string) => {
    if (isDiagnosing) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: optionLabel,
    };

    setMessages((prev) => [...prev, userMessage]);
  

    const combinedSymptom = lastUserSymptom
      ? `${lastUserSymptom}: ${optionDetail || optionLabel}`
      : (optionDetail || optionLabel);

    if (!selectedVehicleId) {
      const errorMessage: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: "ai",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: "Please select or add a vehicle to your garage before running AI diagnosis.",
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }

    setIsDiagnosing(true);
    setDiagnosingStep("Analyzing specific symptom context...");

    const stepTimer1 = setTimeout(() => {
      setDiagnosingStep("Cross-referencing vehicle specs & diagnostic database...");
    }, 450);

    const stepTimer2 = setTimeout(() => {
      setDiagnosingStep("Synthesizing probable causes, severity rating & action plan...");
    }, 950);

    try {
      const response = await diagnoseVehicle(selectedVehicleId, combinedSymptom);

      if (response && response.success && response.diagnosis) {
        const adapted = adaptBackendDiagnosisToUI(response.diagnosis, selectedVehicle);
        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: "ai",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          diagnosis: adapted,
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        const errorMessage: ChatMessage = {
          id: `ai-err-${Date.now()}`,
          sender: "ai",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: "Sorry, we couldn't generate a diagnosis right now. Please try again.",
          isError: true,
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (err: unknown) {
      console.error("Diagnosis API call failed after clarification:", err);
      const friendlyMsg = getFriendlyErrorMessage(err);
      const errorMessage: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: "ai",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: friendlyMsg,
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setIsDiagnosing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleResetChat = () => {
    setMessages([]);
    setInputValue("");
    setLastUserSymptom("");
    setIsDiagnosing(false);
    inputRef.current?.focus();
  };

  const handleOpenMechanicModal = (diag: DiagnosticResult) => {
    setMechanicModalContext({
      severity: diag.severity,
      system: diag.system,
      issue: diag.probableIssue,
    });
    setMechanicModalOpen(true);
  };

  const renderSeverityBadge = (severity?: SeverityLevel) => {
    switch (severity) {
      case "critical":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-950/60 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-rose-300 border border-rose-800 shadow-[0_0_8px_rgba(244,63,94,0.3)]">
            <Flame className="h-3 w-3 text-rose-400 animate-pulse" />
            Critical Severity
          </span>
        );
      case "high":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-950/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-300 border border-orange-800">
            <ShieldAlert className="h-3 w-3 text-orange-400" />
            High Severity
          </span>
        );
      case "medium":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-950/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 border border-amber-800">
            <AlertTriangle className="h-3 w-3 text-amber-400" />
            Medium Severity
          </span>
        );
      case "low":
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#101C1C] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#66C56A] border border-[#2E7D32]/40">
            <CheckCircle2 className="h-3 w-3 text-[#66C56A]" />
            Low Severity
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/40 shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#F5F7F6]">
              AI Vehicle Diagnosis
            </h1>
          </div>
          <p className="text-sm text-[#B8C4C2] mt-1">
            Describe symptoms, sounds, or warning lights to receive instant AI-guided mechanical diagnostics.
          </p>
        </div>

        {messages.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetChat}
            disabled={isDiagnosing}
            className="rounded-xl border-[#203131] bg-[#132020] text-xs font-semibold text-[#F5F7F6] hover:bg-[#132020] self-start sm:self-center shadow-xs"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5 text-[#66C56A]" />
            New Diagnosis
          </Button>
        )}
      </div>

      {/* Vehicle Selection Card */}
      <Card className="border-[#203131] bg-[#0B1515] shadow-xs rounded-2xl overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Left: Vehicle Selector & Details */}
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#101C1C] text-[#66C56A] shrink-0 border border-[#2E7D32]/40">
                {selectedVehicle?.vehicle_type === "Bike" ? (
                  <Bike className="h-6 w-6" />
                ) : (
                  <Car className="h-6 w-6" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#66C56A]">
                    Target Vehicle
                  </span>
                  {selectedVehicle && (
                    <span className="inline-flex items-center rounded-md bg-[#101C1C] px-1.5 py-0.5 text-[10px] font-semibold text-[#66C56A] border border-[#2E7D32]/30">
                      Active
                    </span>
                  )}
                </div>

                {loadingVehicles ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#66C56A]" />
                    <span className="text-xs text-[#81918E]">Loading garage vehicles...</span>
                  </div>
                ) : vehicles.length > 0 ? (
                  <div className="mt-1">
                    <select
                      id="vehicle-select"
                      aria-label="Select vehicle for diagnosis"
                      value={selectedVehicleId}
                      onChange={(e) => {
                        const newId = e.target.value;
                        setSelectedVehicleId(newId);
                        try {
                          localStorage.setItem("vehicare_active_vehicle_id", newId);
                        } catch {
                          // ignore storage errors
                        }
                      }}
                      disabled={isDiagnosing}
                      className="w-full max-w-sm rounded-xl border border-[#203131] bg-[#101C1C] px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#F5F7F6] outline-none transition-all focus:bg-[#132020] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A] cursor-pointer"
                    >
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.vehicle_type === "Bike" ? "[Bike] " : "[Car] "}
                          {v.year} {v.make} {v.model} (VIN: {v.vin || "N/A"})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-[#81918E]">No vehicles registered.</span>
                    <Link
                      href="/vehicles/add"
                      className="text-xs font-semibold text-[#66C56A] hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Add Vehicle
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Selected Vehicle Specs Badges */}
            {selectedVehicle && (
              <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-[#203131] text-xs">
                <div className="rounded-lg bg-[#132020] px-2.5 py-1 text-[#B8C4C2] font-medium flex items-center gap-1.5 border border-[#203131]">
                  <Gauge className="h-3.5 w-3.5 text-[#66C56A]" />
                  <span>{selectedVehicle.odometer_km ? `${selectedVehicle.odometer_km.toLocaleString()} km` : "Odometer N/A"}</span>
                </div>
                <div className="rounded-lg bg-[#132020] px-2.5 py-1 text-[#B8C4C2] font-medium flex items-center gap-1.5 border border-[#203131]">
                  <span className="font-mono text-[11px] text-[#81918E]">VIN:</span>
                  <span className="font-mono text-[11px]">{selectedVehicle.vin || "Generic"}</span>
                </div>
              </div>
            )}
          </div>

          {vehiclesError && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-950/40 p-2.5 text-xs text-amber-300 border border-amber-900">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
              <span>Could not connect to backend vehicle registry. Using diagnosis in general mode.</span>
            </div>
          )}
        </CardContent>
      </Card>
            {/* Diagnosis History */}
      <Card className="border-[#203131] bg-[#0B1515] shadow-xs rounded-2xl overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#F5F7F6]">
                Diagnosis History
              </h2>
              <p className="text-xs text-[#81918E]">
                Previous AI diagnosis results for your vehicles.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={historyVehicleFilter}
                onChange={(e) => setHistoryVehicleFilter(e.target.value)}
                className="rounded-xl border border-[#203131] bg-[#101C1C] px-3 py-2 text-xs text-[#F5F7F6]"
              >
                <option value="all">All Vehicles</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </option>
                ))}
              </select>

              <select
                value={historySeverityFilter}
                onChange={(e) =>
                  setHistorySeverityFilter(
                    e.target.value as SeverityLevel | "all"
                  )
                }
                className="rounded-xl border border-[#203131] bg-[#101C1C] px-3 py-2 text-xs text-[#F5F7F6]"
              >
                <option value="all">All Severity</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {loadingHistory && (
            <div className="py-6 text-center text-xs text-[#81918E]">
              <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
              Loading diagnosis history...
            </div>
          )}

          {!loadingHistory && historyError && (
            <div className="rounded-xl border border-rose-900 bg-rose-950/30 p-3 text-xs text-rose-300">
              {historyError}
            </div>
          )}

          {!loadingHistory &&
            !historyError &&
            filteredDiagnosisHistory.length === 0 && (
              <div className="py-6 text-center text-xs text-[#81918E]">
                No diagnosis history found for the selected filters.
              </div>
            )}

          {!loadingHistory &&
            !historyError &&
            filteredDiagnosisHistory.length > 0 && (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {filteredDiagnosisHistory.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[#203131] bg-[#101C1C] p-4 space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <span className="text-xs font-bold text-[#F5F7F6]">
                        {item.possible_cause || "Diagnosis"}
                      </span>

                      <span className="rounded-full bg-[#132020] px-2.5 py-1 text-[10px] font-semibold text-[#66C56A] border border-[#2E7D32]/40">
                        {item.severity || "Unknown"}
                      </span>
                    </div>

                    <p className="text-xs text-[#B8C4C2]">
                      <span className="font-semibold text-[#81918E]">
                        Symptom:
                      </span>{" "}
                      {item.symptom || "No symptom details available."}
                    </p>

                    {item.recommended_action && (
                      <p className="text-xs text-[#B8C4C2]">
                        <span className="font-semibold text-[#81918E]">
                          Action:
                        </span>{" "}
                        {item.recommended_action}
                      </p>
                    )}

                    {item.created_at && (
                      <p className="text-[11px] text-[#81918E]">
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
        </CardContent>
      </Card>
      {/* Main Chat Shell */}
      <Card className="border-[#203131] bg-[#0B1515] shadow-xs rounded-2xl overflow-hidden flex flex-col min-h-[460px]">
        {/* Chat Feed */}
        <div
          className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto max-h-[600px] scrollbar-thin"
          aria-live="polite"
        >
          {messages.length === 0 ? (
            /* Empty State & Quick Prompts */
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/40 shadow-xs">
                <Bot className="h-8 w-8" />
                <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#2E7D32] text-white ring-2 ring-[#0B1515]">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
              </div>

              <div className="max-w-md space-y-2">
                <h2 className="text-lg font-bold text-[#F5F7F6] tracking-tight">
                  How can VehiCare AI assist with your vehicle?
                </h2>
                <p className="text-xs sm:text-sm text-[#81918E] leading-relaxed">
                  Describe what you are noticing — unusual sounds, dashboard warning lights, vibration, fluid leaks, or performance drops.
                </p>
              </div>

              {/* Quick Prompts Container */}
              <div className="w-full max-w-xl space-y-2.5 pt-2">
                <div className="text-xs font-bold uppercase tracking-wider text-[#81918E] text-left px-1">
                  Common Diagnostic Queries
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {QUICK_PROMPTS.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSendMessage(item.prompt)}
                        className="group flex items-start gap-2.5 p-3 rounded-xl border border-[#203131] bg-[#101C1C] hover:bg-[#132020] hover:border-[#66C56A]/50 text-left transition-all active:scale-[0.99] cursor-pointer"
                      >
                        <div className="p-1.5 rounded-lg bg-[#132020] group-hover:bg-[#101C1C] text-[#66C56A] shadow-xs transition-colors shrink-0 mt-0.5 border border-[#203131]">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#F5F7F6] group-hover:text-[#66C56A] transition-colors truncate">
                            {item.label}
                          </p>
                          <p className="text-[11px] text-[#81918E] leading-tight mt-0.5 line-clamp-2">
                            {item.prompt}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Chat Messages History */
            messages.map((msg) => {
              if (msg.sender === "user") {
                return (
                  <div key={msg.id} className="flex justify-end gap-3 items-start">
                    <div className="flex flex-col items-end max-w-[85%] sm:max-w-[75%] space-y-1">
                      <div className="flex items-center gap-2 text-[11px] text-[#81918E]">
                        <span className="font-semibold text-[#B8C4C2]">You</span>
                        <span>•</span>
                        <span>{msg.timestamp}</span>
                      </div>
                      <div className="rounded-2xl rounded-tr-xs bg-[#2E7D32] p-4 text-white text-xs sm:text-sm leading-relaxed shadow-xs break-words">
                        {msg.text}
                      </div>
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#132020] text-[#F5F7F6] border border-[#203131] shrink-0 mt-4">
                      <User className="h-4 w-4" />
                    </div>
                  </div>
                );
              }

              // CASE 0: ERROR MESSAGE CARD
              if (msg.isError) {
                return (
                  <div key={msg.id} className="flex justify-start gap-3 items-start">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0 mt-4 border border-rose-500/20 shadow-xs">
                      <AlertCircle className="h-4 w-4" />
                    </div>

                    <div className="flex flex-col items-start max-w-[92%] sm:max-w-[85%] space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                          Diagnostic Service Notice
                        </span>
                        <span>•</span>
                        <span>{msg.timestamp}</span>
                      </div>

                      <div className="w-full rounded-2xl rounded-tl-xs border border-rose-500/30 bg-rose-500/10 p-4 sm:p-5 shadow-xs space-y-2 text-rose-700 dark:text-rose-200">
                        <p className="text-xs sm:text-sm text-foreground leading-relaxed font-medium">
                          {msg.text}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }

              // CASE 1: SPECIFIC AI QUESTION WITH SELECTABLE ANSWER OPTIONS
              if (msg.clarificationPrompt) {
                const prompt = msg.clarificationPrompt;
                return (
                  <div key={msg.id} className="flex justify-start gap-3 items-start">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#101C1C] text-[#66C56A] shrink-0 mt-4 border border-[#2E7D32]/40 shadow-xs">
                      <Bot className="h-4 w-4" />
                    </div>

                    <div className="flex flex-col items-start max-w-[92%] sm:max-w-[85%] space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 text-[11px] text-[#81918E]">
                        <span className="font-bold text-[#66C56A] flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> VehiCare AI Diagnostic
                        </span>
                        <span>•</span>
                        <span>{msg.timestamp}</span>
                      </div>

                      <div className="w-full rounded-2xl rounded-tl-xs border border-[#203131] bg-[#101C1C] p-4 sm:p-5 shadow-xs space-y-3.5 text-[#F5F7F6]">
                        <div className="flex items-center gap-2 text-[#66C56A]">
                          <HelpCircle className="h-4 w-4 shrink-0" />
                          <span className="text-xs font-bold uppercase tracking-wider">
                            Follow-Up Question
                          </span>
                        </div>

                        <h3 className="text-sm sm:text-base font-bold text-[#F5F7F6] leading-snug">
                          {prompt.question}
                        </h3>

                        <p className="text-xs text-[#81918E]">
                          Please select the option that best matches your vehicle&apos;s condition:
                        </p>

                        {/* Selectable Answer Options */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {prompt.options.map((opt, oIdx) => (
                            <button
                              key={oIdx}
                              type="button"
                              onClick={() => handleSelectAnswerOption(opt.label, opt.detail)}
                              disabled={isDiagnosing}
                              className="group flex items-center justify-between gap-2 p-3 rounded-xl border border-[#203131] bg-[#132020] hover:bg-[#132020] hover:border-[#66C56A]/50 text-left transition-all text-xs font-semibold text-[#F5F7F6] hover:text-[#66C56A] active:scale-[0.99] shadow-xs cursor-pointer disabled:opacity-50"
                            >
                              <span className="truncate">{opt.label}</span>
                              <ChevronRight className="h-3.5 w-3.5 text-[#81918E] group-hover:text-[#66C56A] shrink-0 transition-transform group-hover:translate-x-0.5" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // AI Diagnostic Assistant Message
              const diag = msg.diagnosis;
              if (!diag) return null;

              // CASE 2: VAGUE / AMBIGUOUS INITIAL RESPONSE
              if (diag.isAmbiguous) {
                return (
                  <div key={msg.id} className="flex justify-start gap-3 items-start">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#101C1C] text-[#66C56A] shrink-0 mt-4 border border-[#2E7D32]/40 shadow-xs">
                      <Bot className="h-4 w-4" />
                    </div>

                    <div className="flex flex-col items-start max-w-[92%] sm:max-w-[85%] space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 text-[11px] text-[#81918E]">
                        <span className="font-bold text-[#66C56A] flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> VehiCare AI Diagnostic
                        </span>
                        <span>•</span>
                        <span>{msg.timestamp}</span>
                      </div>

                      <div className="w-full rounded-2xl rounded-tl-xs border border-[#D9A441]/40 bg-[#1C180E] p-4 sm:p-5 shadow-xs space-y-4 text-[#F5F7F6]">
                        {/* Header banner */}
                        <div className="flex items-center gap-2 text-[#D9A441]">
                          <HelpCircle className="h-4 w-4 shrink-0 text-[#D9A441]" />
                          <span className="text-xs font-bold uppercase tracking-wider">
                            Clarification Needed
                          </span>
                        </div>

                        {/* AI Core Clarification Text */}
                        <div className="text-xs sm:text-sm font-semibold text-[#F5F7F6] leading-relaxed">
                          {diag.ambiguousReply || "I need a little more information to understand the issue."}
                        </div>

                        <p className="text-xs text-[#B8C4C2] leading-relaxed">
                          To pinpoint the exact mechanical cause, select one of the following questions to explore:
                        </p>

                        {/* Follow-up Question Chips */}
                        {diag.followUpQuestions && diag.followUpQuestions.length > 0 && (
                          <div className="space-y-2 pt-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {diag.followUpQuestions.map((question, qIdx) => (
                                <button
                                  key={qIdx}
                                  type="button"
                                  onClick={() => handleSelectClarificationQuestion(question)}
                                  disabled={isDiagnosing}
                                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-[#D9A441]/30 bg-[#132020] hover:bg-[#132020] hover:border-[#D9A441]/60 text-left transition-all text-xs text-[#F5F7F6] font-medium active:scale-[0.99] shadow-xs cursor-pointer disabled:opacity-50"
                                >
                                  <span>{question}</span>
                                  <ChevronRight className="h-3.5 w-3.5 text-[#D9A441] shrink-0 opacity-80" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              // CASE 3: FULL STRUCTURED DIAGNOSIS REPLY
              const isHighOrCritical =
                diag.severity === "high" ||
                diag.severity === "critical" ||
                Boolean(diag.mechanicRequired);

              return (
                <div key={msg.id} className="flex justify-start gap-3 items-start">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#101C1C] text-[#66C56A] shrink-0 mt-4 border border-[#2E7D32]/40 shadow-xs">
                    <Bot className="h-4 w-4" />
                  </div>

                  <div className="flex flex-col items-start max-w-[92%] sm:max-w-[85%] space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 text-[11px] text-[#81918E]">
                      <span className="font-bold text-[#66C56A] flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> VehiCare AI Diagnostic
                      </span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    {/* AI Structured Diagnostic Card */}
                    <div className="w-full rounded-2xl rounded-tl-xs border border-[#203131] bg-[#101C1C] p-4 sm:p-5 shadow-xs space-y-4 text-[#F5F7F6]">
                      {/* Top Banner: System & Severity Badge */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#203131]">
                        <div className="flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-[#66C56A]" />
                          <span className="text-xs font-bold text-[#F5F7F6]">
                            {diag.system || "Mechanical System"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {renderSeverityBadge(diag.severity)}
                          {diag.estimatedCostRange && (
                            <span className="rounded-full bg-[#132020] px-2.5 py-0.5 text-[10px] font-bold text-[#B8C4C2] border border-[#203131]">
                              Est. {diag.estimatedCostRange}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Probable Issue Highlight */}
                      {diag.probableIssue && (
                        <div className="rounded-xl bg-[#132020] p-3 border border-[#203131] space-y-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#81918E]">
                            Probable Issue
                          </span>
                          <p className="text-xs sm:text-sm font-bold text-[#F5F7F6]">
                            {diag.probableIssue}
                          </p>
                        </div>
                      )}

                      {/* Diagnosis Summary */}
                      {diag.summary && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#81918E]">
                            Diagnosis Summary
                          </span>
                          <div className="text-xs sm:text-sm text-[#B8C4C2] leading-relaxed font-medium">
                            {diag.summary}
                          </div>
                        </div>
                      )}

                      {/* Probable Root Causes */}
                      {diag.causes && diag.causes.length > 0 && (
                        <div className="space-y-2.5 pt-1">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-[#81918E]">
                            Root Cause Breakdown
                          </h4>

                          <div className="space-y-2">
                            {diag.causes.map((cause, cIdx) => (
                              <div
                                key={cIdx}
                                className="rounded-xl border border-[#203131] bg-[#132020] p-3 space-y-1.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-bold text-[#F5F7F6]">
                                    {cause.title}
                                  </span>
                                  <span className="text-[11px] font-bold text-[#66C56A] shrink-0">
                                    {cause.likelihood}% Match
                                  </span>
                                </div>

                                {/* Progress bar */}
                                <div className="h-1.5 w-full rounded-full bg-[#132020] overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-[#66C56A]"
                                    style={{ width: `${cause.likelihood}%` }}
                                  ></div>
                                </div>

                                <p className="text-[11px] text-[#81918E] leading-normal">
                                  {cause.description}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recommended Action Plan */}
                      {diag.recommendations && diag.recommendations.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-[#81918E]">
                            Recommended Action
                          </h4>

                          <ul className="space-y-1.5">
                            {diag.recommendations.map((rec, rIdx) => (
                              <li
                                key={rIdx}
                                className="flex items-start gap-2 text-xs text-[#B8C4C2]"
                              >
                                <CheckCircle2 className="h-4 w-4 text-[#66C56A] shrink-0 mt-0.5" />
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Urgency & Safety Notice */}
                      {diag.safetyNotice && (
                        <div
                          className={`rounded-xl p-3 space-y-1 border ${
                            diag.severity === "critical"
                              ? "bg-rose-950/40 border-rose-900 text-rose-200"
                              : "bg-amber-950/40 border-amber-900 text-amber-200"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs font-bold">
                            <Clock className="h-3.5 w-3.5" />
                            <span>Urgency: {diag.urgency || "Prompt inspection advised"}</span>
                          </div>
                          <p className="text-[11px] leading-relaxed opacity-90">
                            {diag.safetyNotice}
                          </p>
                        </div>
                      )}

                      {/* Actions Toolbar */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#203131]">
                        {/* "See a Mechanic" Action for High/Critical/Mechanic Required */}
                        {isHighOrCritical && (
                          <Button
                            onClick={() => handleOpenMechanicModal(diag)}
                            className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs text-xs font-bold px-3.5 py-2"
                          >
                            <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
                            See a Mechanic
                          </Button>
                        )}

                        <Link href="/issues">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="rounded-xl text-xs font-semibold bg-[#101C1C] text-[#66C56A] hover:bg-[#163D23] border border-[#2E7D32]/30"
                          >
                            <AlertCircle className="mr-1.5 h-3.5 w-3.5" />
                            Log in Issues Tracker
                          </Button>
                        </Link>

                        <Link href="/maintenance">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl border-[#203131] bg-[#132020] text-xs font-semibold text-[#F5F7F6] hover:bg-[#132020]"
                          >
                            <Wrench className="mr-1.5 h-3.5 w-3.5 text-[#66C56A]" />
                            Schedule Service
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Diagnosing Loading State Indicator */}
          {isDiagnosing && (
            <div
              className="flex justify-start gap-3 items-start animate-in fade-in-0 duration-200"
              aria-live="polite"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#101C1C] text-[#66C56A] shrink-0 mt-2 border border-[#2E7D32]/40 shadow-xs">
                <Bot className="h-4 w-4" />
              </div>

              <div className="flex flex-col items-start max-w-[85%] space-y-1.5">
                <div className="flex items-center gap-2 text-[11px] text-[#81918E]">
                  <span className="font-bold text-[#66C56A] flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> VehiCare AI
                  </span>
                  <span>•</span>
                  <span>Diagnosing...</span>
                </div>

                <div className="rounded-2xl rounded-tl-xs border border-[#2E7D32]/40 bg-[#101C1C]/40 p-4 shadow-xs space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    {/* Animated Pulsing Wave Dots */}
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#66C56A] animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="h-2 w-2 rounded-full bg-[#66C56A] animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="h-2 w-2 rounded-full bg-[#66C56A] animate-bounce"></span>
                    </div>
                    <span className="text-xs font-bold text-[#66C56A]">
                      Diagnosing Vehicle Symptom...
                    </span>
                  </div>

                  <p className="text-[11px] font-medium text-[#B8C4C2] transition-all duration-300">
                    {diagnosingStep}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Message Input Box Shell */}
        <div className="p-3 sm:p-4 bg-[#0B1515] border-t border-[#203131]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-2"
          >
            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                rows={2}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isDiagnosing}
                placeholder="Describe symptoms (e.g., squealing brakes, check engine light, car feels weird)..."
                aria-label="Describe vehicle symptom for AI diagnosis"
                className="w-full resize-none rounded-xl border border-[#203131] bg-[#101C1C] px-3.5 py-2.5 text-xs sm:text-sm text-[#F5F7F6] placeholder:text-[#81918E] outline-none transition-all focus:bg-[#132020] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A] disabled:bg-[#132020] disabled:cursor-not-allowed"
              />
              <div className="hidden sm:block absolute right-2.5 bottom-2 text-[10px] text-[#81918E] font-medium pointer-events-none">
                Press <kbd className="px-1 py-0.5 rounded-sm bg-[#132020] border border-[#203131] font-mono text-[9px] text-[#B8C4C2]">Enter ↵</kbd> to diagnose
              </div>
            </div>

            <Button
              type="submit"
              disabled={!inputValue.trim() || isDiagnosing}
              className="h-11 px-4 rounded-xl bg-[#2E7D32] text-white hover:bg-[#256628] shadow-xs flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
              aria-label="Send symptom for AI diagnosis"
            >
              {isDiagnosing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span className="hidden sm:inline text-xs font-semibold">Diagnose</span>
                  <Send className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Privacy & Safety Footnote */}
          <div className="flex items-center justify-between text-[11px] text-[#81918E] mt-2 px-1">
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3 text-[#66C56A]" />
              AI diagnostics are guidance estimates; always consult certified technicians.
            </span>
            {selectedVehicle && (
              <span className="hidden md:inline font-medium text-[#B8C4C2] truncate max-w-[200px]">
                Diagnosing: {selectedVehicle.make} {selectedVehicle.model}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* "See a Mechanic" Action Modal */}
      {mechanicModalOpen && mechanicModalContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-[#0B1515] p-6 shadow-xl border border-[#203131] space-y-4 relative animate-in fade-in-0 zoom-in-95 duration-150">
            <button
              onClick={() => setMechanicModalOpen(false)}
              className="absolute right-4 top-4 rounded-xl p-1 text-[#81918E] hover:bg-[#132020] hover:text-[#F5F7F6] transition-colors"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-rose-950/60 p-3 text-rose-400 border border-rose-800">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#F5F7F6]">
                  Certified Mechanic Advisory
                </h3>
                <span className="text-xs text-rose-400 font-semibold">
                  {mechanicModalContext.severity === "critical" ? "Critical Severity Risk" : "High Severity Diagnostic"}
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-[#101C1C] p-3.5 border border-[#203131] text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-[#81918E]">System Involved:</span>
                <span className="font-semibold text-[#F5F7F6]">{mechanicModalContext.system || "Engine / Powertrain"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#81918E]">Primary Concern:</span>
                <span className="font-semibold text-[#F5F7F6]">{mechanicModalContext.issue || "Physical Component Inspection"}</span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-[#B8C4C2] leading-relaxed">
              <p>
                Because this issue has elevated severity, we recommend scheduling an inspection with a certified technician before continuing high-speed or long-distance driving.
              </p>
              <p className="text-[11px] text-[#81918E]">
                Tip: You can log this diagnosis into your Vehicle Issues tracker or export it for your technician during inspection.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <Link href="/maintenance" className="flex-1">
                <Button
                  onClick={() => setMechanicModalOpen(false)}
                  className="w-full rounded-xl bg-[#2E7D32] hover:bg-[#256628] text-white text-xs font-semibold"
                >
                  <Wrench className="mr-1.5 h-3.5 w-3.5" />
                  Schedule Service
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => setMechanicModalOpen(false)}
                className="rounded-xl border-[#203131] bg-[#132020] text-xs font-semibold text-[#F5F7F6] hover:bg-[#132020]"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
