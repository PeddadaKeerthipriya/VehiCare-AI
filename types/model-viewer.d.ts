import * as React from "react";

export interface ModelViewerElement extends HTMLElement {
  loaded: boolean;
  autoRotate: boolean;
  cameraOrbit: string;
  cameraTarget: string;
  fieldOfView: string;
  resetTurntable: () => void;
  jumpCameraToGoal: () => void;
  dismissPoster: () => void;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<ModelViewerElement> & {
          src?: string;
          alt?: string;
          "camera-controls"?: boolean | string;
          "auto-rotate"?: boolean | string;
          "auto-rotate-delay"?: number | string;
          "rotation-per-second"?: string;
          "camera-orbit"?: string;
          "camera-target"?: string;
          "field-of-view"?: string;
          "min-camera-orbit"?: string;
          "max-camera-orbit"?: string;
          "min-field-of-view"?: string;
          "max-field-of-view"?: string;
          "shadow-intensity"?: number | string;
          "shadow-softness"?: number | string;
          "exposure"?: number | string;
          "environment-image"?: string;
          loading?: "auto" | "lazy" | "eager";
          reveal?: "auto" | "interaction" | "manual";
          poster?: string;
          "touch-action"?: string;
          "interaction-prompt"?: "auto" | "when-focused" | "none";
          "disable-zoom"?: boolean | string;
          "disable-pan"?: boolean | string;
          "disable-tap"?: boolean | string;
          ar?: boolean | string;
          "ar-modes"?: string;
          "ar-scale"?: string;
          slot?: string;
        },
        ModelViewerElement
      >;
    }
  }
}
