export type VehicleType = "Car" | "Bike";

export interface Vehicle {
  id: string;
  user_id: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  odometer_km: number;
  vehicle_type?: VehicleType;
  nickname?: string; // Frontend only (fallback placeholder)
}

export interface ServiceRecord {
  id: string;
  vehicle_id: string;
  service_date: string;
  service_type: string;
  notes: string;
}

export interface MaintenanceSchedule {
  id: string;
  vehicle_id: string;
  task_name: string;
  due_date: string;
  due_odometer_km: number;
  status: string; // 'pending' | 'completed' | etc.
}

export type SlipStatus =
  | "Uploaded"
  | "OCR running"
  | "Parsed"
  | "Confirmed"
  | "OCR failed";

export interface SlipOcrData {
  completed?: boolean;
  raw_text?: string;
  vehicle_number?: string | null;
  service_date?: string | null;
  service_type?: string | null;
  parts_replaced?: string[];
  service_cost?: number | null;
  odometer_reading?: string | number | null;
}

export interface SlipOcrRequirements {
  vehicle_numbers?: string[];
  service_dates?: string[];
  service_types?: string[];
  parts_replaced?: string[];
  service_costs?: (string | number)[];
  odometer_readings?: (string | number)[];
  fields_found?: Record<string, boolean>;
  missing_fields?: string[];
  all_requirements_found?: boolean;
}

export interface ServiceSlipUploadResponse {
  message: string;
  slip_id: string;
  filename: string;
  storage_path: string;
  bucket: string;
  user_id: string;
  status: string;
  ocr?: SlipOcrData & {
    completed?: boolean;
    requirements?: SlipOcrRequirements;
  };
  requirements?: Record<string, boolean>;
  requirements_completed?: number;
  requirements_total?: number;
  all_requirements_completed?: boolean;
  service?: {
    created: boolean;
    service_id: string | null;
    vehicle_id: string | null;
    reason: string;
  };
}

export interface SlipStatusResponse {
  id: string;
  status: string;
  updated_at?: string | null;
  error_message?: string | null;
}

export interface ServiceSlip {
  id: string;
  user_id?: string;
  service_record_id?: string | null;
  file_name?: string | null;
  storage_path?: string | null;
  image_url?: string | null;
  status?: string;
  ocr_raw_text?: string | null;
  parsed_data?: Record<string, unknown> | null;
  error_message?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface UserProfileInfo {
  name: string;
  email: string;
  phone: string;
  role: string;
  joined: string;
  avatar: string;
  coverUrl?: string | null;
  isVerified: boolean;
}

export interface RCDetails {
  registrationNumber: string;
  make: string;
  model: string;
  year: number | string;
  vin: string;
  odometer: number | string;
}

export interface InsuranceDetails {
  provider: string;
  policyNumber: string;
  startDate: string;
  expiryDate: string;
}

export interface PUCDetails {
  certificateNumber: string;
  issueDate: string;
  expiryDate: string;
  status: "Valid" | "Expired" | "Pending";
}

export interface FASTagDetails {
  provider: string;
  fastagNumber: string;
  vehicleClass: string;
  status: "Active" | "Inactive" | "Low Balance";
  lastRechargeDate?: string;
}
export interface InsuranceApiResponse {
  id: string;
  vehicle_id: string;
  insurer: string;
  policy_number: string;
  start_date: string;
  expiry_date: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PucApiResponse {
  id: string;
  vehicle_id: string;
  certificate_number: string;
  issued_date: string;
  expiry_date: string;
  emission_details: string;
  status?: string;
}
export interface FastagApiResponse {
  id: string;
  vehicle_id: string;
  tag_id: string;
  balance: number | string;
  last_recharge_date?: string | null;
  status: "Active" | "Inactive" | "Blocked" | "Low Balance";
}
export interface ChallanDetails {
  challanNumber: string;
  date: string;
  amount: number | string;
  status: "Pending" | "Paid";
}

export interface ProfileCompletionState {
  basicProfile: boolean;
  vehicleRc: boolean;
  insurance: boolean;
  puc: boolean;
  fastag: boolean;
}

export interface DiagnosisRequest {
  vehicle_id: string;
  symptom: string;
}

export interface BackendDiagnosis {
  id?: string;
  vehicle_id?: string;
  symptom?: string;
  possible_cause: string;
  recommended_action: string;
  severity: "Critical" | "Warning" | "High" | "Medium" | "Low" | "Advisory" | string;
  confidence_score: number;
  mechanic_required: boolean;
  created_at?: string;
  mechanic_disclaimer?: string;
  confidence_notes?: string | null;
}

export interface DiagnosisResponse {
  success: boolean;
  message: string;
  diagnosis: BackendDiagnosis | null;
}
// =========================================================
// NOTIFICATIONS
// =========================================================

export interface BackendNotification {
  id: string;
  user_id?: string | null;
  schedule_id?: string | null;
  channel?: string | null;
  message?: string | null;
  sent_at?: string | null;
  delivery_status?: string | null;
  notification_type?: string | null;
  reference_id?: string | null;
  created_at?: string | null;
}

export interface NotificationPreferences {
  id?: string;
  user_id?: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

// =========================================================
// SERVICE CENTERS / NEARBY SERVICES
// =========================================================

export interface ServiceCenter {
  place_id: string;
  name: string | null;
  latitude: number;
  longitude: number;
  distance_km: number;
  directions_url: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
  rating: number | null;
}

export interface NearbyServiceCentersResponse {
  latitude: number;
  longitude: number;
  radius: number;
  count: number;
  cached: boolean;
  service_centers: ServiceCenter[];
}