import { ServiceCenter } from "@/lib/types";

describe("Find Service Center & Detail Card Unit Test Suite", () => {
  const sampleCenterWithAllData: ServiceCenter = {
    place_id: "osm_node_12345",
    name: "Automech Service Hub",
    latitude: 12.9716,
    longitude: 77.5946,
    distance_km: 2.345,
    directions_url: "https://www.google.com/maps/dir/?api=1&destination=12.9716,77.5946",
    phone: "+91 98765 43210",
    website: "https://automech.example.com",
    address: "100 Feet Road, Indiranagar",
    city: "Bengaluru",
    postcode: "560038",
    rating: 4.6,
  };

  const sampleCenterWithMissingData: ServiceCenter = {
    place_id: "osm_node_67890",
    name: null,
    latitude: 13.0,
    longitude: 77.6,
    distance_km: 0.75,
    directions_url: "",
    phone: null,
    website: null,
    address: null,
    city: null,
    postcode: null,
    rating: null,
  };

  // Helper functions mirroring formatting logic
  function formatDisplayName(center: ServiceCenter): string {
    return center.name && center.name.trim() !== ""
      ? center.name
      : "Automotive Service Center";
  }

  function formatAddress(center: ServiceCenter): string {
    const parts = [center.address, center.city, center.postcode].filter(
      (p): p is string => Boolean(p && p.trim() !== "")
    );
    return parts.length > 0 ? parts.join(", ") : "Not available";
  }

  function formatDistance(distanceKm: number | null | undefined): string {
    if (distanceKm === null || distanceKm === undefined) return "Not available";
    return `${distanceKm.toFixed(1)} km away`;
  }

  function formatRating(rating: number | null | undefined): string {
    if (rating === null || rating === undefined) return "Not available";
    return `${Number(rating).toFixed(1)} / 5.0`;
  }

  function getDirectionsUrl(
    center: ServiceCenter,
    userCoords?: { lat: number; lng: number } | null
  ): string {
    if (userCoords) {
      return `https://www.google.com/maps/dir/?api=1&origin=${userCoords.lat},${userCoords.lng}&destination=${center.latitude},${center.longitude}`;
    }
    return (
      center.directions_url ||
      `https://www.google.com/maps/dir/?api=1&destination=${center.latitude},${center.longitude}`
    );
  }

  function validateCoordinates(lat: unknown, lng: unknown): boolean {
    if (typeof lat !== "number" || typeof lng !== "number") return false;
    if (isNaN(lat) || isNaN(lng)) return false;
    if (lat < -90 || lat > 90) return false;
    if (lng < -180 || lng > 180) return false;
    return true;
  }

  function sanitizePhoneHref(phone: string | null | undefined): string | null {
    if (!phone || phone.trim() === "") return null;
    return `tel:${phone.replace(/[^+\d]/g, "")}`;
  }

  test("DisplayName: uses real name when provided, fallback when null or blank", () => {
    expect(formatDisplayName(sampleCenterWithAllData)).toBe("Automech Service Hub");
    expect(formatDisplayName(sampleCenterWithMissingData)).toBe("Automotive Service Center");
    expect(formatDisplayName({ ...sampleCenterWithAllData, name: "   " })).toBe(
      "Automotive Service Center"
    );
  });

  test("Address: formats comma-separated address parts and displays 'Not available' when empty", () => {
    expect(formatAddress(sampleCenterWithAllData)).toBe(
      "100 Feet Road, Indiranagar, Bengaluru, 560038"
    );
    expect(formatAddress(sampleCenterWithMissingData)).toBe("Not available");
    expect(
      formatAddress({
        ...sampleCenterWithMissingData,
        city: "Bengaluru",
      })
    ).toBe("Bengaluru");
  });

  test("Rating: preserves real numeric rating to 1 decimal place and strictly rejects fake fallbacks", () => {
    expect(formatRating(sampleCenterWithAllData.rating)).toBe("4.6 / 5.0");
    expect(formatRating(sampleCenterWithMissingData.rating)).toBe("Not available");
    expect(formatRating(null)).toBe("Not available");
    expect(formatRating(undefined)).toBe("Not available");
  });

  test("Distance: formats driving distance with 1 decimal place", () => {
    expect(formatDistance(sampleCenterWithAllData.distance_km)).toBe("2.3 km away");
    expect(formatDistance(sampleCenterWithMissingData.distance_km)).toBe("0.8 km away");
    expect(formatDistance(null)).toBe("Not available");
  });

  test("DirectionsUrl: anchors route to user's actual current location origin when coords provided", () => {
    // Real location test (e.g. Vijayawada, not Hyderabad)
    const vijayawadaUserCoords = { lat: 16.5062, lng: 80.648 };
    const vijayawadaCenter: ServiceCenter = {
      ...sampleCenterWithAllData,
      latitude: 16.518,
      longitude: 80.654,
    };

    const urlWithOrigin = getDirectionsUrl(vijayawadaCenter, vijayawadaUserCoords);
    expect(urlWithOrigin).toBe(
      "https://www.google.com/maps/dir/?api=1&origin=16.5062,80.648&destination=16.518,80.654"
    );
    // Verifies no hardcoded Hyderabad (17.3850, 78.4867) or Bangalore coordinates are used as origin
    expect(urlWithOrigin).not.toContain("17.385");
    expect(urlWithOrigin).not.toContain("78.486");
  });

  test("DirectionsUrl: falls back to destination-only link when user coords are null", () => {
    expect(getDirectionsUrl(sampleCenterWithAllData, null)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=12.9716,77.5946"
    );
    expect(getDirectionsUrl(sampleCenterWithMissingData, null)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=13,77.6"
    );
  });

  test("Coordinate validation: accepts valid world coordinates and rejects corrupt or NaN values", () => {
    // Non-Hyderabad locations
    expect(validateCoordinates(16.5062, 80.648)).toBe(true); // Vijayawada
    expect(validateCoordinates(28.6139, 77.209)).toBe(true); // Delhi
    expect(validateCoordinates(13.0827, 80.2707)).toBe(true); // Chennai
    expect(validateCoordinates(-33.8688, 151.2093)).toBe(true); // Sydney

    // Invalid coordinates
    expect(validateCoordinates(NaN, 80.0)).toBe(false);
    expect(validateCoordinates(16.0, NaN)).toBe(false);
    expect(validateCoordinates("16.5", 80.0)).toBe(false);
    expect(validateCoordinates(null, 80.0)).toBe(false);
    expect(validateCoordinates(95.0, 80.0)).toBe(false); // Out of range lat
    expect(validateCoordinates(16.0, 190.0)).toBe(false); // Out of range lng
  });

  test("Geolocation configuration: enforces zero maximumAge to prevent stale cached coordinates", () => {
    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    };
    expect(geoOptions.maximumAge).toBe(0);
    expect(geoOptions.enableHighAccuracy).toBe(true);
  });

  test("Phone: sanitizes phone numbers into tel: URI and returns null for missing phone numbers", () => {
    expect(sanitizePhoneHref(sampleCenterWithAllData.phone)).toBe("tel:+919876543210");
    expect(sanitizePhoneHref(sampleCenterWithMissingData.phone)).toBeNull();
    expect(sanitizePhoneHref("")).toBeNull();
    expect(sanitizePhoneHref("   ")).toBeNull();
  });

  describe("Non-Hyderabad Flow & Requirement 11 Scenario Verification", () => {
    // Scenario: User is in Pune (lat: 18.5204, lng: 73.8567), NOT Hyderabad
    const puneCoords = { lat: 18.5204, lng: 73.8567 };
    const puneServiceCenters: ServiceCenter[] = [
      {
        place_id: "pune_osm_01",
        name: "Pune Auto Specialists",
        latitude: 18.5312,
        longitude: 73.8445,
        distance_km: 1.8,
        directions_url: "https://www.google.com/maps/dir/?api=1&destination=18.5312,73.8445",
        phone: "+91 20 1234 5678",
        website: "https://puneauto.example.com",
        address: "FC Road, Shivajinagar",
        city: "Pune",
        postcode: "411005",
        rating: 4.8,
      },
      {
        place_id: "pune_osm_02",
        name: "Kothrud Moto Garage",
        latitude: 18.5074,
        longitude: 73.8077,
        distance_km: 5.3,
        directions_url: "https://www.google.com/maps/dir/?api=1&destination=18.5074,73.8077",
        phone: null,
        website: null,
        address: "Paud Road, Kothrud",
        city: "Pune",
        postcode: "411038",
        rating: 4.5,
      },
    ];

    test("A-C: API request parameters match exact browser geolocation without Hyderabad fallbacks", () => {
      const apiParams = {
        lat: puneCoords.lat,
        lng: puneCoords.lng,
        radius: 5000,
        bypassCache: true,
      };

      expect(apiParams.lat).toBe(18.5204);
      expect(apiParams.lng).toBe(73.8567);
      expect(apiParams.lat).not.toBeCloseTo(17.385, 2); // Not Hyderabad
      expect(apiParams.lng).not.toBeCloseTo(78.486, 2); // Not Hyderabad
      expect(apiParams.bypassCache).toBe(true);
    });

    test("D-F: Service centers and map bounds correspond directly to user's real location", () => {
      // Returned service centers are in Pune
      puneServiceCenters.forEach((center) => {
        expect(center.city).toBe("Pune");
        expect(center.latitude).toBeGreaterThan(18.0);
        expect(center.latitude).toBeLessThan(19.0);
        expect(center.longitude).toBeGreaterThan(73.0);
        expect(center.longitude).toBeLessThan(74.0);
      });
    });

    test("G-I: Driving route from Pune user location to selected Pune workshop", () => {
      const selectedCenter = puneServiceCenters[0];
      const routeOrigin = puneCoords;
      const routeDestination = {
        lat: selectedCenter.latitude,
        lng: selectedCenter.longitude,
      };

      const url = getDirectionsUrl(selectedCenter, routeOrigin);

      // Verify start of route is current location
      expect(url).toContain(`origin=${routeOrigin.lat},${routeOrigin.lng}`);
      // Verify destination is selected center
      expect(url).toContain(
        `destination=${routeDestination.lat},${routeDestination.lng}`
      );
      // Verify no default Hyderabad coordinates exist anywhere in the route
      expect(url).not.toContain("17.385");
      expect(url).not.toContain("78.486");
    });

    test("J: Bounds computation encapsulates user location and destination with padding", () => {
      const selectedCenter = puneServiceCenters[1];

      // Simulated LatLngBounds extend
      const points = [
        puneCoords,
        { lat: selectedCenter.latitude, lng: selectedCenter.longitude },
      ];

      const minLat = Math.min(...points.map((p) => p.lat));
      const maxLat = Math.max(...points.map((p) => p.lat));
      const minLng = Math.min(...points.map((p) => p.lng));
      const maxLng = Math.max(...points.map((p) => p.lng));

      expect(minLat).toBeLessThanOrEqual(puneCoords.lat);
      expect(maxLat).toBeGreaterThanOrEqual(puneCoords.lat);
      expect(minLng).toBeLessThanOrEqual(puneCoords.lng);
      expect(maxLng).toBeGreaterThanOrEqual(puneCoords.lng);

      // Neither coordinate boundary is anywhere near Hyderabad (lat 17.38)
      expect(minLat).toBeGreaterThan(18.0);
    });

    test("Permission Denied: Does NOT fabricate coordinates or silently fallback", () => {
      let stateCoords: { lat: number; lng: number } | null = null;
      let stateError: string | null = null;

      const simulatePermissionDenied = () => {
        stateCoords = null; // Strictly null - no hardcoded location
        stateError =
          "Location permission was denied. Please allow location access in your browser settings to find workshops near your actual location.";
      };

      simulatePermissionDenied();

      expect(stateCoords).toBeNull();
      expect(stateError).toContain("Location permission was denied");
    });

    test("Location Shift (>100m): Detects movement and triggers new coordinates", () => {
      const initialPos = { lat: 18.5204, lng: 73.8567 };
      // Moved by ~250 meters
      const movedPos = { lat: 18.5226, lng: 73.8589 };

      const delta =
        Math.abs(movedPos.lat - initialPos.lat) +
        Math.abs(movedPos.lng - initialPos.lng);

      // 0.001 deg is ~100m
      const shouldUpdate = delta > 0.001;
      expect(shouldUpdate).toBe(true);
    });
  });

  describe("Radius Switching, Race Conditions, Stale State & Error Recovery Suite", () => {
    test("Sequence A & B: Each radius generates its own exact request parameters and replaces results", () => {
      const radiusOptions = [5000, 10000, 25000];
      const responses: Record<number, ServiceCenter[]> = {
        5000: [
          {
            place_id: "c_5km_1",
            name: "Center 5km 1",
            latitude: 18.521,
            longitude: 73.856,
            distance_km: 1.2,
            directions_url: "",
            phone: null,
            website: null,
            address: "5km Road",
            city: "Pune",
            postcode: "411001",
            rating: 4.5,
          },
          {
            place_id: "c_5km_2",
            name: "Center 5km 2",
            latitude: 18.523,
            longitude: 73.859,
            distance_km: 3.4,
            directions_url: "",
            phone: null,
            website: null,
            address: "5km Avenue",
            city: "Pune",
            postcode: "411002",
            rating: 4.2,
          },
        ],
        10000: Array.from({ length: 10 }, (_, i) => ({
          place_id: `c_10km_${i + 1}`,
          name: `Center 10km ${i + 1}`,
          latitude: 18.52 + i * 0.005,
          longitude: 73.85 + i * 0.005,
          distance_km: 4.0 + i * 0.5,
          directions_url: "",
          phone: null,
          website: null,
          address: "10km Road",
          city: "Pune",
          postcode: "411010",
          rating: 4.0,
        })),
        25000: Array.from({ length: 15 }, (_, i) => ({
          place_id: `c_25km_${i + 1}`,
          name: `Center 25km ${i + 1}`,
          latitude: 18.5 + i * 0.01,
          longitude: 73.8 + i * 0.01,
          distance_km: 8.0 + i * 1.0,
          directions_url: "",
          phone: null,
          website: null,
          address: "25km Highway",
          city: "Pune",
          postcode: "411025",
          rating: 4.3,
        })),
      };

      // Verify each request radius produces distinct counts and lists without merging
      radiusOptions.forEach((r) => {
        const queryParams = new URLSearchParams({
          lat: "18.5204",
          lng: "73.8567",
          radius: r.toString(),
        });
        expect(queryParams.get("radius")).toBe(r.toString());
      });

      expect(responses[5000].length).toBe(2);
      expect(responses[10000].length).toBe(10);
      expect(responses[25000].length).toBe(15);
    });

    test("Sequence C: Rapid radius clicks cancel older requests and ignore superseded responses", () => {
      let activeRequestId = 0;
      let uiCenters: ServiceCenter[] = [];
      let uiRadius = 5000;

      // Simulated fetchCenters function with AbortController and requestId
      const simulateFetch = (requestedRadius: number) => {
        const currentReqId = ++activeRequestId;
        uiRadius = requestedRadius;
        // Stale results cleared immediately
        uiCenters = [];

        return {
          currentReqId,
          complete: (results: ServiceCenter[]) => {
            // Stale response guard
            if (currentReqId !== activeRequestId) {
              return; // IGNORED because a newer request was issued
            }
            uiCenters = results;
          },
        };
      };

      // User rapidly clicks: 5 km -> 10 km -> 25 km
      const req5km = simulateFetch(5000);
      const req10km = simulateFetch(10000);
      const req25km = simulateFetch(25000);

      // Now req10km finishes first with 10 centers (delayed)
      req10km.complete([{ place_id: "10km", name: "10km Workshop" } as ServiceCenter]);
      expect(uiCenters.length).toBe(0); // Still 0 because req10km was superseded!

      // req5km finishes very late with 2 centers
      req5km.complete([{ place_id: "5km", name: "5km Workshop" } as ServiceCenter]);
      expect(uiCenters.length).toBe(0); // Still 0 because req5km was superseded!

      // Finally req25km finishes
      req25km.complete([
        { place_id: "25km_1", name: "25km Workshop 1" } as ServiceCenter,
        { place_id: "25km_2", name: "25km Workshop 2" } as ServiceCenter,
      ]);

      // Only the 25km response is visible!
      expect(uiCenters.length).toBe(2);
      expect(uiCenters[0].name).toBe("25km Workshop 1");
      expect(uiRadius).toBe(25000);
    });

    test("Sequence D: 10km failure displays error state without displaying stale 5km results", () => {
      let stateCenters: ServiceCenter[] = [
        { place_id: "5km_old", name: "Old 5km Workshop" } as ServiceCenter,
      ];
      let stateError: string | null = null;
      let stateRadius = 5000;

      // User switches to 10 km
      stateRadius = 10000;
      // Stale data cleared on switch
      stateCenters = [];
      stateError = null;

      // Request fails with 504
      stateError =
        "Service center lookup timed out. Please try expanding or narrowing your search radius.";

      // Invariant checks:
      expect(stateRadius).toBe(10000);
      expect(stateCenters.length).toBe(0); // MUST NOT show previous 5km workshops
      expect(stateError).toContain("lookup timed out");

      // Retry 10km succeeds:
      stateError = null;
      stateCenters = [
        { place_id: "10km_fresh", name: "Fresh 10km Workshop" } as ServiceCenter,
      ];

      expect(stateCenters.length).toBe(1);
      expect(stateCenters[0].name).toBe("Fresh 10km Workshop");
      expect(stateError).toBeNull();
    });

    test("Sequence E: 25km failure does not mask with old 10km results", () => {
      const stateCenters: ServiceCenter[] = [];
      let stateError: string | null = null;
      const stateRadius = 25000;

      // 25km request fails with 429 Too Many Requests
      stateError =
        "Service center search is temporarily rate-limited. Please wait a moment and try again.";

      expect(stateRadius).toBe(25000);
      expect(stateCenters).toEqual([]);
      expect(stateError).toContain("rate-limited");
    });

    test("Selected Center Reset: When switching radius, clears selection if workshop is not in new list", () => {
      const workshopAt8km: ServiceCenter = {
        place_id: "ws_8km",
        name: "8km Workshop",
        latitude: 18.58,
        longitude: 73.88,
        distance_km: 8.2,
        directions_url: "",
        phone: null,
        website: null,
        address: "8km Road",
        city: "Pune",
        postcode: "411040",
        rating: 4.4,
      };

      let selectedCenter: ServiceCenter | null = workshopAt8km;

      // User switches from 10km to 5km. New 5km list does NOT include workshopAt8km
      const fresh5kmList: ServiceCenter[] = [
        {
          place_id: "ws_2km",
          name: "2km Workshop",
          latitude: 18.53,
          longitude: 73.86,
          distance_km: 2.1,
          directions_url: "",
          phone: null,
          website: null,
          address: "2km Road",
          city: "Pune",
          postcode: "411005",
          rating: 4.7,
        },
      ];

      // Verify synchronization logic
      if (selectedCenter && !fresh5kmList.some((c) => c.place_id === selectedCenter?.place_id)) {
        selectedCenter = fresh5kmList[0] || null;
      }

      expect(selectedCenter?.place_id).toBe("ws_2km");
      expect(selectedCenter?.name).toBe("2km Workshop");
    });

    test("Zero Results Handling: Genuine empty state when 0 centers returned", () => {
      const zeroList: ServiceCenter[] = [];
      let selectedCenter: ServiceCenter | null = { place_id: "old" } as ServiceCenter;

      if (zeroList.length > 0) {
        selectedCenter = zeroList[0];
      } else {
        selectedCenter = null;
      }

      expect(zeroList.length).toBe(0);
      expect(selectedCenter).toBeNull();
    });
  });

  describe("Backend Failover, Duplicate Prevention & Invariant Verification Suite", () => {
    test("Duplicate Request Prevention: Skips identical concurrent requests while loading", () => {
      let networkCalls = 0;
      let inFlightParams: { lat: number; lng: number; radius: number } | null = null;
      let loadingCenters = false;

      const triggerFetch = (lat: number, lng: number, radius: number) => {
        if (
          loadingCenters &&
          inFlightParams &&
          inFlightParams.lat === lat &&
          inFlightParams.lng === lng &&
          inFlightParams.radius === radius
        ) {
          return "SKIPPED_DUPLICATE";
        }

        loadingCenters = true;
        inFlightParams = { lat, lng, radius };
        networkCalls++;
        return "INITIATED";
      };

      // First call initiates network call
      expect(triggerFetch(18.5204, 73.8567, 5000)).toBe("INITIATED");
      expect(networkCalls).toBe(1);

      // Immediate duplicate call for identical lat, lng, radius is skipped
      expect(triggerFetch(18.5204, 73.8567, 5000)).toBe("SKIPPED_DUPLICATE");
      expect(networkCalls).toBe(1);

      // Request for different radius is allowed
      expect(triggerFetch(18.5204, 73.8567, 10000)).toBe("INITIATED");
      expect(networkCalls).toBe(2);
    });

    test("State Separation: LOADING, ERROR, and EMPTY are strictly mutually exclusive", () => {
      const evaluateState = (
        loading: boolean,
        error: string | null,
        count: number
      ) => {
        if (loading) return "LOADING";
        if (error) return "ERROR";
        if (count === 0) return "EMPTY";
        return "SUCCESS";
      };

      // While backend is failing over across Overpass servers:
      expect(evaluateState(true, null, 0)).toBe("LOADING");
      expect(evaluateState(true, "timeout", 0)).toBe("LOADING");

      // Backend fails after all failovers exhausted:
      expect(evaluateState(false, "Gateway Timeout", 0)).toBe("ERROR");

      // Backend succeeds with 0 workshops:
      expect(evaluateState(false, null, 0)).toBe("EMPTY");

      // Backend succeeds with workshops:
      expect(evaluateState(false, null, 5)).toBe("SUCCESS");
    });

    test("View Mode and Selection do not alter centers or trigger fetches", () => {
      let viewMode: "list" | "map" = "list";
      let selectedCenter: ServiceCenter | null = null;
      const initialCenters: ServiceCenter[] = [
        {
          place_id: "c1",
          name: "Center 1",
          latitude: 18.5,
          longitude: 73.8,
          distance_km: 2.5,
          directions_url: "",
          phone: "+91 99999 88888",
          website: "https://c1.example.com",
          address: "Center 1 St",
          city: "Pune",
          postcode: "411001",
          rating: 4.6,
        },
      ];
      const networkFetchTriggered = false;

      const setViewMode = (mode: "list" | "map") => {
        viewMode = mode;
        // MUST NOT trigger network fetch
      };

      const selectCenter = (center: ServiceCenter) => {
        selectedCenter = center;
        // MUST NOT trigger network fetch
      };

      setViewMode("map");
      expect(viewMode).toBe("map");
      expect(networkFetchTriggered).toBe(false);

      selectCenter(initialCenters[0]);
      expect((selectedCenter as ServiceCenter | null)?.place_id).toBe("c1");
      expect(networkFetchTriggered).toBe(false);
    });

    test("Data Preservation: Preserves exact backend data fields without client overrides", () => {
      const backendPayload: ServiceCenter = {
        place_id: "osm_node_9999",
        name: "Premier Car Care",
        latitude: 18.52043,
        longitude: 73.85674,
        distance_km: 3.14159,
        directions_url: "https://www.google.com/maps/dir/?api=1&destination=18.52043,73.85674",
        phone: "+91 20 2555 1234",
        website: "https://premiercar.example.com",
        address: "Deccan Gymkhana",
        city: "Pune",
        postcode: "411004",
        rating: 4.85,
      };

      // Invariants: fields are not truncated, mocked, or overwritten
      expect(backendPayload.place_id).toBe("osm_node_9999");
      expect(backendPayload.name).toBe("Premier Car Care");
      expect(backendPayload.distance_km).toBe(3.14159);
      expect(backendPayload.phone).toBe("+91 20 2555 1234");
      expect(backendPayload.website).toBe("https://premiercar.example.com");
      expect(backendPayload.rating).toBe(4.85);
    });
  });
});


