"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { ServiceCenter } from "@/lib/types";
import { getNearbyServiceCenters } from "@/lib/api";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import { ServiceCenterDetailCard } from "./ServiceCenterDetailCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  List,
  Map as MapIcon,
  Navigation,
  RefreshCw,
  AlertCircle,
  Wrench,
  Search,
  Star,
  LocateFixed,
} from "lucide-react";

const RADIUS_OPTIONS = [
  { label: "5 km", value: 5000 },
  { label: "10 km", value: 10000 },
  { label: "25 km", value: 25000 },
];

export function FindServiceCenter() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [coordsAccuracy, setCoordsAccuracy] = useState<number | null>(null);
  const [locating, setLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [radius, setRadius] = useState<number>(5000);
  const [centers, setCenters] = useState<ServiceCenter[]>([]);
  const [loadingCenters, setLoadingCenters] = useState<boolean>(false);
  const [centersError, setCentersError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const [selectedCenter, setSelectedCenter] = useState<ServiceCenter | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [mapError, setMapError] = useState<string | null>(null);
  const [routeDistance, setRouteDistance] = useState<string | null>(null);
  const [routeDuration, setRouteDuration] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const directionsServiceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const directionsRendererRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fallbackPolylineRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const infoWindowRef = useRef<any>(null);

  // In-flight request cancellation and sequence tracking refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<number>(0);
  const inFlightParamsRef = useRef<{ lat: number; lng: number; radius: number } | null>(null);

  // Clean up any pending in-flight request when component unmounts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Fetch centers from backend API for the exact coordinates and radius
  const fetchCenters = useCallback(
    async (lat: number, lng: number, searchRadius: number) => {
      // Prevent duplicate concurrent requests for identical coordinates and radius
      if (
        inFlightParamsRef.current &&
        inFlightParamsRef.current.lat === lat &&
        inFlightParamsRef.current.lng === lng &&
        inFlightParamsRef.current.radius === searchRadius
      ) {
        return;
      }

      // 1. Abort any previous in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      inFlightParamsRef.current = { lat, lng, radius: searchRadius };

      // 2. Increment request ID to ignore stale responses from superseded requests
      const currentRequestId = ++requestIdRef.current;

      // 3. Immediately clear stale results, selection, and errors so old radius data is never shown
      setLoadingCenters(true);
      setCentersError(null);
      setCenters([]);
      setSelectedCenter(null);
      setRouteDistance(null);
      setRouteDuration(null);

      try {
        const response = await getNearbyServiceCenters(lat, lng, searchRadius, {
          bypassCache: true,
          signal: controller.signal,
        });

        // If a newer request was triggered while this request was in flight, discard this response
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        const list = Array.isArray(response.service_centers)
          ? response.service_centers
          : [];

        setCenters(list);
        setHasSearched(true);

        // Auto-select first center in new radius result set if available
        if (list.length > 0) {
          setSelectedCenter(list[0]);
        } else {
          setSelectedCenter(null);
        }
      } catch (err: unknown) {
        // If superseded by a newer request, ignore completely
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        const error = err as Error;
        if (error.name === "AbortError") {
          // Request was cancelled by a newer radius selection; do not set error state
          return;
        }

        console.error("Failed to fetch nearby service centers:", error);
        setCentersError(
          error.message || "Failed to load service centers from backend."
        );
        setCenters([]);
        setSelectedCenter(null);
      } finally {
        if (currentRequestId === requestIdRef.current) {
          inFlightParamsRef.current = null;
          setLoadingCenters(false);
        }
      }
    },
    []
  );

  // Request browser geolocation with strict 0 cache and retry fallback
  const requestLocation = useCallback(
    (forceRefresh = false) => {
      if (typeof window === "undefined" || !navigator.geolocation) {
        setLocationError("Geolocation is not supported by your browser.");
        return;
      }

      setLocating(true);
      setLocationError(null);

      if (forceRefresh) {
        setSelectedCenter(null);
      }

      const onGeoSuccess = (position: GeolocationPosition) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        // Strict numeric validation
        if (
          typeof userLat !== "number" ||
          typeof userLng !== "number" ||
          isNaN(userLat) ||
          isNaN(userLng) ||
          userLat < -90 ||
          userLat > 90 ||
          userLng < -180 ||
          userLng > 180
        ) {
          setLocating(false);
          setLocationError("Received invalid coordinates from browser geolocation.");
          return;
        }

        setCoords({ lat: userLat, lng: userLng });
        setCoordsAccuracy(accuracy ? Math.round(accuracy) : null);
        setLocating(false);
        setLocationError(null);

        // Fetch centers for actual detected location
        fetchCenters(userLat, userLng, radius);
      };

      const onGeoError = (geoError: GeolocationPositionError) => {
        // If high accuracy GPS times out (e.g. desktop/laptop without hardware GPS),
        // try standard network/wifi triangulation once before giving up:
        if (geoError.code === geoError.TIMEOUT) {
          navigator.geolocation.getCurrentPosition(
            onGeoSuccess,
            (fallbackErr) => {
              setLocating(false);
              switch (fallbackErr.code) {
                case fallbackErr.PERMISSION_DENIED:
                  setLocationError(
                    "Location permission was denied. Please allow location access in your browser settings to find workshops near your actual location."
                  );
                  break;
                case fallbackErr.POSITION_UNAVAILABLE:
                  setLocationError(
                    "Location information is currently unavailable. Please verify device location settings."
                  );
                  break;
                case fallbackErr.TIMEOUT:
                  setLocationError(
                    "Location request timed out. Please click Locate Me again to retry."
                  );
                  break;
                default:
                  setLocationError("Unable to retrieve your location.");
                  break;
              }
            },
            {
              enableHighAccuracy: false,
              timeout: 8000,
              maximumAge: 0,
            }
          );
          return;
        }

        setLocating(false);
        switch (geoError.code) {
          case geoError.PERMISSION_DENIED:
            setLocationError(
              "Location permission was denied. Please allow location access in your browser settings to find workshops near your actual location."
            );
            break;
          case geoError.POSITION_UNAVAILABLE:
            setLocationError(
              "Location information is currently unavailable. Please verify device location settings."
            );
            break;
          case geoError.TIMEOUT:
            setLocationError(
              "Location request timed out. Please click Locate Me again to retry."
            );
            break;
          default:
            setLocationError("Unable to retrieve your location.");
            break;
        }
      };

      navigator.geolocation.getCurrentPosition(onGeoSuccess, onGeoError, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0, // CRITICAL: NEVER accept a cached or stale location!
      });
    },
    [fetchCenters, radius]
  );

  // When radius changes and coordinates exist, re-fetch
  const handleRadiusChange = (newRadius: number) => {
    if (loadingCenters) return;
    if (newRadius === radius && !centersError && centers.length > 0) return;
    setRadius(newRadius);
    if (coords) {
      fetchCenters(coords.lat, coords.lng, newRadius);
    }
  };

  // Watch user location for live changes when enabled
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation || !coords) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;
        const delta = Math.abs(newLat - coords.lat) + Math.abs(newLng - coords.lng);
        // If location shifted significantly (> 100 meters, ~0.001 deg)
        if (delta > 0.001) {
          setCoords({ lat: newLat, lng: newLng });
          setCoordsAccuracy(pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null);
          fetchCenters(newLat, newLng, radius);
        }
      },
      (err) => {
        console.debug("watchPosition error:", err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [coords, radius, fetchCenters]);

  // Google Maps SDK Initialization & Route Drawing
  useEffect(() => {
    if (viewMode !== "map" || !coords || !mapContainerRef.current) return;

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      setMapError("Google Maps API key is not configured. Displaying List View.");
      return;
    }

    let isMounted = true;
    setMapError(null);

    loadGoogleMaps(apiKey)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((googleMaps: any) => {
        if (!isMounted || !mapContainerRef.current) return;

        // Initialize Map
        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new googleMaps.Map(mapContainerRef.current, {
            center: { lat: coords.lat, lng: coords.lng },
            zoom: 13,
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
            styles: [
              { elementType: "geometry", stylers: [{ color: "#0B1515" }] },
              { elementType: "labels.text.stroke", stylers: [{ color: "#0B1515" }] },
              { elementType: "labels.text.fill", stylers: [{ color: "#B8C4C2" }] },
              {
                featureType: "road",
                elementType: "geometry",
                stylers: [{ color: "#203131" }],
              },
              {
                featureType: "road",
                elementType: "geometry.stroke",
                stylers: [{ color: "#101C1C" }],
              },
              {
                featureType: "road.highway",
                elementType: "geometry",
                stylers: [{ color: "#2E7D32" }],
              },
              {
                featureType: "water",
                elementType: "geometry",
                stylers: [{ color: "#071011" }],
              },
              {
                featureType: "poi",
                elementType: "labels.text.fill",
                stylers: [{ color: "#66C56A" }],
              },
            ],
          });
        }

        const map = mapInstanceRef.current;

        // InfoWindow instance
        if (!infoWindowRef.current) {
          infoWindowRef.current = new googleMaps.InfoWindow();
        }

        // Clean up previous user marker
        if (userMarkerRef.current) {
          userMarkerRef.current.setMap(null);
          userMarkerRef.current = null;
        }

        // Distinct Current User Location Marker (Vibrant Blue Pulse)
        const userMarker = new googleMaps.Marker({
          position: { lat: coords.lat, lng: coords.lng },
          map,
          title: "Your Actual Current Location",
          zIndex: 999, // User marker is on top
          icon: {
            path: googleMaps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: "#3B82F6", // Distinct Blue
            fillOpacity: 1,
            strokeColor: "#FFFFFF",
            strokeWeight: 2.5,
          },
        });

        userMarker.addListener("click", () => {
          infoWindowRef.current.setContent(`
            <div style="color: #071011; font-family: system-ui, sans-serif; padding: 4px;">
              <strong style="font-size: 13px; color: #1D4ED8;">Your Current Location</strong>
              <p style="margin: 2px 0 0; font-size: 11px; color: #4B5563;">
                ${coords.lat.toFixed(5)}°, ${coords.lng.toFixed(5)}°
              </p>
            </div>
          `);
          infoWindowRef.current.open(map, userMarker);
        });

        userMarkerRef.current = userMarker;

        // Clean up previous service center markers
        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];

        // Add service center markers
        centers.forEach((center) => {
          const isSelected = selectedCenter?.place_id === center.place_id;

          const marker = new googleMaps.Marker({
            position: { lat: center.latitude, lng: center.longitude },
            map,
            title: center.name || "Automotive Workshop",
            zIndex: isSelected ? 850 : 200,
            icon: {
              path: googleMaps.SymbolPath.BACKWARD_CLOSED_ARROW,
              scale: isSelected ? 7 : 5,
              fillColor: isSelected ? "#F59E0B" : "#2E7D32", // Amber if selected, Green default
              fillOpacity: 0.95,
              strokeColor: isSelected ? "#FFFFFF" : "#9BE39A",
              strokeWeight: isSelected ? 2 : 1.5,
            },
          });

          marker.addListener("click", () => {
            setSelectedCenter(center);
            infoWindowRef.current.setContent(`
              <div style="color: #071011; font-family: system-ui, sans-serif; padding: 4px; max-width: 200px;">
                <strong style="font-size: 13px; color: #065F46;">${center.name || "Automotive Workshop"}</strong>
                <p style="margin: 2px 0; font-size: 11px; color: #374151;">
                  ${center.distance_km != null ? `${center.distance_km.toFixed(1)} km away` : ""}
                </p>
                <p style="margin: 0; font-size: 10px; color: #6B7280;">
                  ${center.address || center.city || "Address not available"}
                </p>
              </div>
            `);
            infoWindowRef.current.open(map, marker);
          });

          markersRef.current.push(marker);
        });

        // Initialize DirectionsRenderer if needed
        if (!directionsRendererRef.current) {
          directionsRendererRef.current = new googleMaps.DirectionsRenderer({
            map,
            suppressMarkers: true, // We supply our own distinct markers
            preserveViewport: true, // We manage bounds fitting
            polylineOptions: {
              strokeColor: "#22C55E", // Bright green driving route
              strokeWeight: 5,
              strokeOpacity: 0.85,
            },
          });
        } else {
          directionsRendererRef.current.setMap(map);
        }

        if (!directionsServiceRef.current) {
          directionsServiceRef.current = new googleMaps.DirectionsService();
        }

        // Clean up fallback polyline
        if (fallbackPolylineRef.current) {
          fallbackPolylineRef.current.setMap(null);
          fallbackPolylineRef.current = null;
        }

        // Route calculation when center is selected
        if (selectedCenter) {
          directionsServiceRef.current.route(
            {
              origin: new googleMaps.LatLng(coords.lat, coords.lng),
              destination: new googleMaps.LatLng(
                selectedCenter.latitude,
                selectedCenter.longitude
              ),
              travelMode: googleMaps.TravelMode.DRIVING,
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (result: any, status: any) => {
              if (!isMounted) return;

              if (status === googleMaps.DirectionsStatus.OK && result) {
                directionsRendererRef.current?.setDirections(result);

                const routeLeg = result.routes[0]?.legs[0];
                if (routeLeg) {
                  setRouteDistance(routeLeg.distance?.text || null);
                  setRouteDuration(routeLeg.duration?.text || null);
                }

                // Fit map bounds to show both user marker and selected center
                const bounds = new googleMaps.LatLngBounds();
                bounds.extend(new googleMaps.LatLng(coords.lat, coords.lng));
                bounds.extend(
                  new googleMaps.LatLng(
                    selectedCenter.latitude,
                    selectedCenter.longitude
                  )
                );
                map.fitBounds(bounds, {
                  top: 50,
                  right: 50,
                  bottom: 50,
                  left: 50,
                });
              } else {
                // Fallback: Polyline directly from user coords to center coords
                directionsRendererRef.current?.setDirections({ routes: [] });
                setRouteDistance(null);
                setRouteDuration(null);

                const polyline = new googleMaps.Polyline({
                  path: [
                    { lat: coords.lat, lng: coords.lng },
                    { lat: selectedCenter.latitude, lng: selectedCenter.longitude },
                  ],
                  geodesic: true,
                  strokeColor: "#22C55E",
                  strokeOpacity: 0.8,
                  strokeWeight: 4,
                  map,
                });
                fallbackPolylineRef.current = polyline;

                const bounds = new googleMaps.LatLngBounds();
                bounds.extend(new googleMaps.LatLng(coords.lat, coords.lng));
                bounds.extend(
                  new googleMaps.LatLng(
                    selectedCenter.latitude,
                    selectedCenter.longitude
                  )
                );
                map.fitBounds(bounds, {
                  top: 50,
                  right: 50,
                  bottom: 50,
                  left: 50,
                });
              }
            }
          );
        } else {
          // No center selected: clear route and center on user's current location
          directionsRendererRef.current?.setDirections({ routes: [] });
          if (fallbackPolylineRef.current) {
            fallbackPolylineRef.current.setMap(null);
            fallbackPolylineRef.current = null;
          }
          setRouteDistance(null);
          setRouteDuration(null);
          map.panTo({ lat: coords.lat, lng: coords.lng });
          map.setZoom(13);
        }
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        console.warn("Google Maps failed to load:", err);
        setMapError("Failed to load Google Maps SDK. Please switch to List View.");
      });

    return () => {
      isMounted = false;
    };
  }, [viewMode, coords, centers, selectedCenter]);

  return (
    <Card className="border-border bg-card text-card-foreground rounded-2xl shadow-sm overflow-hidden">
      <CardHeader className="pb-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-secondary text-[#66C56A] border border-[#2E7D32]/40 shrink-0">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#66C56A]">
                Nearby Workshops
              </span>
              {loadingCenters ? (
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-[#66C56A] bg-secondary px-2 py-0.5 rounded-full border border-[#2E7D32]/30 flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Searching {radius / 1000} km...</span>
                </span>
              ) : hasSearched && !centersError ? (
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-[#9BE39A] bg-secondary px-2 py-0.5 rounded-full border border-[#2E7D32]/30">
                  {centers.length} {centers.length === 1 ? "Center Found" : "Centers Found"} ({radius / 1000} km)
                </span>
              ) : null}
              {coords && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-sky-600 dark:text-[#38BDF8] bg-secondary px-2.5 py-0.5 rounded-full border border-sky-500/40">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                  <span>
                    GPS: {coords.lat.toFixed(4)}°, {coords.lng.toFixed(4)}°
                    {coordsAccuracy ? ` (±${coordsAccuracy}m)` : ""}
                  </span>
                </span>
              )}
            </div>
            <CardTitle className="text-base sm:text-lg font-bold text-foreground">
              Find Service Center
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Locate authorized workshops and mechanics near your current position
            </CardDescription>
          </div>
        </div>

        {/* View Switcher & Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Radius Selector */}
          <div className="flex items-center rounded-xl border border-border bg-secondary p-0.5">
            {RADIUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={loadingCenters}
                onClick={() => handleRadiusChange(opt.value)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  loadingCenters ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                } ${
                  radius === opt.value
                    ? "bg-[#2E7D32] text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* List / Map Toggle */}
          <div className="flex items-center rounded-xl border border-border bg-secondary p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                viewMode === "list"
                  ? "bg-[#2E7D32] text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                viewMode === "map"
                  ? "bg-[#2E7D32] text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MapIcon className="h-3.5 w-3.5" />
              <span>Map</span>
            </button>
          </div>

          {/* Detect Location Button */}
          <Button
            size="sm"
            onClick={() => requestLocation(true)}
            disabled={locating || loadingCenters}
            className="rounded-xl font-semibold bg-secondary text-[#66C56A] border border-[#2E7D32]/40 hover:bg-muted hover:text-[#66C56A] h-8 text-xs flex items-center gap-1.5 cursor-pointer"
          >
            {locating ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Locating...</span>
              </>
            ) : (
              <>
                <LocateFixed className="h-3.5 w-3.5" />
                <span>{coords ? "Refresh Location" : "Locate Me"}</span>
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-4">
        {/* Geolocation Error Alert */}
        {locationError && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-600 dark:text-rose-300 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{locationError}</p>
              <button
                type="button"
                onClick={() => requestLocation(true)}
                className="mt-1.5 underline font-bold text-rose-600 dark:text-rose-200 hover:text-foreground"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Backend Center Load Error when previous centers are available */}
        {centersError && centers.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-600 dark:text-amber-300 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{centersError}</p>
              {coords && (
                <button
                  type="button"
                  onClick={() => fetchCenters(coords.lat, coords.lng, radius)}
                  className="mt-1.5 underline font-bold text-amber-600 dark:text-amber-200 hover:text-foreground"
                >
                  Retry Search
                </button>
              )}
            </div>
          </div>
        )}
        {/* Initial Prompt State (when user hasn't clicked Locate Me yet) */}
        {!coords && !locating && !locationError && (
          <div className="py-10 text-center rounded-2xl border border-dashed border-border bg-secondary/40 p-6">
            <div className="flex justify-center mb-3">
              <div className="p-3 rounded-2xl bg-secondary text-[#66C56A] border border-[#2E7D32]/40 shadow-sm">
                <Navigation className="h-6 w-6" />
              </div>
            </div>
            <h3 className="text-base font-bold text-foreground">
              Discover Nearby Service Centers
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 leading-relaxed">
              Allow location access to find real car and bike repair centers around your current location,
              complete with driving distances, contact details, and directions.
            </p>
            <div className="mt-4 flex justify-center">
              <Button
                onClick={() => requestLocation()}
                className="rounded-xl font-bold bg-[#2E7D32] text-white hover:bg-[#256628] shadow-md transition-all h-10 px-5 text-xs sm:text-sm flex items-center gap-2"
              >
                <LocateFixed className="h-4 w-4" />
                <span>Use Current Location</span>
              </Button>
            </div>
          </div>
        )}

        {/* Loading Spinner State */}
        {(locating || loadingCenters) && (
          <div className="py-12 text-center">
            <div className="flex justify-center mb-3">
              <RefreshCw className="h-7 w-7 text-[#66C56A] animate-spin" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {locating
                ? "Detecting your GPS location..."
                : `Searching nearby service centers within ${radius / 1000} km...`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Querying live workshop records from OpenStreetMap (multi-server failover enabled)...
            </p>
          </div>
        )}

        {/* Loaded Content: List View & Map View */}
        {coords && !locating && !loadingCenters && (
          centersError && centers.length === 0 ? (
            <div className="py-10 text-center rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
              <div className="flex justify-center mb-2">
                <div className="p-2.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30">
                  <AlertCircle className="h-5 w-5" />
                </div>
              </div>
              <p className="text-sm font-semibold text-foreground">
                Unable to Load Workshops within {radius / 1000} km
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {centersError}
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button
                  size="sm"
                  disabled={loadingCenters}
                  onClick={() => fetchCenters(coords.lat, coords.lng, radius)}
                  className="rounded-xl font-semibold bg-[#2E7D32] text-white hover:bg-[#256628] text-xs h-9 px-4 flex items-center gap-2 disabled:opacity-60"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Retry {radius / 1000} km Search</span>
                </Button>
              </div>
            </div>
          ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Area: List or Map View (7 cols on lg) */}
            <div className="lg:col-span-7 space-y-3">
              {viewMode === "list" ? (
                /* ====================================================
                   LIST VIEW
                   ==================================================== */
                centers.length > 0 ? (
                  <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                    {centers.map((center) => {
                      const isSelected = selectedCenter?.place_id === center.place_id;
                      const displayName =
                        center.name && center.name.trim() !== ""
                          ? center.name
                          : "Automotive Workshop";
                      const addressSnippet =
                        center.address || center.city || "Address not available";

                      return (
                        <div
                          key={center.place_id}
                          onClick={() => setSelectedCenter(center)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                            isSelected
                              ? "border-[#66C56A] bg-secondary/90 shadow-sm"
                              : "border-border bg-secondary/40 hover:bg-secondary hover:border-[#2E7D32]/40"
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div
                              className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 mt-0.5 ${
                                isSelected
                                  ? "bg-[#2E7D32] text-white"
                                  : "bg-card text-[#66C56A] border border-border"
                              }`}
                            >
                              <Wrench className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">
                                {displayName}
                              </h4>
                              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                {addressSnippet}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="text-[10px] font-semibold text-[#66C56A] bg-card px-2 py-0.5 rounded-md border border-[#2E7D32]/30">
                                  {center.distance_km != null
                                    ? `${center.distance_km.toFixed(1)} km away`
                                    : "Nearby"}
                                </span>
                                {center.rating !== null && center.rating !== undefined ? (
                                  <span className="text-[10px] font-semibold text-[#D9A441] bg-card px-2 py-0.5 rounded-md border border-border flex items-center gap-1">
                                    <Star className="h-3 w-3 fill-[#D9A441]" />
                                    <span>{Number(center.rating).toFixed(1)}</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground bg-card px-1.5 py-0.5 rounded-md border border-border">
                                    No rating
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant={isSelected ? "default" : "outline"}
                              className={`h-7 px-2.5 text-[11px] rounded-lg font-semibold ${
                                isSelected
                                  ? "bg-[#2E7D32] text-white hover:bg-[#256628]"
                                  : "border-border text-[#66C56A] hover:bg-muted"
                              }`}
                            >
                              {isSelected ? "Selected" : "View"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Empty State for 0 centers */
                  <div className="py-10 text-center rounded-2xl border border-border bg-secondary/40 p-6">
                    <div className="flex justify-center mb-2">
                      <div className="p-2.5 rounded-full bg-card text-muted-foreground border border-border">
                        <Search className="h-5 w-5" />
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      No workshops found within {radius / 1000} km
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      Try expanding your search radius to 10 km or 25 km to discover more repair options.
                    </p>
                    <div className="mt-3 flex justify-center gap-2">
                      {RADIUS_OPTIONS.filter((opt) => opt.value > radius).map((opt) => (
                        <Button
                          key={opt.value}
                          size="sm"
                          onClick={() => handleRadiusChange(opt.value)}
                          className="rounded-xl font-semibold bg-[#2E7D32] text-white hover:bg-[#256628] text-xs h-8"
                        >
                          Expand to {opt.label}
                        </Button>
                      ))}
                      {radius === 25000 && coords && (
                        <Button
                          size="sm"
                          onClick={() => fetchCenters(coords.lat, coords.lng, 25000)}
                          className="rounded-xl font-semibold bg-[#101C1C] border border-[#2E7D32]/40 text-[#66C56A] hover:bg-[#132020] text-xs h-8 flex items-center gap-1.5"
                        >
                          <RefreshCw className="h-3 w-3" />
                          <span>Refresh 25 km Search</span>
                        </Button>
                      )}
                    </div>
                  </div>
                )
              ) : (
                /* ====================================================
                   MAP VIEW
                   ==================================================== */
                <div className="space-y-2">
                  {mapError && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-300 flex items-center justify-between gap-2">
                      <span>{mapError}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewMode("list")}
                        className="h-7 text-xs border-amber-500/40 text-amber-600 dark:text-amber-300"
                      >
                        Switch to List
                      </Button>
                    </div>
                  )}
                  {/* Active Driving Route Banner */}
                  {selectedCenter && (
                    <div className="flex items-center justify-between text-xs bg-[#101C1C] border border-[#203131] rounded-xl px-3.5 py-2 text-[#F5F7F6] shadow-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <Navigation className="h-3.5 w-3.5 text-[#66C56A] shrink-0" />
                        <span className="truncate">
                          Driving Route to <strong>{selectedCenter.name || "Workshop"}</strong>:
                        </span>
                        <span className="text-[#9BE39A] font-semibold shrink-0">
                          {routeDistance && routeDuration
                            ? `${routeDistance} (${routeDuration})`
                            : selectedCenter.distance_km != null
                            ? `~${selectedCenter.distance_km.toFixed(1)} km`
                            : "Driving path"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCenter(null)}
                        className="text-[11px] text-[#81918E] hover:text-[#F5F7F6] underline shrink-0 cursor-pointer ml-2"
                      >
                        Clear Route
                      </button>
                    </div>
                  )}

                  <div
                    ref={mapContainerRef}
                    className="w-full h-[400px] rounded-2xl border border-border bg-secondary overflow-hidden relative shadow-inner"
                  >
                    {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-card/90 z-10">
                        <MapIcon className="h-8 w-8 text-muted-foreground mb-2" />
                        <h4 className="text-sm font-bold text-foreground">Google Maps Key Required</h4>
                        <p className="text-xs text-muted-foreground max-w-xs mt-1">
                          Configure <code className="text-[#66C56A]">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable interactive Google Maps.
                        </p>
                        <Button
                          size="sm"
                          onClick={() => setViewMode("list")}
                          className="mt-3 rounded-xl bg-[#2E7D32] text-white text-xs h-8"
                        >
                          Browse Service Centers in List View
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Area: Selected Center Detail Card (5 cols on lg) */}
            <div className="lg:col-span-5">
              {selectedCenter ? (
                <ServiceCenterDetailCard
                  center={selectedCenter}
                  userCoords={coords}
                  routeDistance={routeDistance}
                  routeDuration={routeDuration}
                  onClose={() => setSelectedCenter(null)}
                />
              ) : (
                <div className="h-full min-h-[220px] rounded-2xl border border-dashed border-border bg-secondary/30 flex flex-col items-center justify-center p-6 text-center">
                  <Wrench className="h-6 w-6 text-muted-foreground mb-2" />
                  <p className="text-xs font-semibold text-foreground">
                    No Service Center Selected
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Click &ldquo;View&rdquo; on any workshop from the list to see phone numbers, exact address, and driving directions.
                  </p>
                </div>
              )}
            </div>
          </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
