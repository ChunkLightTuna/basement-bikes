import s_uuids from "@/assets/service_uuids.json";
import c_uuids from "@/assets/characteristic_uuids.json";


export const FITNESS_MACHINE_SERVICE =
    s_uuids.find(s => s.name === "Fitness Machine")!.uuid
export const INDOOR_BIKE_DATA =
    c_uuids.find(c => c.name === "Indoor Bike Data")!.uuid
export const CYCLING_POWER_SERVICE =
    s_uuids.find(s => s.name === "Cycling Power")!.uuid
export const CYCLING_POWER_MEASUREMENT =
    c_uuids.find(c => c.name === "Cycling Power Measurement")!.uuid

export const CYCLING_SPEED_AND_CADENCE_SERVICE =
    s_uuids.find(s => s.name === "Cycling Speed and Cadence")!.uuid
export const WAHOO_EXTENSION =
    c_uuids.find(c => c.name === "Wahoo Extension")!.uuid

export const ZWIFT_SERVICE_UUID = s_uuids.find(s => s.name === "Zwift Play Service")!.uuid
export const ZWIFT_SERVICE_UUID_NEW = s_uuids.find(s => s.name === "Zwift Play Service (new)")!.uuid

export const BATTERY_SERVICE_UUID = s_uuids.find(s => s.name === "Battery")!.uuid
export const BATTERY_LEVEL = c_uuids.find(c => c.name === "Battery Level")!.uuid

export const ZWIFT_MEASUREMENT_SERVICE = c_uuids.find(s => s.name === "Zwift Measurement")!.uuid
export const ZWIFT_CONTROL_POINT_SERVICE = c_uuids.find(s => s.name === "Zwift Control Point")!.uuid
export const ZWIFT_COMMAND_RESPONSE_SERVICE = c_uuids.find(s => s.name === "Zwift Command Response")!.uuid