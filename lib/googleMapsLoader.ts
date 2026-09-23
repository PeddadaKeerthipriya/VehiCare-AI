/**
 * Lightweight, dependency-free Google Maps JavaScript SDK loader.
 * Protects against duplicate script tags and handles SSR safely.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

let googleMapsPromise: Promise<any> | null = null;

export function isGoogleMapsLoaded(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as any).google && (window as any).google.maps);
}

export function loadGoogleMaps(apiKey: string): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps cannot be loaded on the server"));
  }

  if (isGoogleMapsLoaded()) {
    return Promise.resolve((window as any).google.maps);
  }

  if (!apiKey || apiKey.trim() === "") {
    return Promise.reject(new Error("Google Maps API key is missing or empty"));
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    // Check again in case another script loaded it
    if (isGoogleMapsLoaded()) {
      resolve((window as any).google.maps);
      return;
    }

    const scriptId = "google-maps-sdk-script";
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if (isGoogleMapsLoaded()) {
          resolve((window as any).google.maps);
        } else {
          googleMapsPromise = null;
          reject(new Error("Google Maps script loaded but maps object unavailable"));
        }
      });
      existingScript.addEventListener("error", () => {
        googleMapsPromise = null;
        reject(new Error("Failed to load Google Maps script"));
      });
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (isGoogleMapsLoaded()) {
        resolve((window as any).google.maps);
      } else {
        googleMapsPromise = null;
        reject(new Error("Google Maps loaded, but google.maps is not available on window"));
      }
    };

    script.onerror = () => {
      googleMapsPromise = null;
      reject(new Error("Failed to load Google Maps JavaScript API. Please check network/key."));
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
}
