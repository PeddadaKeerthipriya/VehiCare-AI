"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Wrench,
  Plus,
  Calendar,
  IndianRupee,
  ArrowUpRight,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  fetchVehicles,
  createServiceRecord,
  getServiceRecords,
  getMaintenanceSchedules,
  createMaintenanceSchedule,
  createCustomInterval,
  getOEMIntervals,
  OEMInterval,
} from "@/lib/api";
import { Vehicle, MaintenanceSchedule, ServiceRecord } from "@/lib/types";
import { emitMaintenanceUpdate, subscribeToSyncEvents } from "@/lib/realtimeSync";
import { supabase } from "@/lib/supabase";
interface DisplayRecord {
  id: string;
  vehicle: string;
  service: string;
  date: string;
  sortDate: string;
  cost: string;
  shop: string;
  notes: string;
}

export default function MaintenancePage() {
  const [records, setRecords] = useState<DisplayRecord[]>([]);
  const [recordOrderIds, setRecordOrderIds] = useState<string[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [maintenanceSchedules, setMaintenanceSchedules] = useState<MaintenanceSchedule[]>([]);
  const [fifoScheduleIds, setFifoScheduleIds] = useState<string[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [schedulesError, setSchedulesError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<
  "fifo" | "due_date" | "due_odometer_km"
>("fifo");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [isIntervalEditorOpen, setIsIntervalEditorOpen] = useState(false);
  const [intervalType, setIntervalType] = useState("time");
  const [intervalComponent, setIntervalComponent] = useState("");
  const [intervalKm, setIntervalKm] = useState("");
  const [intervalMonths, setIntervalMonths] = useState("");
  const [intervalNotes, setIntervalNotes] = useState("");
  const [intervalSaving, setIntervalSaving] = useState(false);
  const [intervalError, setIntervalError] = useState<string | null>(null);
  const [intervalVehicleId, setIntervalVehicleId] = useState("");
  const [oemIntervals, setOemIntervals] = useState<OEMInterval[]>([]);
  const [, setLoadingIntervals] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form Fields
  const [vehicleId, setVehicleId] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [notes, setNotes] = useState("");

  // UI States
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState<{
    vehicleId?: string;
    serviceDate?: string;
    serviceType?: string;
  }>({});

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      setLoadingVehicles(true);
      setLoadingRecords(true);
      setLoadingSchedules(true);
      setLoadingIntervals(true);
      setVehiclesError(null);
      setRecordsError(null);
      setSchedulesError(null);

      try {
        const [vehiclesList, serviceRecords, schedules, intervals] = await Promise.all([
          fetchVehicles().catch((err: unknown) => {
            console.error("Failed to load vehicles for maintenance select:", err);
            const errMsg = err instanceof Error ? err.message : "Failed to load vehicles from database.";
            setVehiclesError(errMsg);
            return [] as Vehicle[];
          }),
          getServiceRecords().catch((err: unknown) => {
            console.error("Failed to load service records:", err);
            setRecordsError(err instanceof Error ? err.message : "Failed to load service records.");
            return [] as ServiceRecord[];
          }),
          getMaintenanceSchedules().catch((err: unknown) => {
            console.error("Failed to load maintenance schedules:", err);
            setSchedulesError(err instanceof Error ? err.message : "Failed to load maintenance schedules.");
            return [] as MaintenanceSchedule[];
          }),
          getOEMIntervals().catch((err) => {
            console.error("Failed to load OEM intervals:", err);
            return [] as OEMInterval[];
          }),
        ]);

        if (!active) return;

        setVehicles(vehiclesList);
        if (vehiclesList.length > 0) {
          setIntervalVehicleId((prev) => prev || vehiclesList[0].id);
        }

        const mappedRecords: DisplayRecord[] = serviceRecords.map((record) => {
          const vehicle = vehiclesList.find((v: Vehicle) => v.id === record.vehicle_id);
          return {
            id: record.id,
            vehicle: vehicle
              ? `${vehicle.make} ${vehicle.model} (${vehicle.year})`
              : "My Vehicle",
            service: record.service_type || "Service",
            date: record.service_date
              ? new Date(record.service_date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "2-digit",
                })
              : "—",
            sortDate: record.service_date || "",
            cost: "—",
            shop: "—",
            notes: record.notes || "",
          };
        });

        setRecords(mappedRecords);
        setRecordOrderIds(serviceRecords.map((record) => record.id));

        setMaintenanceSchedules(schedules);
        setFifoScheduleIds(schedules.map((schedule) => schedule.id));

        setOemIntervals(intervals);
      } finally {
        if (active) {
          setLoadingVehicles(false);
          setLoadingRecords(false);
          setLoadingSchedules(false);
          setLoadingIntervals(false);
        }
      }
    }

    loadInitialData();

    return () => {
      active = false;
    };
  }, []);
  // Supabase Realtime: refresh maintenance data when database changes
  useEffect(() => {
    if (vehicles.length === 0) return;

    const refreshServiceRecords = async () => {
      try {
        const serviceRecords = await getServiceRecords();

        const mappedRecords: DisplayRecord[] = serviceRecords.map(
          (record) => {
            const vehicle = vehicles.find(
              (v) => v.id === record.vehicle_id
            );

            return {
              id: record.id,
              vehicle: vehicle
                ? `${vehicle.make} ${vehicle.model} (${vehicle.year})`
                : "My Vehicle",
              service: record.service_type || "Service",
              date: record.service_date
  ? new Date(record.service_date).toLocaleDateString(
      "en-US",
      {
        year: "numeric",
        month: "long",
        day: "2-digit",
      }
    )
  : "—",
sortDate: record.service_date || "",
cost: "—",
              shop: "—",
              notes: record.notes || "",
            };
          }
        );

        setRecords(mappedRecords);
      } catch (error) {
        console.error(
          "Realtime refresh failed for service records:",
          error
        );
      }
    };

    const refreshMaintenanceSchedules = async () => {
  try {
    const schedules = await getMaintenanceSchedules();

    setMaintenanceSchedules(schedules);

    setFifoScheduleIds((previousIds) => {
      const currentIds = schedules.map((schedule) => schedule.id);

      const newIds = currentIds.filter(
        (id) => !previousIds.includes(id)
      );

      return [...newIds, ...previousIds.filter((id) => currentIds.includes(id))];
    });
  } catch (error) {
    console.error(
      "Realtime refresh failed for maintenance schedules:",
      error
    );
  }
};

    const channel = supabase
      .channel("maintenance-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "service_records",
        },
        () => {
          console.log(
            "[Realtime] service_records changed — refreshing UI"
          );
          refreshServiceRecords();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "maintenance_schedules",
        },
        () => {
          console.log(
            "[Realtime] maintenance_schedules changed — refreshing UI"
          );
          refreshMaintenanceSchedules();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "custom_intervals",
        },
        () => {
          console.log(
            "[Realtime] custom_intervals changed — refreshing UI"
          );
          refreshMaintenanceSchedules();
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
          console.log(
            "[Realtime] vehicles changed in maintenance — refreshing UI"
          );
          fetchVehicles().then((list) => {
            if (Array.isArray(list) && list.length > 0) {
              setVehicles(list);
            }
          }).catch(() => {});
          refreshMaintenanceSchedules();
          refreshServiceRecords();
        }
      )
      .subscribe((status) => {
        console.log("[Realtime] maintenance channel:", status);
      });

    const unsubscribeSync = subscribeToSyncEvents((payload) => {
      if (payload.type === "maintenance" || payload.type === "vehicle") {
        console.log("[RealtimeSync] maintenance page received sync event:", payload);
        refreshMaintenanceSchedules();
        refreshServiceRecords();
      }
    });

    return () => {
      unsubscribeSync();
      supabase.removeChannel(channel);
    };
  }, [vehicles]);
    const sortedSchedules = (() => {
  if (sortBy === "fifo") {
    return fifoScheduleIds
      .map((id) =>
        maintenanceSchedules.find(
          (schedule) => schedule.id === id
        )
      )
      .filter(
        (schedule): schedule is MaintenanceSchedule =>
          Boolean(schedule)
      );
  }

  const schedules = [...maintenanceSchedules];

  if (sortBy === "due_date") {
    schedules.sort((a, b) => {
      const dateA = a.due_date
        ? new Date(a.due_date).getTime()
        : Number.MIN_SAFE_INTEGER;

      const dateB = b.due_date
        ? new Date(b.due_date).getTime()
        : Number.MIN_SAFE_INTEGER;

      return dateB - dateA;
    });
  }

  if (sortBy === "due_odometer_km") {
    schedules.sort(
      (a, b) =>
        Number(b.due_odometer_km) -
        Number(a.due_odometer_km)
    );
  }

  return schedules;
})();
  const calendarYear = calendarDate.getFullYear();
const calendarMonth = calendarDate.getMonth();

const daysInMonth = new Date(
  calendarYear,
  calendarMonth + 1,
  0
).getDate();

const firstDayOfMonth = new Date(
  calendarYear,
  calendarMonth,
  1
).getDay();

const calendarDays = Array.from(
  { length: firstDayOfMonth + daysInMonth },
  (_, index) => {
    if (index < firstDayOfMonth) {
      return null;
    }

    return index - firstDayOfMonth + 1;
  }
);

const getSchedulesForDay = (day: number) => {
  return maintenanceSchedules.filter((schedule) => {
    if (!schedule.due_date) return false;

    const date = new Date(schedule.due_date);

    return (
      date.getFullYear() === calendarYear &&
      date.getMonth() === calendarMonth &&
      date.getDate() === day
    );
  });
};
  const validateForm = () => {
  const errors: typeof formErrors = {};

  if (!vehicleId) {
    errors.vehicleId = "Please select a vehicle.";
  }

  if (!serviceDate) {
    errors.serviceDate = "Please select a service date.";
  } else {
    const selectedDate = new Date(`${serviceDate}T00:00:00`);
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    if (selectedDate > today) {
      errors.serviceDate = "Service date cannot be in the future.";
    }
  }

  if (!serviceType.trim()) {
    errors.serviceType = "Service type is required.";
  }

  setFormErrors(errors);
  return Object.keys(errors).length === 0;
};

  const handleOpenModal = () => {
    setVehicleId("");
    setServiceDate("");
    setServiceType("");
    setNotes("");
    setSubmitError(null);
    setSubmitSuccess(false);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenIntervalModal = () => {
    setIntervalComponent("");
    setIntervalKm("");
    setIntervalMonths("");
    setIntervalNotes("");
    setIntervalError(null);
    if (vehicles.length > 0 && !intervalVehicleId) {
      setIntervalVehicleId(vehicles[0].id);
    }
    setIsIntervalEditorOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);

    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        vehicle_id: vehicleId,
        service_date: serviceDate,
        service_type: serviceType.trim(),
        notes: notes.trim(),
      };

      await createServiceRecord(payload);

      setSubmitSuccess(true);

      const serviceRecords = await getServiceRecords();

const mappedRecords: DisplayRecord[] = serviceRecords.map(
  (record) => {
    const vehicle = vehicles.find(
      (v) => v.id === record.vehicle_id
    );

    return {
      id: record.id,
      vehicle: vehicle
        ? `${vehicle.make} ${vehicle.model} (${vehicle.year})`
        : "My Vehicle",
      service: record.service_type || "Service",
      date: record.service_date
  ? new Date(record.service_date).toLocaleDateString(
      "en-US",
      {
        year: "numeric",
        month: "long",
        day: "2-digit",
      }
    )
  : "—",
sortDate: record.service_date || "",
cost: "—",
      shop: "—",
      notes: record.notes || "",
    };
  }
);

const newRecord = mappedRecords.find(
  (record) => !records.some((existing) => existing.id === record.id)
);

if (newRecord) {
  setRecords((previousRecords) => [
    newRecord,
    ...previousRecords.filter(
      (record) => record.id !== newRecord.id
    ),
  ]);

  setRecordOrderIds((previousIds) => [
    newRecord.id,
    ...previousIds.filter((id) => id !== newRecord.id),
  ]);
} else {
  setRecords(mappedRecords);
}

      setTimeout(() => {
        setIsModalOpen(false);
      }, 1500);
    } catch (err: unknown) {
      console.error("Error submitting service record:", err);
      const errMsg = err instanceof Error ? err.message : "Failed to submit service record to the backend.";
      setSubmitError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };
  const orderedRecords = (() => {
  const ordered = recordOrderIds
    .map((id) => records.find((record) => record.id === id))
    .filter(
      (record): record is DisplayRecord =>
        Boolean(record)
    );

  if (sortBy === "due_date") {
    return [...records].sort((a, b) => {
      const dateA = a.sortDate
        ? new Date(a.sortDate).getTime()
        : Number.MIN_SAFE_INTEGER;

      const dateB = b.sortDate
        ? new Date(b.sortDate).getTime()
        : Number.MIN_SAFE_INTEGER;

      return dateB - dateA;
    });
  }

  return ordered;
})();
  return (
    <div className="space-y-6">
      {/* Title & Actions Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F7F6]">
            Maintenance Logs
          </h1>
          <p className="text-sm text-[#81918E]">
            Keep track of past services, parts replaced, and invoices
          </p>
        </div>

        <Button
          onClick={handleOpenModal}
          className="w-full rounded-xl bg-[#2E7D32] text-white hover:bg-[#256628] sm:w-auto shadow-xs"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Record
        </Button>
      </div>
    {/* Maintenance List Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-[#F5F7F6]">
            Upcoming Maintenance
          </h2>
          <p className="text-xs text-[#81918E]">
            Sort scheduled maintenance by due date or mileage.
          </p>
        </div>
        <div className="flex items-center gap-2">
  <Button
    type="button"
    size="sm"
    onClick={() => setViewMode("list")}
    className={`rounded-xl text-xs font-semibold ${
      viewMode === "list"
        ? "bg-[#2E7D32] text-white"
        : "bg-[#101C1C] text-[#B8C4C2] border border-[#203131]"
    }`}
  >
    List
  </Button>

  <Button
    type="button"
    size="sm"
    onClick={() => setViewMode("calendar")}
    className={`rounded-xl text-xs font-semibold ${
      viewMode === "calendar"
        ? "bg-[#2E7D32] text-white"
        : "bg-[#101C1C] text-[#B8C4C2] border border-[#203131]"
    }`}
    >
      Calendar
     </Button>
     <Button
        type="button"
        size="sm"
        onClick={handleOpenIntervalModal}
        className="rounded-xl bg-[#101C1C] text-[#B8C4C2] border border-[#203131] text-xs font-semibold hover:bg-[#132020] hover:text-[#F5F7F6]"
      >
        Custom Interval
      </Button>
    </div>
        <select
          value={sortBy}
          onChange={(e) =>
  setSortBy(
    e.target.value as
      | "fifo"
      | "due_date"
      | "due_odometer_km"
  )
}
          className="w-full sm:w-auto rounded-xl border border-[#203131] bg-[#101C1C] px-3 py-2 text-xs font-semibold text-[#F5F7F6] outline-none focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
        >
          <option value="fifo">Default Order</option>
          <option value="due_date">Sort by Due Date</option>
          <option value="due_odometer_km">Sort by Mileage</option>
        </select>
      </div>
      {/* Upcoming Maintenance */}
{viewMode === "list" ? (
  <div className="space-y-4">
    {loadingSchedules ? (
      <Card className="border-[#203131] bg-[#0B1515]">
        <CardContent className="flex items-center justify-center gap-2 py-10 text-xs text-[#81918E]">
          <Loader2 className="h-4 w-4 animate-spin text-[#66C56A]" />
          Loading maintenance schedules...
        </CardContent>
      </Card>
    ) : schedulesError ? (
      <Card className="border-rose-900 bg-rose-950/30">
        <CardContent className="flex items-center gap-2 py-4 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          {schedulesError}
        </CardContent>
      </Card>
    ) : sortedSchedules.length === 0 ? (
      <Card className="border-[#203131] bg-[#0B1515]">
        <CardContent className="py-10 text-center text-xs text-[#81918E]">
          No upcoming maintenance schedules found.
        </CardContent>
      </Card>
    ) : (
      sortedSchedules.map((schedule) => {
        const scheduleVehicle = vehicles.find(
          (vehicle) => vehicle.id === schedule.vehicle_id
        );

        const normalizedStatus = (schedule.status || "pending").toLowerCase();

        return (
          <Card
            key={schedule.id}
            className="border-[#203131] bg-[#0B1515] transition-all hover:border-[#66C56A]/50"
          >
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/30">
                  <Wrench className="h-5 w-5" />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-[#F5F7F6] sm:text-base">
                    {schedule.task_name}
                  </h3>

                  <p className="mt-0.5 text-xs font-semibold text-[#81918E]">
                    {scheduleVehicle
                      ? `${scheduleVehicle.make} ${scheduleVehicle.model} (${scheduleVehicle.year})`
                      : "Vehicle"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {schedule.due_date && (
                  <div className="flex items-center gap-1.5 rounded-xl bg-[#101C1C] border border-[#203131] px-3 py-1.5 text-[#B8C4C2]">
                    <Calendar className="h-3.5 w-3.5 text-[#66C56A]" />
                    {new Date(schedule.due_date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                )}

                <div className="rounded-xl bg-[#101C1C] border border-[#203131] px-3 py-1.5 text-[#B8C4C2]">
                  {Number(schedule.due_odometer_km).toLocaleString()} km
                </div>

                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold capitalize border ${
                    normalizedStatus === "completed"
                      ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                      : normalizedStatus === "overdue"
                      ? "bg-rose-950/60 border-rose-800 text-rose-300"
                      : normalizedStatus === "due soon"
                      ? "bg-amber-950/60 border-amber-800 text-amber-300"
                      : "bg-blue-950/60 border-blue-800 text-blue-300"
                  }`}
                >
                  {schedule.status || "Pending"}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })
    )}
  </div>
) : (
  <div className="rounded-2xl border border-[#203131] bg-[#0B1515] p-4">
    {/* Calendar Header */}
    <div className="flex items-center justify-between mb-4">
      <button
        type="button"
        onClick={() =>
          setCalendarDate(
            new Date(calendarYear, calendarMonth - 1, 1)
          )
        }
        className="rounded-lg border border-[#203131] bg-[#101C1C] px-3 py-1.5 text-xs text-[#B8C4C2] hover:bg-[#132020]"
      >
        Previous
      </button>

      <h3 className="text-sm font-bold text-[#F5F7F6]">
        {calendarDate.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })}
      </h3>

      <button
        type="button"
        onClick={() =>
          setCalendarDate(
            new Date(calendarYear, calendarMonth + 1, 1)
          )
        }
        className="rounded-lg border border-[#203131] bg-[#101C1C] px-3 py-1.5 text-xs text-[#B8C4C2] hover:bg-[#132020]"
      >
        Next
      </button>
    </div>

    {/* Week Days */}
    <div className="grid grid-cols-7 mb-2">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
        <div
          key={day}
          className="py-2 text-center text-[10px] font-bold uppercase text-[#81918E]"
        >
          {day}
        </div>
      ))}
    </div>

    {/* Calendar Grid */}
    <div className="grid grid-cols-7 gap-1">
      {calendarDays.map((day, index) => {
        if (day === null) {
          return (
            <div
              key={`empty-${index}`}
              className="min-h-[72px] rounded-lg border border-transparent"
            />
          );
        }

        const daySchedules = getSchedulesForDay(day);

        return (
          <div
            key={day}
            className="min-h-[72px] rounded-lg border border-[#203131] bg-[#101C1C] p-2"
          >
            <div className="text-xs font-semibold text-[#F5F7F6]">
              {day}
            </div>

            {daySchedules.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {daySchedules.map((schedule) => {
                  const normalizedStatus = (
                    schedule.status || "pending"
                  ).toLowerCase();

                  const dotColor =
                    normalizedStatus === "overdue"
                      ? "bg-red-500"
                      : normalizedStatus === "due soon"
                      ? "bg-amber-400"
                      : "bg-blue-500";

                  return (
                    <span
                      key={schedule.id}
                      title={schedule.task_name}
                      className={`h-2.5 w-2.5 rounded-full ${dotColor}`}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>

    {/* Calendar Legend */}
    <div className="mt-4 flex flex-wrap gap-4 text-[10px] text-[#81918E]">
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
        Overdue
      </div>

      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        Due Soon
      </div>

      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
        Scheduled
      </div>
    </div>
  </div>
)}
      {/* Service Logs List */}
<div className="space-y-4">
  {loadingRecords ? (
    <Card className="border-[#203131] bg-[#0B1515]">
      <CardContent className="flex items-center justify-center gap-2 py-10 text-xs text-[#81918E]">
        <Loader2 className="h-4 w-4 animate-spin text-[#66C56A]" />
        Loading service records...
      </CardContent>
    </Card>
  ) : recordsError ? (
    <Card className="border-rose-900 bg-rose-950/30">
      <CardContent className="flex items-center gap-2 py-4 text-xs text-rose-300">
        <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
        {recordsError}
      </CardContent>
    </Card>
  ) : records.length === 0 ? (
    <Card className="border-[#203131] bg-[#0B1515]">
      <CardContent className="py-10 text-center text-xs text-[#81918E]">
        No service records found.
      </CardContent>
    </Card>
  ) : (
    orderedRecords.map((record) => (
      
          <Card
            key={record.id}
            className="border-[#203131] bg-[#0B1515] transition-all hover:border-[#66C56A]/50 hover:shadow-xs group"
          >
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-4">
                {/* Service Icon Box */}
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/30 group-hover:bg-[#163D23] transition-colors">
                  <Wrench className="h-5 w-5" />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-[#F5F7F6] sm:text-base">
                    {record.service}
                  </h3>
                  <p className="mt-0.5 text-xs font-semibold text-[#81918E]">
                    {record.vehicle}
                  </p>
                  <p className="mt-1.5 line-clamp-1 text-xs text-[#B8C4C2]">
                    {record.notes}
                  </p>
                </div>
              </div>
              {/* Service Metadata block */}
            <div className="flex flex-wrap items-center gap-2.5 border-t border-[#203131] pt-3 text-xs sm:justify-end sm:border-0 sm:pt-0 sm:text-right">
            <div className="flex items-center gap-1.5 rounded-xl bg-[#101C1C] border border-[#203131] px-3 py-1.5 text-[#B8C4C2]">
         <Calendar className="h-3.5 w-3.5 text-[#66C56A]" />
      <span className="font-medium">
        {record.date}
      </span>
    </div>

    <div className="flex items-center gap-1 rounded-xl bg-[#101C1C] border border-[#203131] px-3 py-1.5">
       <IndianRupee className="h-3.5 w-3.5 text-[#66C56A]" />
       <span className="font-bold text-[#66C56A]">
         {record.cost}
       </span>
    </div>

  <button className="hidden rounded-xl border border-[#203131] p-2 transition-colors hover:bg-[#101C1C] hover:border-[#2E7D32]/50 sm:flex">
    <ArrowUpRight className="h-4 w-4 text-[#66C56A]" />
  </button>
</div>
        </CardContent>
      </Card>
        ))
  )}
  </div>
      {/* Add Record Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md space-y-4 rounded-2xl border border-[#203131] bg-[#0B1515] p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 rounded-xl p-1 text-[#81918E] transition-colors hover:bg-[#132020] hover:text-[#F5F7F6]"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <h2 className="text-xl font-bold text-[#F5F7F6]">
                Add Service Record
              </h2>
              <p className="mt-0.5 text-xs text-[#81918E]">
                Log a maintenance service for your vehicle
              </p>
            </div>

            {submitSuccess && (
              <div className="flex items-center gap-2 rounded-xl border border-[#2E7D32]/40 bg-[#101C1C] p-3 text-sm text-[#66C56A]">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>Service record added successfully!</span>
              </div>
            )}

            {submitError && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-900 bg-rose-950/40 p-3 text-sm text-rose-300">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
                <span className="break-all">{submitError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Vehicle Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                  Select Vehicle *
                </label>

                <select
                  disabled={loadingVehicles || submitting}
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  className={`h-10 w-full rounded-xl border bg-[#101C1C] px-3 text-sm text-[#F5F7F6] outline-none transition-all focus:bg-[#132020] ${
                    formErrors.vehicleId
                      ? "border-rose-500 focus:ring-1 focus:ring-rose-500"
                      : "border-[#203131] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                  }`}
                >
                  <option value="">-- Choose a Vehicle --</option>

                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_type === "Bike" ? "[Bike] " : "[Car] "}
                      {v.make} {v.model} ({v.year})
                    </option>
                  ))}
                </select>

                {vehiclesError && (
                  <p className="mt-1 text-xs text-rose-400">
                    {vehiclesError}
                  </p>
                )}

                {formErrors.vehicleId && (
                  <p className="mt-1 text-xs text-rose-400">
                    {formErrors.vehicleId}
                  </p>
                )}
              </div>

              {/* Service Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                  Service Date *
                </label>

                <input
                 type="date"
                 disabled={submitting}
                 value={serviceDate}
                 max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setServiceDate(e.target.value)}
                  className={`h-10 w-full rounded-xl border bg-[#101C1C] px-3 text-sm text-[#F5F7F6] outline-none transition-all focus:bg-[#132020] ${
                    formErrors.serviceDate
                      ? "border-rose-500 focus:ring-1 focus:ring-rose-500"
                      : "border-[#203131] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                  }`}
                />

                {formErrors.serviceDate && (
                  <p className="mt-1 text-xs text-rose-400">
                    {formErrors.serviceDate}
                  </p>
                )}
              </div>

              {/* Service Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                  Service Type *
                </label>

                <input
                  type="text"
                  placeholder="e.g. Oil Change, Brake Service"
                  disabled={submitting}
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className={`h-10 w-full rounded-xl border bg-[#101C1C] px-3 text-sm text-[#F5F7F6] placeholder:text-[#81918E] outline-none transition-all focus:bg-[#132020] ${
                    formErrors.serviceType
                      ? "border-rose-500 focus:ring-1 focus:ring-rose-500"
                      : "border-[#203131] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                  }`}
                />

                {formErrors.serviceType && (
                  <p className="mt-1 text-xs text-rose-400">
                    {formErrors.serviceType}
                  </p>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                  Notes
                </label>

                <textarea
                  placeholder="Describe the service details..."
                  rows={3}
                  disabled={submitting}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-[#203131] bg-[#101C1C] p-3 text-sm text-[#F5F7F6] placeholder:text-[#81918E] outline-none transition-all focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                />
              </div>
              {intervalError && (
  <p className="text-xs text-rose-400">
    {intervalError}
  </p>
)}
              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => setIsModalOpen(false)}
                  className="h-10 flex-1 rounded-xl border-[#203131] bg-[#132020] text-[#F5F7F6]"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#2E7D32] text-white hover:bg-[#256628]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Record"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Interval Editor Modal */}
      {isIntervalEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl text-card-foreground">
            <button
              type="button"
              disabled={intervalSaving}
              onClick={() => {
                if (!intervalSaving) {
                  setIsIntervalEditorOpen(false);
                  setIntervalError(null);
                }
              }}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl bg-secondary text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>

            <div>
              <h2 className="text-xl font-bold text-foreground">
                Custom Maintenance Interval
              </h2>

              <p className="mt-1 text-xs text-muted-foreground">
                Configure a custom maintenance interval for your vehicle.
              </p>
            </div>

            {intervalError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{intervalError}</span>
              </div>
            )}

            <div className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Vehicle
                </label>
                <select
                  value={intervalVehicleId || (vehicles[0]?.id ?? "")}
                  onChange={(e) => setIntervalVehicleId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-[#66C56A]"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_type === "Bike" ? "[Bike] " : "[Car] "}
                      {v.make} {v.model} ({v.year}){v.vin ? ` - ${v.vin.slice(-6)}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Component
                </label>

                <input
                  type="text"
                  list="component-suggestions"
                  value={intervalComponent}
                  onChange={(e) => setIntervalComponent(e.target.value)}
                  placeholder="e.g. Engine Oil, Brake Pads, Air Filter"
                  className="w-full rounded-xl border border-border bg-secondary h-10 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#66C56A]"
                />
                <datalist id="component-suggestions">
                  <option value="Engine Oil & Filter" />
                  <option value="Brake Pads" />
                  <option value="Brake Fluid" />
                  <option value="Cabin Air Filter" />
                  <option value="Engine Air Filter" />
                  <option value="Tire Rotation" />
                  <option value="Spark Plugs" />
                  <option value="Coolant Flush" />
                  <option value="Transmission Fluid" />
                  {oemIntervals.map((o) => (
                    <option key={o.id} value={o.component} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Interval Type
                </label>

                <select
                  value={intervalType}
                  onChange={(e) => setIntervalType(e.target.value)}
                  className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-[#66C56A]"
                >
                  <option value="time">Time Based</option>
                  <option value="mileage">Mileage Based</option>
                  <option value="both">Time + Mileage</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Interval Kilometers
                </label>

                <input
                  type="number"
                  min="1"
                  value={intervalKm}
                  onChange={(e) => setIntervalKm(e.target.value)}
                  placeholder="e.g. 10000"
                  className="w-full rounded-xl border border-border bg-secondary h-10 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#66C56A]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Interval Months
                </label>

                <input
                  type="number"
                  min="1"
                  value={intervalMonths}
                  onChange={(e) => setIntervalMonths(e.target.value)}
                  placeholder="e.g. 6"
                  className="w-full rounded-xl border border-border bg-secondary h-10 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#66C56A]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Notes
                </label>

                <textarea
                  rows={3}
                  value={intervalNotes}
                  onChange={(e) => setIntervalNotes(e.target.value)}
                  placeholder="Optional notes..."
                  className="w-full rounded-xl border border-border bg-secondary p-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#66C56A]"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsIntervalEditorOpen(false)}
                className="flex-1 rounded-xl h-10 border-border bg-secondary text-foreground hover:bg-muted"
              >
                Cancel
              </Button>

              <Button
                type="button"
                disabled={intervalSaving}
                onClick={async () => {
                  const targetVehicleId = intervalVehicleId || vehicles[0]?.id;
                  if (!targetVehicleId) {
                    setIntervalError("Please select a vehicle.");
                    return;
                  }

                  if (!intervalComponent.trim()) {
                    setIntervalError("Please enter or select a component.");
                    return;
                  }

                  if (!intervalKm || Number(intervalKm) <= 0) {
                    setIntervalError("Please enter valid interval kilometers.");
                    return;
                  }

                  if (!intervalMonths || Number(intervalMonths) <= 0) {
                    setIntervalError("Please enter valid interval months.");
                    return;
                  }

                  try {
                    setIntervalSaving(true);
                    setIntervalError(null);

                    // 1. Create custom interval record
                    await createCustomInterval({
                      vehicle_id: targetVehicleId,
                      component: intervalComponent.trim(),
                      interval_km: Number(intervalKm),
                      interval_months: Number(intervalMonths),
                      notes: intervalNotes.trim() || null,
                    });

                    // 2. Compute due date and due odometer reading
                    const selectedVehicle = vehicles.find((v) => v.id === targetVehicleId);
                    const currentKm = Number(selectedVehicle?.odometer_km) || 0;
                    const dueKm = currentKm + Number(intervalKm);
                    const dueDate = new Date();
                    dueDate.setMonth(dueDate.getMonth() + Number(intervalMonths));
                    const dueDateStr = dueDate.toISOString().split("T")[0];

                    // 3. Create upcoming maintenance schedule so it appears in Upcoming Maintenance immediately
                    await createMaintenanceSchedule({
                      vehicle_id: targetVehicleId,
                      task_name: intervalComponent.trim(),
                      due_date: dueDateStr,
                      due_odometer_km: dueKm,
                      status: "pending",
                    }).catch((schedErr) => {
                      console.warn("Could not create immediate maintenance schedule entry:", schedErr);
                    });

                    emitMaintenanceUpdate(targetVehicleId);

                    // 4. Refresh maintenance schedules so upcoming maintenance section updates
                    const refreshedSchedules = await getMaintenanceSchedules().catch(() => []);
                    if (refreshedSchedules.length > 0) {
                      setMaintenanceSchedules(refreshedSchedules);
                      setFifoScheduleIds(refreshedSchedules.map((s) => s.id));
                    }

                    // 5. Refresh service records as well
                    const refreshedRecords = await getServiceRecords().catch(() => []);
                    if (refreshedRecords.length > 0) {
                      const mappedRecords: DisplayRecord[] = refreshedRecords.map((record) => {
                        const vehicle = vehicles.find((v) => v.id === record.vehicle_id);
                        return {
                          id: record.id,
                          vehicle: vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.year})` : "My Vehicle",
                          service: record.service_type || "Service",
                          date: record.service_date
                            ? new Date(record.service_date).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "2-digit",
                              })
                            : "—",
                          sortDate: record.service_date || "",
                          cost: "—",
                          shop: "—",
                          notes: record.notes || "",
                        };
                      });
                      setRecords(mappedRecords);
                      setRecordOrderIds(refreshedRecords.map((r) => r.id));
                    }

                    setIntervalComponent("");
                    setIntervalKm("");
                    setIntervalMonths("");
                    setIntervalNotes("");
                    setIntervalType("time");

                    setIsIntervalEditorOpen(false);
                  } catch (error) {
                    console.error("Failed to save maintenance interval:", error);

                    setIntervalError(
                      error instanceof Error
                        ? error.message
                        : "Failed to save maintenance interval."
                    );
                  } finally {
                    setIntervalSaving(false);
                  }
                }}
                className="flex-1 rounded-xl h-10 bg-[#2E7D32] text-white hover:bg-[#256628]"
              >
                {intervalSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Interval"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}