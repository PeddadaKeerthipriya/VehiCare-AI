"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Bell,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Mail,
  Smartphone,
  Monitor,
  Clock,
  RefreshCw,
} from "lucide-react";

import {
  fetchNotifications,
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/api";

import type {
  BackendNotification,
  NotificationPreferences,
} from "@/lib/types";
import { supabase } from "@/lib/supabase";

const DEFAULT_PREFERENCES: NotificationPreferences = {
  in_app_enabled: true,
  email_enabled: false,
  sms_enabled: false,
};

export default function NotificationsPage() {
  const [alerts, setAlerts] = useState<BackendNotification[]>([]);
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(DEFAULT_PREFERENCES);

  const [loading, setLoading] = useState(true);
  const [preferencesLoading, setPreferencesLoading] = useState(true);

  const [error, setError] = useState("");
  const [preferencesError, setPreferencesError] = useState("");

  const [savingPreference, setSavingPreference] = useState(false);

  // =========================================================
  // LOAD NOTIFICATIONS + PREFERENCES
  // =========================================================

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await fetchNotifications();

      setAlerts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load notifications:", err);
      setError("Failed to load notifications.");
      setAlerts([]);
    } finally {
      setLoading(false);
    }

    try {
      setPreferencesLoading(true);
      setPreferencesError("");

      const data = await fetchNotificationPreferences();

      setPreferences(data);
    } catch (err) {
      console.error(
        "Failed to load notification preferences:",
        err
      );

      setPreferencesError(
        "Failed to load notification preferences."
      );
    } finally {
      setPreferencesLoading(false);
    }
  };

  useEffect(() => {
  loadData();

  const channel = supabase
    .channel("notifications-realtime")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
      },
      async () => {
        try {
          const data = await fetchNotifications();
          setAlerts(Array.isArray(data) ? data : []);
        } catch (err) {
          console.error(
            "Failed to refresh notifications in realtime:",
            err
          );
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notification_preferences",
      },
      async () => {
        try {
          const data = await fetchNotificationPreferences();
          setPreferences(data);
        } catch (err) {
          console.error(
            "Failed to refresh notification preferences in realtime:",
            err
          );
        }
      }
    )
    .subscribe((status) => {
      console.log("[Realtime] notifications channel:", status);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}, []);

  // =========================================================
  // UPDATE CHANNEL PREFERENCE
  // =========================================================

  const handlePreferenceChange = async (
    key:
      | "in_app_enabled"
      | "email_enabled"
      | "sms_enabled",
    value: boolean
  ) => {
    const previousPreferences = preferences;

    const updatedPreferences = {
      ...preferences,
      [key]: value,
    };

    // Optimistic UI update
    setPreferences(updatedPreferences);
    setSavingPreference(true);
    setPreferencesError("");

    try {
      const updated = await updateNotificationPreferences({
        in_app_enabled:
          updatedPreferences.in_app_enabled,
        email_enabled:
          updatedPreferences.email_enabled,
        sms_enabled:
          updatedPreferences.sms_enabled,
      });

      setPreferences(updated);
    } catch (err) {
      console.error(
        "Failed to update notification preference:",
        err
      );

      // Revert UI if backend fails
      setPreferences(previousPreferences);

      setPreferencesError(
        "Failed to save notification preference."
      );
    } finally {
      setSavingPreference(false);
    }
  };

  // =========================================================
  // HELPERS
  // =========================================================

  const getNotificationType = (
    notificationType?: string | null
  ) => {
    const type = notificationType?.toLowerCase();

    if (
      type?.includes("maintenance") ||
      type?.includes("reminder")
    ) {
      return "reminder";
    }

    if (
      type?.includes("alert") ||
      type?.includes("warning") ||
      type?.includes("critical")
    ) {
      return "alert";
    }

    return "general";
  };

  const getChannelLabel = (
    channel?: string | null
  ) => {
    if (!channel) return "In-App";

    const value = channel.toLowerCase();

    if (value === "email") return "Email";
    if (value === "sms") return "SMS";
    if (value === "in_app" || value === "in-app") {
      return "In-App";
    }

    return channel;
  };

  const formatTime = (
    dateValue?: string | null
  ) => {
    if (!dateValue) return "";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleString();
  };

  const getDeliveryStatus = (
    status?: string | null
  ) => {
    if (!status) return "Pending";

    return status;
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="space-y-6">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F7F6]">
            Notifications
          </h1>

          <p className="text-sm text-[#81918E]">
            Live system alerts, maintenance reminders, and
            notification delivery updates
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-xl border border-[#203131] bg-[#132020] px-4 py-2 text-sm font-semibold text-[#66C56A] transition hover:bg-[#101C1C] disabled:opacity-50"
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${
              loading ? "animate-spin" : ""
            }`}
          />

          Refresh
        </button>
      </div>

      {/* =====================================================
          CHANNEL PREFERENCES
      ===================================================== */}

      <Card className="rounded-2xl border-[#203131] bg-[#0B1515]">
        <CardContent className="p-5">
          <div className="mb-5">
            <h2 className="text-base font-bold text-[#F5F7F6]">
              Notification Preferences
            </h2>

            <p className="mt-1 text-xs text-[#81918E]">
              Choose how you want to receive vehicle updates.
            </p>
          </div>

          {preferencesLoading ? (
            <div className="text-sm text-[#81918E]">
              Loading preferences...
            </div>
          ) : (
            <div className="space-y-4">
              {/* IN APP */}

              <div className="flex items-center justify-between rounded-xl border border-[#203131] bg-[#0F1719] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2E7D32]/30 bg-[#101C1C]">
                    <Monitor className="h-5 w-5 text-[#66C56A]" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-[#F5F7F6]">
                      In-App Notifications
                    </p>

                    <p className="text-xs text-[#81918E]">
                      Receive notifications inside VehiCare AI
                    </p>
                  </div>
                </div>

                <button
  type="button"
  role="switch"
  aria-checked={preferences.in_app_enabled}
  disabled={savingPreference}
  onClick={() =>
    handlePreferenceChange(
      "in_app_enabled",
      !preferences.in_app_enabled
    )
  }
  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
    preferences.in_app_enabled
      ? "bg-[#66C56A]"
      : "bg-[#203131]"
  } disabled:cursor-not-allowed disabled:opacity-50`}
>
  <span
    className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
      preferences.in_app_enabled
        ? "translate-x-5"
        : "translate-x-1"
    }`}
  />
</button>
              </div>

              {/* EMAIL */}

              <div className="flex items-center justify-between rounded-xl border border-[#203131] bg-[#0F1719] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#203131] bg-[#101C1C]">
                    <Mail className="h-5 w-5 text-[#B8C4C2]" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-[#F5F7F6]">
                      Email Notifications
                    </p>

                    <p className="text-xs text-[#81918E]">
                      Receive important vehicle updates by email
                    </p>
                  </div>
                </div>

                <button
  type="button"
  role="switch"
  aria-checked={preferences.email_enabled}
  disabled={savingPreference}
  onClick={() =>
    handlePreferenceChange(
      "email_enabled",
      !preferences.email_enabled
    )
  }
  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
    preferences.email_enabled
      ? "bg-[#66C56A]"
      : "bg-[#203131]"
  } disabled:cursor-not-allowed disabled:opacity-50`}
>
  <span
    className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
      preferences.email_enabled
        ? "translate-x-5"
        : "translate-x-1"
    }`}
  />
</button>
              </div>

              {/* SMS */}

              <div className="flex items-center justify-between rounded-xl border border-[#203131] bg-[#0F1719] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#203131] bg-[#101C1C]">
                    <Smartphone className="h-5 w-5 text-[#B8C4C2]" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-[#F5F7F6]">
                      SMS Notifications
                    </p>

                    <p className="text-xs text-[#81918E]">
                      Receive critical alerts through SMS
                    </p>
                  </div>
                </div>

                <button
  type="button"
  role="switch"
  aria-checked={preferences.sms_enabled}
  disabled={savingPreference}
  onClick={() =>
    handlePreferenceChange(
      "sms_enabled",
      !preferences.sms_enabled
    )
  }
  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
    preferences.sms_enabled
      ? "bg-[#66C56A]"
      : "bg-[#203131]"
  } disabled:cursor-not-allowed disabled:opacity-50`}
>
  <span
    className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
      preferences.sms_enabled
        ? "translate-x-5"
        : "translate-x-1"
    }`}
  />
</button>
              </div>
            </div>
          )}

          {preferencesError && (
            <p className="mt-4 text-xs text-rose-400">
              {preferencesError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* =====================================================
          LIVE NOTIFICATION FEED
      ===================================================== */}

      <div>
        <div className="mb-3 flex items-center gap-2">
          <Bell className="h-5 w-5 text-[#66C56A]" />

          <h2 className="text-base font-bold text-[#F5F7F6]">
            Live Notification Feed
          </h2>
        </div>

        {/* Loading */}

        {loading && (
          <div className="rounded-2xl border border-[#203131] bg-[#0B1515] p-6 text-sm text-[#81918E]">
            Loading notifications...
          </div>
        )}

        {/* Error */}

        {!loading && error && (
          <div className="rounded-2xl border border-rose-800 bg-rose-950/40 p-6 text-sm text-rose-300">
            {error}
          </div>
        )}

        {/* Empty */}

        {!loading &&
          !error &&
          alerts.length === 0 && (
            <div className="rounded-2xl border border-[#203131] bg-[#0B1515] p-8 text-center">
              <Bell className="mx-auto mb-3 h-8 w-8 text-[#81918E]" />

              <h3 className="text-sm font-semibold text-[#F5F7F6]">
                No notifications
              </h3>

              <p className="mt-1 text-xs text-[#81918E]">
                You don&apos;t have any notifications yet.
              </p>
            </div>
          )}

        {/* Notification List */}

        {!loading &&
          !error &&
          alerts.length > 0 && (
            <div className="space-y-3">
              {alerts.map((alert) => {
                const type = getNotificationType(
                  alert.notification_type
                );

                let Icon = Bell;

                let iconWrapperClass =
                  "bg-[#101C1C] text-[#B8C4C2] border border-[#203131]";

                if (type === "reminder") {
                  Icon = Wrench;

                  iconWrapperClass =
                    "bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/30";
                } else if (type === "alert") {
                  Icon = AlertTriangle;

                  iconWrapperClass =
                    "bg-rose-950/60 text-rose-400 border border-rose-800";
                }

                return (
                  <Card
                    key={alert.id}
                    className="rounded-2xl border-[#203131] bg-[#0F1719] transition-all hover:border-[#66C56A]/50"
                  >
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex gap-4">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconWrapperClass}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <h3 className="text-sm font-bold text-[#F5F7F6]">
                                {alert.notification_type ||
                                  "Notification"}
                              </h3>

                              <p className="mt-1 text-xs leading-relaxed text-[#B8C4C2]">
                                {alert.message ||
                                  "No notification message."}
                              </p>
                            </div>

                            <span className="shrink-0 text-xs text-[#81918E]">
                              {formatTime(
                                alert.created_at
                              )}
                            </span>
                          </div>

                          {/* Delivery Details */}

                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1 rounded-lg border border-[#203131] bg-[#101C1C] px-2.5 py-1 text-xs text-[#B8C4C2]">
                              <Bell className="h-3.5 w-3.5" />

                              {getChannelLabel(
                                alert.channel
                              )}
                            </span>

                            <span className="inline-flex items-center gap-1 rounded-lg border border-[#2E7D32]/30 bg-[#101C1C] px-2.5 py-1 text-xs text-[#66C56A]">
                              <CheckCircle2 className="h-3.5 w-3.5" />

                              {getDeliveryStatus(
                                alert.delivery_status
                              )}
                            </span>

                            {alert.sent_at && (
                              <span className="inline-flex items-center gap-1 rounded-lg border border-[#203131] bg-[#101C1C] px-2.5 py-1 text-xs text-[#81918E]">
                                <Clock className="h-3.5 w-3.5" />

                                Sent{" "}
                                {formatTime(
                                  alert.sent_at
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
}