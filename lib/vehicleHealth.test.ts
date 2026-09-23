import { evaluateVehicleHealth, HealthReminderItem } from "./vehicleHealth";
import { Vehicle, MaintenanceSchedule, ServiceRecord, BackendDiagnosis } from "./types";

describe("Vehicle Health Evaluation Suite", () => {
  const mockCar: Vehicle = {
    id: "car-1",
    user_id: "u1",
    make: "Toyota",
    model: "Camry",
    year: 2022,
    vin: "TOY12345",
    odometer_km: 34000,
    vehicle_type: "Car",
  };

  const mockBike: Vehicle = {
    id: "bike-1",
    user_id: "u1",
    make: "Royal Enfield",
    model: "Hunter 350",
    year: 2023,
    vin: "RE98765",
    odometer_km: 8500,
    vehicle_type: "Bike",
  };

  test("handles null selectedVehicle with clean 'No Data' fallback", () => {
    const health = evaluateVehicleHealth(null);
    expect(health.overall.status).toBe("No Data");
    expect(health.diagnosis.hasRecord).toBe(false);
    expect(health.maintenance.status).toBe("No Schedules");
    expect(health.compliance.status).toBe("Not Configured");
  });

  test("evaluates vehicle with no records as 'No Data' without fake scores", () => {
    const health = evaluateVehicleHealth(mockCar, [], [], [], []);
    expect(health.overall.status).toBe("No Data");
    expect(health.diagnosis.status).toBe("No Diagnoses Recorded");
    expect(health.maintenance.status).toBe("No Schedules");
    expect(health.compliance.status).toBe("Not Configured");
  });

  test("evaluates Healthy status when all maintenance and documents are up to date", () => {
    const services: ServiceRecord[] = [
      {
        id: "s-1",
        vehicle_id: "car-1",
        service_date: "2026-07-15",
        service_type: "Oil & Filter Replacement",
        notes: "All good",
      },
    ];

    const reminders: HealthReminderItem[] = [
      {
        id: "rem-1",
        vehicle_id: "car-1",
        vehicleName: "Toyota Camry",
        task_name: "Insurance Policy Renewal",
        due_date: "2027-01-01",
        due_odometer_km: 0,
        status: "active",
        reminderType: "insurance",
      },
    ];

    const health = evaluateVehicleHealth(mockCar, [], services, reminders, []);
    expect(health.overall.status).toBe("Healthy");
    expect(health.overall.color).toBe("green");
    expect(health.maintenance.status).toBe("Up to Date");
    expect(health.compliance.status).toBe("Active & Valid");
  });

  test("evaluates Attention Needed when a maintenance schedule is due soon (within 30 days)", () => {
    const inTenDays = new Date();
    inTenDays.setDate(inTenDays.getDate() + 10);
    const dueDateStr = inTenDays.toISOString().split("T")[0];

    const schedules: MaintenanceSchedule[] = [
      {
        id: "sched-1",
        vehicle_id: "car-1",
        task_name: "Brake Pad Inspection",
        due_date: dueDateStr,
        due_odometer_km: 35000,
        status: "pending",
      },
    ];

    const health = evaluateVehicleHealth(mockCar, schedules, [], [], []);
    expect(health.overall.status).toBe("Attention Needed");
    expect(health.overall.color).toBe("amber");
    expect(health.maintenance.status).toBe("Due Soon");
    expect(health.maintenance.badgeText).toContain("Due Soon");
    expect(health.maintenance.nextTaskName).toBe("Brake Pad Inspection");
  });

  test("evaluates Critical status when an overdue maintenance schedule exists", () => {
    const schedules: MaintenanceSchedule[] = [
      {
        id: "sched-2",
        vehicle_id: "bike-1",
        task_name: "Chain Lubrication & Tensioning",
        due_date: "2026-01-01", // In the past
        due_odometer_km: 8000,
        status: "pending",
      },
    ];

    const health = evaluateVehicleHealth(mockBike, schedules, [], [], []);
    expect(health.overall.status).toBe("Critical");
    expect(health.overall.color).toBe("rose");
    expect(health.maintenance.status).toBe("Overdue");
    expect(health.maintenance.badgeText).toContain("Overdue");
  });

  test("evaluates Critical status when a Critical or High severity diagnosis is logged", () => {
    const diagnoses: BackendDiagnosis[] = [
      {
        id: "diag-1",
        vehicle_id: "bike-1",
        symptom: "Sudden engine knocking sound",
        possible_cause: "Piston rod bearing wear or detonation",
        recommended_action: "Immediate engine halt and workshop inspection",
        severity: "Critical",
        confidence_score: 0.95,
        mechanic_required: true,
        created_at: "2026-08-10T12:00:00Z",
      },
    ];

    const health = evaluateVehicleHealth(mockBike, [], [], [], diagnoses);
    expect(health.overall.status).toBe("Critical");
    expect(health.diagnosis.severity).toBe("Critical");
    expect(health.diagnosis.color).toBe("rose");
    expect(health.diagnosis.mechanicRequired).toBe(true);
    expect(health.diagnosis.latestSymptom).toBe("Sudden engine knocking sound");
  });

  test("evaluates Attention Needed when document is Expiring Soon", () => {
    const inFifteenDays = new Date();
    inFifteenDays.setDate(inFifteenDays.getDate() + 15);
    const dueDateStr = inFifteenDays.toISOString().split("T")[0];

    const reminders: HealthReminderItem[] = [
      {
        id: "rem-puc",
        vehicle_id: "car-1",
        vehicleName: "Toyota Camry",
        task_name: "PUC Renewal",
        due_date: dueDateStr,
        due_odometer_km: 0,
        status: "Valid",
        reminderType: "puc",
      },
    ];

    const health = evaluateVehicleHealth(mockCar, [], [], reminders, []);
    expect(health.overall.status).toBe("Attention Needed");
    expect(health.compliance.status).toBe("Expiring Soon");
    expect(health.compliance.color).toBe("amber");
  });

  test("isolates records by vehicle_id without cross-vehicle leakage", () => {
    const carSchedules: MaintenanceSchedule[] = [
      {
        id: "cs-1",
        vehicle_id: "car-1",
        task_name: "Car Transmission Fluid",
        due_date: "2026-01-01",
        due_odometer_km: 30000,
        status: "pending",
      },
    ];

    const bikeSchedules: MaintenanceSchedule[] = [
      {
        id: "bs-1",
        vehicle_id: "bike-1",
        task_name: "Bike Spark Plug Replacement",
        due_date: "2027-01-01",
        due_odometer_km: 15000,
        status: "pending",
      },
    ];

    const allSchedules = [...carSchedules, ...bikeSchedules];

    // Car should be Overdue
    const carHealth = evaluateVehicleHealth(mockCar, allSchedules, [], [], []);
    expect(carHealth.maintenance.status).toBe("Overdue");
    expect(carHealth.maintenance.nextTaskName).toBe("Car Transmission Fluid");

    // Bike should be Up to Date (schedule is in 2027)
    const bikeHealth = evaluateVehicleHealth(mockBike, allSchedules, [], [], []);
    expect(bikeHealth.maintenance.status).toBe("Up to Date");
    expect(bikeHealth.maintenance.nextTaskName).toBe("Bike Spark Plug Replacement");
  });
});
