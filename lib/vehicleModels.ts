export interface VehicleColorOption {
  name: string;
  hex: string;
}

export const DEFAULT_COLOR_OPTIONS: VehicleColorOption[] = [
  { name: "White", hex: "#F5F5F5" },
  { name: "Black", hex: "#111111" },
  { name: "Red", hex: "#B91C1C" },
  { name: "Blue", hex: "#2563EB" },
  { name: "Silver", hex: "#9CA3AF" },
  { name: "Grey", hex: "#4B5563" },
];

export interface VehicleModelConfig {
  id: string;
  displayName: string;
  make: string;
  model: string;
  year?: number | string;
  aliases: string[];
  glbPath: string;
  /** Backward compatibility property matching glbPath */
  modelPath: string;
  bodyMaterialNames: string[];
  protectedMaterialNames?: string[];
  supportedColors?: VehicleColorOption[];
  defaultColor?: string;
  framingMultiplier?: number;
  fov?: number;
}

export const VEHICLE_MODELS: VehicleModelConfig[] = [
  {
    id: "nissan-terra",
    make: "Nissan",
    model: "Terra",
    displayName: "Nissan Terra",
    aliases: ["nissan terra", "terra", "nissan terra suv"],
    glbPath: "/models/nissan-terra-vehiCare.glb",
    modelPath: "/models/nissan-terra-vehiCare.glb",
    bodyMaterialNames: ["carpaint_gold"],
    protectedMaterialNames: ["Material_35", "Material_38", "window", "light_glass2", "clearglass"],
    supportedColors: DEFAULT_COLOR_OPTIONS,
    framingMultiplier: 1.02,
    fov: 34,
  },
  {
    id: "red-sedan",
    make: "Red sedan",
    model: "sedan",
    displayName: "Red Sedan",
    aliases: ["red sedan", "red sedan sedan", "generic red sedan", "red_sedan"],
    glbPath: "/models/red-sedan.glb",
    modelPath: "/models/red-sedan.glb",
    bodyMaterialNames: ["material_6"],
    supportedColors: DEFAULT_COLOR_OPTIONS,
    framingMultiplier: 1.05,
    fov: 34,
  },
  {
    id: "honda-civic-type-r-1998",
    make: "Honda",
    model: "Civic Type R",
    displayName: "Honda Civic Type R '98",
    year: 1998,
    aliases: ["honda civic type r", "civic type r", "civic type-r", "civic typer", "honda civic type r 1998", "honda civic type r '98"],
    glbPath: "/models/honda-civic-type-r-1998.glb",
    modelPath: "/models/honda-civic-type-r-1998.glb",
    bodyMaterialNames: ["Body_MAT"],
    protectedMaterialNames: ["Glass_MAT", "Glass_02_MAT", "Mirror_MAT", "Tire_MAT", "Silver_MAT", "Black_MAT"],
    supportedColors: DEFAULT_COLOR_OPTIONS,
    framingMultiplier: 1.02,
    fov: 34,
  },
  {
    id: "honda-vezel-ehev-rs",
    make: "Honda",
    model: "Vezel e:HEV RS",
    displayName: "Honda Vezel e:HEV RS",
    aliases: ["honda vezel e:hev rs", "honda vezel", "vezel", "vezel e:hev rs", "vezel ehev", "hr-v", "hrv"],
    glbPath: "/models/honda-vezel-ehev-rs.glb",
    modelPath: "/models/honda-vezel-ehev-rs.glb",
    bodyMaterialNames: ["carpaint", "carpaint_second"],
    protectedMaterialNames: [
      "chrome", "rim_black", "rim_metal", "caliper", "black", "white",
      "redglass", "clearglass", "widowsglass_int", "windows_glass", "dark", "blue", "black_gloss"
    ],
    supportedColors: DEFAULT_COLOR_OPTIONS,
    framingMultiplier: 1.05,
    fov: 34,
  },
  {
    id: "honda-accord-euro-r-2002",
    make: "Honda",
    model: "Accord Euro-R",
    displayName: "Honda Accord Euro-R '02",
    year: 2002,
    aliases: ["honda accord euro-r", "honda euro-r", "euro-r", "euro r", "accord euro r", "accord euro-r", "honda accord euro r"],
    glbPath: "/models/honda-accord-euro-r-2002.glb",
    modelPath: "/models/honda-accord-euro-r-2002.glb",
    bodyMaterialNames: ["Material_41"],
    protectedMaterialNames: [
      "Material_47", "Material_29", "Material_27", "black", "Material_34", "Material_35",
      "Material_31", "Material_39", "Material_25", "Material_26", "Material_40", "Material_32",
      "Material_37", "Material_38", "Material_36", "Material_33", "Material_28", "Material_44",
      "Material_48", "Material_56"
    ],
    supportedColors: DEFAULT_COLOR_OPTIONS,
    framingMultiplier: 1.02,
    fov: 34,
  },
  {
    id: "toyota-fortuner-2021",
    make: "Toyota",
    model: "Fortuner",
    displayName: "Toyota Fortuner 2021",
    year: 2021,
    aliases: ["toyota fortuner 2021", "toyota fortuner", "fortuner 2021", "fortuner"],
    glbPath: "/models/toyota-fortuner-2021.glb",
    modelPath: "/models/toyota-fortuner-2021.glb",
    bodyMaterialNames: ["carpaint"],
    protectedMaterialNames: [
      "r_tailight", "indicator_signal", "windows_glass", "r_glass", "tire", "chrome",
      "black", "black_int", "black_metallic_int", "leather", "stitch", "decal_int",
      "plastic_1", "acnt_int", "leather_123_All", "plastic_egg", "leather_egg", "seatbelt",
      "glass_decal", "seat_leather", "grey", "black_matt", "indicator_arrow", "ind_tailighjt"
    ],
    supportedColors: DEFAULT_COLOR_OPTIONS,
    framingMultiplier: 1.05,
    fov: 34,
  },
];

function cleanString(str?: string | null): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Central 3D vehicle model resolver.
 * Exact, case-insensitive, whitespace-trimmed, alias-driven matching.
 * Returns null if the vehicle does not match any registered 3D model.
 */
export function resolveVehicle3DModel(
  make?: string | null,
  model?: string | null,
  nickname?: string | null,
  year?: string | number | null
): VehicleModelConfig | null {
  const cleanMake = cleanString(make);
  const cleanModel = cleanString(model);
  const cleanNick = cleanString(nickname);
  const cleanYear = cleanString(year ? String(year) : "");

  if (!cleanMake && !cleanModel && !cleanNick) {
    return null;
  }

  const fullText = `${cleanMake} ${cleanModel} ${cleanNick} ${cleanYear}`.trim();

  // 1. Nissan Terra
  if (
    (cleanMake.includes("nissan") && cleanModel.includes("terra")) ||
    fullText.includes("nissan terra") ||
    (cleanMake === "nissan" && cleanModel === "terra")
  ) {
    return VEHICLE_MODELS.find((m) => m.id === "nissan-terra") || null;
  }

  // 2. Red Sedan
  if (
    fullText.includes("red sedan") ||
    (cleanMake === "red sedan" && cleanModel === "sedan") ||
    (cleanMake === "red sedan" && !cleanModel)
  ) {
    return VEHICLE_MODELS.find((m) => m.id === "red-sedan") || null;
  }

  // 3. Honda Accord Euro-R '02 (Requires Euro-R / Euro R identity)
  if (
    fullText.includes("euro r") ||
    fullText.includes("euror") ||
    (cleanMake.includes("honda") && cleanModel.includes("euro"))
  ) {
    return VEHICLE_MODELS.find((m) => m.id === "honda-accord-euro-r-2002") || null;
  }

  // 4. Honda Civic Type R '98 (Requires Type R / Typer identity)
  if (
    fullText.includes("type r") ||
    fullText.includes("typer") ||
    (cleanMake.includes("honda") && cleanModel.includes("type r"))
  ) {
    return VEHICLE_MODELS.find((m) => m.id === "honda-civic-type-r-1998") || null;
  }

  // 5. Honda Vezel e:HEV RS
  if (
    fullText.includes("vezel") ||
    fullText.includes("hr v") ||
    fullText.includes("hrv") ||
    (cleanMake.includes("honda") && cleanModel.includes("vezel"))
  ) {
    return VEHICLE_MODELS.find((m) => m.id === "honda-vezel-ehev-rs") || null;
  }

  // 6. Toyota Fortuner 2021
  if (
    fullText.includes("fortuner") ||
    (cleanMake.includes("toyota") && cleanModel.includes("fortuner"))
  ) {
    return VEHICLE_MODELS.find((m) => m.id === "toyota-fortuner-2021") || null;
  }

  return null;
}

/** Backward compatibility alias for resolveVehicle3DModel */
export function getVehicleModelConfig(
  make?: string | null,
  model?: string | null,
  nickname?: string | null,
  year?: string | number | null
): VehicleModelConfig | null {
  return resolveVehicle3DModel(make, model, nickname, year);
}
