"use client";

import React from "react";
import { ServiceCenter } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Phone,
  Navigation,
  Globe,
  Star,
  X,
  Wrench,
  CheckCircle,
} from "lucide-react";

interface ServiceCenterDetailCardProps {
  center: ServiceCenter | null;
  userCoords?: { lat: number; lng: number } | null;
  routeDistance?: string | null;
  routeDuration?: string | null;
  onClose?: () => void;
}

export function ServiceCenterDetailCard({
  center,
  userCoords,
  routeDistance,
  routeDuration,
  onClose,
}: ServiceCenterDetailCardProps) {
  if (!center) return null;

  const displayName = center.name && center.name.trim() !== ""
    ? center.name
    : "Automotive Service Center";

  // Build formatted address
  const addressParts = [center.address, center.city, center.postcode].filter(
    (part): part is string => Boolean(part && part.trim() !== "")
  );
  const formattedAddress = addressParts.length > 0 ? addressParts.join(", ") : null;

  // Directions anchored to user's actual current location
  const directionsUrl = userCoords
    ? `https://www.google.com/maps/dir/?api=1&origin=${userCoords.lat},${userCoords.lng}&destination=${center.latitude},${center.longitude}`
    : center.directions_url ||
      `https://www.google.com/maps/dir/?api=1&destination=${center.latitude},${center.longitude}`;

  return (
    <Card className="border-[#2E7D32]/50 bg-card text-card-foreground rounded-2xl shadow-xl transition-all animate-in fade-in duration-200">
      <CardHeader className="pb-3 border-b border-border flex flex-row items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-[#66C56A] border border-[#2E7D32]/40 shrink-0 mt-0.5">
            <Wrench className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#66C56A] bg-secondary px-2 py-0.5 rounded-md border border-[#2E7D32]/30">
                Selected Workshop
              </span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-[#9BE39A] bg-secondary px-2 py-0.5 rounded-md border border-border">
                {center.distance_km != null
                  ? `${center.distance_km.toFixed(1)} km away`
                  : "Nearby"}
              </span>
            </div>
            <CardTitle className="text-base sm:text-lg font-bold text-foreground mt-1 truncate">
              {displayName}
            </CardTitle>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-secondary transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4 text-xs sm:text-sm">
        {/* Rating and Distance Row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Rating */}
          <div className="rounded-xl border border-border bg-secondary/70 p-3">
            <span className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
              Google / OSM Rating
            </span>
            {center.rating !== null && center.rating !== undefined ? (
              <div className="flex items-center gap-1.5 text-[#D9A441] font-bold text-sm">
                <Star className="h-4 w-4 fill-[#D9A441]" />
                <span>{Number(center.rating).toFixed(1)} / 5.0</span>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground italic font-medium">
                Not available
              </div>
            )}
          </div>

          {/* Distance */}
          <div className="rounded-xl border border-border bg-secondary/70 p-3">
            <span className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
              Driving Distance
            </span>
            <div className="flex items-center gap-1.5 text-[#66C56A] font-bold text-sm">
              <Navigation className="h-4 w-4 shrink-0" />
              <span>
                {routeDistance && routeDuration
                  ? `${routeDistance} (${routeDuration})`
                  : center.distance_km != null
                  ? `${center.distance_km.toFixed(1)} km away`
                  : "Not available"}
              </span>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="rounded-xl border border-border bg-secondary/70 p-3">
          <span className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
            Physical Address
          </span>
          <div className="flex items-start gap-2 text-foreground">
            <MapPin className="h-4 w-4 text-[#66C56A] shrink-0 mt-0.5" />
            <span className="leading-snug">
              {formattedAddress || (
                <span className="text-muted-foreground italic">Not available in directory records</span>
              )}
            </span>
          </div>
        </div>

        {/* Contact Info (Phone & Website) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Phone */}
          <div className="rounded-xl border border-border bg-secondary/70 p-3 flex flex-col justify-between">
            <span className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
              Phone Contact
            </span>
            {center.phone && center.phone.trim() !== "" ? (
              <a
                href={`tel:${center.phone.replace(/[^+\d]/g, "")}`}
                className="inline-flex items-center gap-2 text-xs font-semibold text-[#66C56A] hover:underline"
              >
                <Phone className="h-3.5 w-3.5" />
                <span>{center.phone}</span>
              </a>
            ) : (
              <div className="text-xs text-muted-foreground italic font-medium flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 opacity-50" />
                <span>Not available</span>
              </div>
            )}
          </div>

          {/* Website */}
          <div className="rounded-xl border border-border bg-secondary/70 p-3 flex flex-col justify-between">
            <span className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
              Official Website
            </span>
            {center.website && center.website.trim() !== "" ? (
              <a
                href={center.website.startsWith("http") ? center.website : `https://${center.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#66C56A] hover:underline truncate"
              >
                <Globe className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Visit Website</span>
              </a>
            ) : (
              <div className="text-xs text-muted-foreground italic font-medium flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 opacity-50" />
                <span>Not available</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:flex-1"
          >
            <Button
              className="w-full rounded-xl font-bold bg-[#2E7D32] text-white hover:bg-[#256628] shadow-md hover:shadow-[#2E7D32]/25 transition-all h-10 px-4 text-xs sm:text-sm flex items-center justify-center gap-2"
            >
              <Navigation className="h-4 w-4" />
              <span>Get Driving Directions</span>
            </Button>
          </a>

          {center.phone && (
            <a
              href={`tel:${center.phone.replace(/[^+\d]/g, "")}`}
              className="w-full sm:w-auto"
            >
              <Button
                variant="outline"
                className="w-full sm:w-auto rounded-xl font-semibold border-border bg-secondary text-foreground hover:bg-muted hover:border-[#66C56A]/40 transition-all h-10 px-4 text-xs sm:text-sm flex items-center justify-center gap-2"
              >
                <Phone className="h-4 w-4 text-[#66C56A]" />
                <span>Call Center</span>
              </Button>
            </a>
          )}
        </div>

        {/* Realtime Data Notice */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
          <CheckCircle className="h-3.5 w-3.5 text-[#66C56A]" />
          <span>Real live data from OpenStreetMap directory &amp; cache</span>
        </div>
      </CardContent>
    </Card>
  );
}
