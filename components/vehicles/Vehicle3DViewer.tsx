"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Rotate3d,
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Minimize2,
  Loader2,
  MoveHorizontal,
  Box,
  Palette,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getVehicleModelConfig, VehicleColorOption, DEFAULT_COLOR_OPTIONS } from "@/lib/vehicleModels";

// Dynamically import Canvas component with SSR disabled to prevent Next.js hydration mismatches
const Vehicle3DCanvas = dynamic(
  () => import("./Vehicle3DCanvas"),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center space-y-3 bg-[#071011]">
        <Loader2 className="h-8 w-8 animate-spin text-[#66C56A]" />
        <span className="text-xs font-medium text-[#81918E] tracking-wide">
          Initializing 3D Engine...
        </span>
      </div>
    ),
  }
);

interface Vehicle3DViewerProps {
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleNickname?: string;
  className?: string;
}

export default function Vehicle3DViewer({
  vehicleMake,
  vehicleModel,
  vehicleNickname,
  className = "",
}: Vehicle3DViewerProps) {
  const [isClient, setIsClient] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAutoRotate, setIsAutoRotate] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Look up model configuration from registry
  const config = getVehicleModelConfig(vehicleMake, vehicleModel, vehicleNickname);

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleAutoRotate = () => {
    setIsAutoRotate((prev) => !prev);
  };

  const handleResetView = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
      controlsRef.current.update();
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err: unknown) {
      console.warn("Fullscreen error:", err);
    }
  };

  const handleModelLoaded = () => {
    setIsLoaded(true);
    setHasError(false);
  };

  const handleModelError = (err: Error) => {
    console.error("3D model failed to load:", err);
    setHasError(true);
    setErrorMessage(err.message || "Failed to load 3D vehicle model.");
  };

  const badgeText = config
    ? config.displayName
    : `${vehicleMake || "Vehicle"} ${vehicleModel || ""}`.trim();

  const colorOptions: VehicleColorOption[] = config?.supportedColors || DEFAULT_COLOR_OPTIONS;

  return (
    <div
      ref={containerRef}
      className={`border border-border bg-card rounded-2xl overflow-hidden shadow-xs transition-all ${
        isFullscreen ? "p-4 sm:p-6 flex flex-col justify-between" : ""
      } ${className}`}
    >
      {/* Top Header & Interactive Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-border bg-card">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-secondary border border-border text-[#66C56A]">
            <Rotate3d className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-foreground">
                360° Interactive View
              </h2>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-secondary text-[#66C56A] border border-[#2E7D32]/40">
                {badgeText}
              </span>
            </div>
            {vehicleNickname && (
              <p className="text-[11px] text-muted-foreground">
                Exploring {vehicleNickname}
              </p>
            )}
          </div>
        </div>

        {/* Toolbar Controls */}
        {config && !hasError && isClient && (
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Auto-rotate Toggle */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleAutoRotate}
              aria-label={isAutoRotate ? "Pause auto rotation" : "Start auto rotation"}
              title={isAutoRotate ? "Pause Auto-Rotate" : "Auto-Rotate"}
              className={`h-8 px-2.5 rounded-xl border text-xs font-medium transition-all ${
                isAutoRotate
                  ? "bg-secondary border-[#2E7D32]/60 text-[#66C56A] hover:bg-muted hover:text-[#66C56A]"
                  : "bg-secondary border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {isAutoRotate ? (
                <>
                  <Pause className="h-3.5 w-3.5 mr-1" />
                  <span className="hidden sm:inline">Rotating</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 mr-1" />
                  <span className="hidden sm:inline">Rotate</span>
                </>
              )}
            </Button>

            {/* Reset Camera View */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetView}
              aria-label="Reset camera orientation"
              title="Reset Camera View"
              className="h-8 px-2.5 rounded-xl border border-border bg-secondary text-muted-foreground hover:text-foreground hover:bg-muted text-xs font-medium transition-all"
            >
              <RotateCcw className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Reset</span>
            </Button>

            {/* Fullscreen Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit fullscreen view" : "Enter fullscreen view"}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              className="h-8 w-8 p-0 rounded-xl border border-border bg-secondary text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex items-center justify-center"
            >
              {isFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Main 3D Canvas / Viewer Area */}
      <div
        className={`relative w-full bg-[#071011] flex items-center justify-center overflow-hidden transition-all ${
          isFullscreen
            ? "flex-1 min-h-[400px]"
            : "h-64 sm:h-80 md:h-96"
        }`}
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(16, 36, 32, 0.4) 0%, rgba(11, 23, 22, 0.75) 50%, #071011 100%)",
        }}
      >
        {!config ? (
          /* Vehicle Incompatibility Fallback */
          <div className="flex flex-col items-center justify-center text-center p-6 space-y-3.5 max-w-md">
            <div className="relative">
              <div className="h-16 w-16 rounded-2xl bg-secondary border border-border flex items-center justify-center text-[#66C56A] shadow-inner">
                <Box className="h-8 w-8 text-[#66C56A]" />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">
                3D Model Unavailable
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                3D model asset for {vehicleMake || "this vehicle"} {vehicleModel || ""} is not currently available in garage. Interactive 3D view is active for approved models.
              </p>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary border border-border text-[11px] font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60"></span>
              3D Model Unavailable
            </div>
          </div>
        ) : hasError ? (
          /* Error Fallback */
          <div className="flex flex-col items-center justify-center text-center p-6 space-y-3.5 max-w-md">
            <div className="relative">
              <div className="h-16 w-16 rounded-2xl bg-secondary border border-border flex items-center justify-center text-rose-400 shadow-inner">
                <Box className="h-8 w-8 text-rose-400" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">
                3D Model Error
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {errorMessage || `Unable to render ${config.displayName} 3D model.`}
              </p>
            </div>
          </div>
        ) : (
          /* 3D R3F Canvas Container */
          <div className="w-full h-full relative">
            {isClient && (
              <Vehicle3DCanvas
                config={config}
                isAutoRotate={isAutoRotate}
                onLoaded={handleModelLoaded}
                onError={handleModelError}
                controlsRef={controlsRef}
                selectedColor={selectedColor}
              />
            )}

            {/* Loading Overlay */}
            {(!isLoaded || !isClient) && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center space-y-3 bg-[#071011] pointer-events-none transition-opacity duration-300">
                <Loader2 className="h-8 w-8 animate-spin text-[#66C56A]" />
                <span className="text-xs font-medium text-[#81918E] tracking-wide">
                  Loading {config.displayName} 360° View...
                </span>
              </div>
            )}
          </div>
        )}

        {/* Color Customization Selector Bar Overlay */}
        {config && !hasError && isClient && config.bodyMaterialNames.length > 0 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-2 rounded-2xl bg-card/90 border border-border backdrop-blur-md shadow-lg max-w-[95vw] overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-1.5 pr-2 border-r border-border text-xs font-medium text-muted-foreground shrink-0">
              <Palette className="h-3.5 w-3.5 text-[#66C56A]" />
              <span className="hidden sm:inline">Body Color</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {colorOptions.map((color) => {
                const isSelected = selectedColor === color.hex;
                return (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => setSelectedColor(color.hex)}
                    title={`Change body color to ${color.name}`}
                    aria-label={`Select ${color.name} body color`}
                    className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-full transition-all flex items-center justify-center border-2 outline-none cursor-pointer hover:scale-105 active:scale-95 ${
                      isSelected
                        ? "border-[#66C56A] shadow-md shadow-[#66C56A]/20 scale-105"
                        : "border-border hover:border-muted-foreground"
                    }`}
                    style={{ backgroundColor: color.hex }}
                  >
                    {isSelected && (
                      <Check
                        className={`h-4 w-4 ${
                          color.hex === "#F5F5F5" || color.hex === "#9CA3AF"
                            ? "text-slate-900"
                            : "text-white"
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Ambient Ground Grid Shadow Overlay */}
        <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none bg-gradient-to-t from-[#071011] to-transparent"></div>
      </div>

      {/* Bottom Hint / Info Bar */}
      {config && !hasError && isClient && (
        <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-t border-border bg-card text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <MoveHorizontal className="h-3.5 w-3.5 text-[#66C56A]" />
            <span>Drag to rotate • Pinch / Scroll to zoom</span>
          </div>
          <span className="hidden sm:inline text-muted-foreground/80 font-medium">
            React Three Fiber Engine
          </span>
        </div>
      )}
    </div>
  );
}
