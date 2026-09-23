import {
  fetchVehicles,
  fetchVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  uploadServiceSlip,
  getSlipStatus,
  createServiceRecord,
  getNearbyServiceCenters,
  clearApiCache,
} from "./api";

// Mock supabase client to avoid network initialization calls in tests
jest.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: {
          session: {
            access_token: "mock-session-jwt",
          },
        },
        error: null,
      }),
    },
  },
}));

// Mock global fetch
global.fetch = jest.fn();

describe("Vehicle API CRUD Integration Test Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearApiCache();
  });

  // 1. Vehicle list / API loading & success
  test("fetchVehicles - successfully returns vehicle list", async () => {
    const mockVehicles = [
      { id: "v1", make: "Tata", model: "Nexon", year: 2022, vin: "VIN123", odometer_km: 15000 }
    ];
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockVehicles,
    });

    const result = await fetchVehicles();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/vehicles/"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer mock-session-jwt",
        }),
      })
    );
    expect(result).toEqual(mockVehicles);
  });

  test("fetchVehicles - handles server load failure", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ detail: "Server error" }),
    });

    await expect(fetchVehicles()).rejects.toThrow("Failed to fetch vehicles list from backend");
  });

  // 2. Create vehicle
  test("createVehicle - successfully registers a new vehicle", async () => {
    const newVehicle = { make: "Maruti", model: "Swift", year: 2021, vin: "VIN789", odometer_km: 1000 };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "new-id", ...newVehicle }),
    });

    const result = await createVehicle(newVehicle);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/vehicles/"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(newVehicle),
      })
    );
    expect(result.id).toBe("new-id");
  });

  // 3. Update vehicle
  test("updateVehicle - successfully updates specifications", async () => {
    const updatedFields = { make: "Mahindra", model: "XUV", year: 2023, vin: "VIN999", odometer_km: 25000 };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "v-id", ...updatedFields }),
    });

    const result = await updateVehicle("v-id", updatedFields);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/vehicles/v-id"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify(updatedFields),
      })
    );
    expect(result.model).toBe("XUV");
  });

  // 4. Delete vehicle
  test("deleteVehicle - successfully removes vehicle", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "Vehicle deleted successfully", vehicle_id: "v-id" }),
    });

    const result = await deleteVehicle("v-id");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/vehicles/v-id"),
      expect.objectContaining({
        method: "DELETE",
      })
    );
    expect(result.message).toBe("Vehicle deleted successfully");
  });

  // 5. 5-vehicle limit error handling
  test("createVehicle - handles the 5-vehicle limit cap error", async () => {
    const newVehicle = { make: "Maruti", model: "Swift", year: 2021, vin: "VIN789", odometer_km: 1000 };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: "Maximum of 5 vehicles allowed per user" }),
    });

    await expect(createVehicle(newVehicle)).rejects.toThrow("Maximum of 5 vehicles allowed per user");
  });

  // 6. Validation behavior error mapping
  test("createVehicle - handles backend validation error mapping (e.g. malformed VIN)", async () => {
    const invalidVehicle = { make: "Toyota", model: "Camry", year: 2020, vin: "INVALID_VIN", odometer_km: 100 };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ detail: "Vehicle data failed validation (invalid VIN format)." }),
    });

    await expect(createVehicle(invalidVehicle)).rejects.toThrow("Vehicle data failed validation (invalid VIN format).");
  });

  // 7. Get vehicle by ID
  test("fetchVehicleById - successfully returns a vehicle specification", async () => {
    const mockVehicle = { id: "v-id", make: "Mahindra", model: "XUV", year: 2023, vin: "VIN123", odometer_km: 15000 };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockVehicle,
    });

    const result = await fetchVehicleById("v-id");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/vehicles/v-id"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer mock-session-jwt",
        }),
      })
    );
    expect(result).toEqual(mockVehicle);
  });
});

describe("Service Slips & Records API Integration Test Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearApiCache();
  });

  test("uploadServiceSlip - successfully uploads a service slip document", async () => {
    const dummyFile = new File(["dummy"], "receipt.png", { type: "image/png" });
    const mockResponse = { slip_id: "slip-123", status: "Uploaded", filename: "receipt.png" };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await uploadServiceSlip(dummyFile);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/slips/"),
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      })
    );
    expect(result).toEqual(mockResponse);
  });

  test("getSlipStatus - successfully retrieves document status", async () => {
    const mockStatus = { id: "slip-123", status: "Parsed", updated_at: "2026-08-18T10:00:00Z" };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStatus,
    });

    const result = await getSlipStatus("slip-123");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/slips/slip-123/status"),
      expect.any(Object)
    );
    expect(result).toEqual(mockStatus);
  });

  test("createServiceRecord - successfully posts payload containing slip_id", async () => {
    const recordPayload = {
      vehicle_id: "v-id",
      service_date: "2026-08-18",
      service_type: "Oil Change",
      notes: "Routine service",
      slip_id: "slip-123",
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "record-123", ...recordPayload }),
    });

    const result = await createServiceRecord(recordPayload);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/services/"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(recordPayload),
      })
    );
    expect(result.slip_id).toBe("slip-123");
  });
});

describe("Nearby Service Centers API Integration Test Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearApiCache();
  });

  test("getNearbyServiceCenters - successfully fetches centers for coordinates", async () => {
    const mockCentersResponse = {
      latitude: 12.9716,
      longitude: 77.5946,
      radius: 5000,
      count: 2,
      cached: false,
      service_centers: [
        {
          place_id: "osm_node_101",
          name: "Bosch Car Care",
          latitude: 12.972,
          longitude: 77.595,
          distance_km: 0.8,
          directions_url: "https://www.google.com/maps/dir/?api=1&destination=12.972,77.595",
          phone: "+91 9876543210",
          website: "https://boschservice.example",
          address: "MG Road",
          city: "Bengaluru",
          postcode: "560001",
          rating: 4.5,
        },
        {
          place_id: "osm_node_102",
          name: null,
          latitude: 12.98,
          longitude: 77.6,
          distance_km: 1.4,
          directions_url: "https://www.google.com/maps/dir/?api=1&destination=12.98,77.6",
          phone: null,
          website: null,
          address: null,
          city: null,
          postcode: null,
          rating: null,
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCentersResponse,
    });

    const result = await getNearbyServiceCenters(12.9716, 77.5946, 5000);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/services/nearby?lat=12.9716&lng=77.5946&radius=5000"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer mock-session-jwt",
        }),
      })
    );
    expect(result.count).toBe(2);
    expect(result.service_centers[0].name).toBe("Bosch Car Care");
    expect(result.service_centers[1].rating).toBeNull();
    expect(result.service_centers[1].phone).toBeNull();
  });

  test("getNearbyServiceCenters - handles backend failure with detail message", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ detail: "Overpass API returned an error" }),
    });

    await expect(getNearbyServiceCenters(12.9716, 77.5946, 5000)).rejects.toThrow(
      "Overpass API returned an error"
    );
  });

  test("getNearbyServiceCenters - handles 429 rate limiting with friendly message", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({}),
    });

    await expect(
      getNearbyServiceCenters(12.9716, 77.5946, 5000, { bypassCache: true })
    ).rejects.toThrow(
      "Service center search is temporarily rate-limited. Please wait a moment and try again."
    );
  });

  test("getNearbyServiceCenters - handles 504 gateway timeout with friendly message", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 504,
      json: async () => ({}),
    });

    await expect(
      getNearbyServiceCenters(12.9716, 77.5946, 5000, { bypassCache: true })
    ).rejects.toThrow(
      "Service center lookup timed out. Please try expanding or narrowing your search radius."
    );
  });

  test("getNearbyServiceCenters - handles 502 bad gateway with friendly message", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({}),
    });

    await expect(
      getNearbyServiceCenters(12.9716, 77.5946, 10000, { bypassCache: true })
    ).rejects.toThrow(
      "Service center provider is temporarily unavailable (Bad Gateway). Please retry in a few moments."
    );
  });

  test("getNearbyServiceCenters - aborts in-flight request when caller signals abort", async () => {
    const controller = new AbortController();
    (global.fetch as jest.Mock).mockImplementationOnce((_url, init) => {
      return new Promise((_, reject) => {
        if (init?.signal?.aborted) {
          const err = new Error("The operation was aborted.");
          err.name = "AbortError";
          return reject(err);
        }
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("The operation was aborted.");
          err.name = "AbortError";
          reject(err);
        });
      });
    });

    const promise = getNearbyServiceCenters(12.9716, 77.5946, 25000, {
      signal: controller.signal,
      bypassCache: true,
    });

    controller.abort();

    await expect(promise).rejects.toThrow("Request was cancelled.");
  });

  test("getNearbyServiceCenters - radius-specific cache keys ensure 5km, 10km, and 25km do not collide", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "success",
          count: 2,
          radius_meters: 5000,
          service_centers: [{ place_id: "c1", name: "Center 5km" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "success",
          count: 5,
          radius_meters: 10000,
          service_centers: [{ place_id: "c2", name: "Center 10km" }],
        }),
      });

    const res5km = await getNearbyServiceCenters(12.9716, 77.5946, 5000);
    const res10km = await getNearbyServiceCenters(12.9716, 77.5946, 10000);

    expect(res5km.service_centers[0].name).toBe("Center 5km");
    expect(res10km.service_centers[0].name).toBe("Center 10km");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
