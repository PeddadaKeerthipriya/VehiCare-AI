"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Bell,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  ReminderItem,
  getReminderStatus,
  fetchUserReminders,
} from "@/lib/reminders";
import { subscribeToSyncEvents } from "@/lib/realtimeSync";

export default function RemindersPage() {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const getStatus = getReminderStatus;

  const loadReminders = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const combined = await fetchUserReminders();
      setReminders(combined);
    } catch (err) {
      console.error("Failed to load reminders:", err);
      setError("Failed to load service reminders.");
      setReminders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReminders();

    const channel = supabase
      .channel("reminders-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "maintenance_schedules",
        },
        () => {
          console.log("[Realtime] maintenance_schedules changed — reloading reminders");
          loadReminders();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "insurance_policies",
        },
        () => {
          console.log("[Realtime] insurance_policies changed — reloading reminders");
          loadReminders();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "puc_certificates",
        },
        () => {
          console.log("[Realtime] puc_certificates changed — reloading reminders");
          loadReminders();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vehicles",
        },
        () => {
          console.log("[Realtime] vehicles changed — reloading reminders");
          loadReminders();
        }
      )
      .subscribe((status) => {
        console.log("[Realtime] reminders channel:", status);
      });

    // Sync bus: instant same-tab, cross-tab, and Supabase broadcast updates
    const unsubscribeSync = subscribeToSyncEvents((payload) => {
      console.log("[RealtimeSync] Reminders received sync event — reloading reminders:", payload);
      loadReminders();
    });

    return () => {
      unsubscribeSync();
      supabase.removeChannel(channel);
    };
  }, [loadReminders]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F7F6]">
            Service Reminders
          </h1>
          <p className="text-sm text-[#81918E]">
            Never miss essential maintenance checkups and inspection deadlines
          </p>
        </div>

        <Button className="w-full rounded-xl bg-[#2E7D32] text-white hover:bg-[#256628] sm:w-auto shadow-xs">
          <Plus className="mr-2 h-4 w-4" />
          Add Reminder
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-2xl border border-[#203131] bg-[#0B1515] p-8 text-center">
          <p className="text-sm text-[#81918E]">
            Loading service reminders...
          </p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-2xl border border-rose-800 bg-rose-950/40 p-8 text-center">
          <p className="text-sm text-rose-300">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && reminders.length === 0 && (
        <div className="rounded-2xl border border-[#203131] bg-[#0B1515] p-8 text-center">
          <Bell className="mx-auto mb-3 h-8 w-8 text-[#81918E]" />

          <h3 className="text-sm font-semibold text-[#F5F7F6]">
            No service reminders
          </h3>

          <p className="mt-1 text-xs text-[#81918E]">
            You don&apos;t have any reminders yet.
          </p>
        </div>
      )}

      {/* Reminders List */}
      {!loading && !error && reminders.length > 0 && (
        <div className="space-y-4">
          {reminders.map((r) => {
            const status = getStatus(r.status, r.due_date);

            let badgeClass =
              "bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/40";
            let iconColor = "text-[#66C56A]";
            let leftBorderColor = "bg-[#2E7D32]";

            if (status === "critical") {
              badgeClass =
                "bg-rose-950/60 text-rose-300 border border-rose-800";
              iconColor = "text-rose-400";
              leftBorderColor = "bg-rose-500";
            } else if (status === "warning") {
              badgeClass =
                "bg-amber-950/60 text-amber-300 border border-amber-800";
              iconColor = "text-amber-400";
              leftBorderColor = "bg-amber-500";
            }

            return (
              <Card
                key={r.id}
                className="overflow-hidden border-[#203131] bg-[#0B1515] transition-all hover:border-[#66C56A]/50 hover:shadow-xs group"
              >
                <div className="flex min-h-20 items-stretch">
                  <div
                    className={`w-1.5 shrink-0 ${leftBorderColor}`}
                  />

                  <CardContent className="flex-1 p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#101C1C] border border-[#203131]">
                          {status === "critical" ? (
                            <AlertTriangle
                              className={`h-5 w-5 ${iconColor}`}
                            />
                          ) : status === "warning" ? (
                            <Bell className={`h-5 w-5 ${iconColor}`} />
                          ) : (
                            <CheckCircle
                              className={`h-5 w-5 ${iconColor}`}
                            />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-[#F5F7F6] sm:text-base">
                              {r.task_name}
                            </h3>

                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${badgeClass}`}
                            >
                              {status}
                            </span>
                          </div>

                          <p className="mt-0.5 text-xs font-semibold text-[#81918E]">
                            {r.vehicleName}
                          </p>

                          <p className="mt-1 text-xs text-[#B8C4C2]">
                            {r.due_odometer_km && r.due_odometer_km > 0
                              ? `Due at ${r.due_odometer_km.toLocaleString()} km`
                              : r.reminderType === "insurance" || r.reminderType === "puc"
                              ? "Document Expiry Reminder"
                              : "Time-based Maintenance"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 border-t border-[#203131] pt-3 text-xs sm:border-0 sm:pt-0">
                        <div className="flex items-center gap-1.5 rounded-xl bg-[#101C1C] border border-[#203131] px-3 py-1.5 text-[#B8C4C2]">
                          <Calendar className="h-3.5 w-3.5 text-[#66C56A]" />

                          <span className="font-medium">
                            {formatDate(r.due_date)}
                          </span>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-[#203131] bg-[#132020] text-[#66C56A] hover:bg-[#101C1C] hover:border-[#2E7D32]/50"
                        >
                          Complete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}