import fs from 'fs';
import path from 'path';

export type SchoolVehicleRecord = {
  id: string;
  school_id: string;
  reg_number: string;
  make: string;
  model?: string;
  type?: string;
  color?: string;
  capacity?: number;
  photo_url?: string | null;
  vehicle_photos?: Record<string, any> | null;
  assigned_escort_id?: string | null;
  assigned_escort_name?: string | null;
  assigned_escort_phone?: string | null;
  assigned_route_id?: string | null;
  assigned_route_name?: string | null;
  assigned_driver_name?: string;
  assigned_driver_phone?: string;
  assigned_driver_license?: string;
  roadworthiness_expiry?: string;
  insurance_status?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

const DATA_FILE = path.join(process.cwd(), 'src', 'lib', 'vehicle', 'vehicle-store.json');

export function loadVehicleFileStore(): SchoolVehicleRecord[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn('[vehicle-db] loadFileStore error:', err);
  }
  return [];
}

export function saveVehicleFileStore(records: SchoolVehicleRecord[]): void {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[vehicle-db] saveFileStore error:', err);
  }
}

export function addOrUpdateVehicleFileStore(vehicle: SchoolVehicleRecord): SchoolVehicleRecord {
  const store = loadVehicleFileStore();
  const index = store.findIndex((v) => v.id === vehicle.id || (v.reg_number && vehicle.reg_number && v.reg_number.toUpperCase() === vehicle.reg_number.toUpperCase()));

  if (index >= 0) {
    store[index] = { ...store[index], ...vehicle, updated_at: new Date().toISOString() };
    saveVehicleFileStore(store);
    return store[index];
  } else {
    const newRecord = {
      ...vehicle,
      id: vehicle.id || `veh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      created_at: vehicle.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.unshift(newRecord);
    saveVehicleFileStore(store);
    return newRecord;
  }
}
