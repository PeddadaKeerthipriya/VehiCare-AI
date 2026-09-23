"use client";

import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Settings, Fuel, Zap, AlertCircle, RefreshCw, Car, Bike } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Loading } from "@/components/common/Loading";
import { Vehicle } from "@/lib/types";
import { fetchVehicles as getVehiclesFromApi } from "@/lib/api";
import { subscribeToSyncEvents } from "@/lib/realtimeSync";

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVehicles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getVehiclesFromApi();
      setVehicles(data);
    } catch (err: unknown) {
      console.error("Error fetching vehicles:", err);
      const errMsg = err instanceof Error ? err.message : "Unable to connect to the database. Please verify your connection.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();

    const unsubscribe = subscribeToSyncEvents((payload) => {
      if (payload.type === "vehicle") {
        fetchVehicles();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const getVehicleImage = (make: string) => {
    const m = make?.toLowerCase() || "";
    if (m.includes("maruti") || m.includes("swift") || m.includes("toyota")) return "/vehicles/camry.png";
    if (m.includes("nexon") || m.includes("tesla") || m.includes("ev")) return "/vehicles/modely.png";
    if (m.includes("mahindra") || m.includes("xuv") || m.includes("harrier") || m.includes("tata") || m.includes("ford")) return "/vehicles/f150.png";
    return "/vehicles/camry.png";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#F5F7F6]">My Garage</h1>
            <p className="text-sm text-[#81918E]">Loading your fleet...</p>
          </div>
        </div>
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F7F6]">My Garage</h1>
          <p className="text-sm text-[#81918E]">Manage your fleet</p>
        </div>

        <Card className="border-rose-900 bg-rose-950/40">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center space-y-4">
            <div className="rounded-full bg-rose-900/60 p-3 text-rose-400">
              <AlertCircle className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold text-rose-200">
                Failed to load vehicles
              </CardTitle>
              <CardDescription className="max-w-md text-sm text-rose-400">
                {error}
              </CardDescription>
            </div>
            <Button
              onClick={fetchVehicles}
              className="rounded-xl bg-rose-600 text-white hover:bg-rose-700 shadow-xs"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Connection
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title & Actions Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F7F6]">My Garage</h1>
          <p className="text-sm text-[#81918E]">
            Manage your fleet and track maintenance status
          </p>
        </div>

        <Link href="/vehicles/add" className="w-full sm:w-auto">
          <Button className="w-full rounded-xl bg-[#2E7D32] text-white hover:bg-[#256628] shadow-xs">
            <Plus className="mr-2 h-4 w-4" />
            Add Vehicle
          </Button>
        </Link>
      </div>

      {/* Empty State */}
      {vehicles.length === 0 ? (
        <Card className="border-2 border-dashed border-[#203131] bg-[#0B1515]">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <div className="rounded-full bg-[#101C1C] p-4 text-[#66C56A] border border-[#2E7D32]/40">
              <Car className="h-10 w-10" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold text-[#F5F7F6]">
                No vehicles in your garage
              </CardTitle>
              <CardDescription className="max-w-sm text-[#81918E]">
                Add your first vehicle to start tracking fuel logs, maintenance schedules, and active reminders.
              </CardDescription>
            </div>
            <Link href="/vehicles/add">
              <Button className="rounded-xl bg-[#2E7D32] text-white hover:bg-[#256628] shadow-xs">
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Vehicle
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        /* Vehicles Grid */
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {vehicles.map((v) => (
            <Link key={v.id} href={`/vehicles/${v.id}`}>
              <Card className="overflow-hidden border-[#203131] hover:border-[#66C56A]/50 transition-all bg-[#0B1515] cursor-pointer h-full flex flex-col justify-between group">
                <div>
                  {/* Status Indicator banner */}
                  <div className="h-1.5 w-full bg-[#2E7D32]"></div>

                  <CardHeader className="flex flex-row items-start justify-between pb-3 gap-3">
                    <div className="relative w-16 h-12 rounded-xl overflow-hidden bg-[#101C1C] border border-[#203131] shrink-0 flex items-center justify-center">
                      {v.vehicle_type === "Bike" ? (
                        <Bike className="h-7 w-7 text-[#66C56A]" />
                      ) : (
                        <Image
                          src={getVehicleImage(v.make)}
                          alt={`${v.make} ${v.model}`}
                          fill
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/40 flex items-center gap-1">
                          {v.vehicle_type === "Bike" ? (
                            <>
                              <Bike className="h-2.5 w-2.5" /> Bike
                            </>
                          ) : (
                            <>
                              <Car className="h-2.5 w-2.5" /> Car
                            </>
                          )}
                        </span>
                        <p className="text-xs text-[#81918E] truncate">
                          {v.nickname || `${v.make} ${v.model}`}
                        </p>
                      </div>
                      <CardTitle className="text-sm font-bold text-[#F5F7F6] truncate">
                        {v.year} {v.make} {v.model}
                      </CardTitle>
                      <CardDescription className="mt-0.5 text-[10px] uppercase tracking-wider font-semibold text-[#81918E] truncate">
                        VIN: {v.vin}
                      </CardDescription>
                    </div>

                    <div className="rounded-xl bg-[#101C1C] p-2 text-[#66C56A] border border-[#2E7D32]/30 transition-colors group-hover:bg-[#163D23] shrink-0">
                      <Settings className="h-4 w-4" />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-[#101C1C] border border-[#203131] p-2.5">
                        <span className="mb-0.5 block text-[#81918E] text-[11px]">Odometer</span>
                        <span className="font-bold text-[#F5F7F6]">
                          {Number(v.odometer_km).toLocaleString()} km
                        </span>
                      </div>

                      <div className="rounded-xl bg-[#101C1C] border border-[#203131] p-2.5">
                        <span className="mb-0.5 block text-[#81918E] text-[11px]">Fuel</span>
                        <span className="flex items-center gap-1 font-bold text-[#F5F7F6] capitalize">
                          {v.make.toLowerCase() === "tesla" || v.model.toLowerCase().includes("ev") || v.make.toLowerCase().includes("nexon") ? (
                            <>
                              <Zap className="h-3.5 w-3.5 text-[#66C56A]" />
                              Electric
                            </>
                          ) : (
                            <>
                              <Fuel className="h-3.5 w-3.5 text-[#66C56A]" />
                              Gasoline
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </div>

                <div className="vehicle-card-footer border-t border-[#203131] px-5 py-3 bg-[#101C1C]/50 text-center text-xs font-semibold text-[#66C56A] group-hover:bg-[#101C1C]/40 transition-colors">
                  View Garage Details →
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}