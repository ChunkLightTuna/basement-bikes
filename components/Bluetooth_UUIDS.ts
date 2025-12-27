import s_uuids from "@/assets/service_uuids.json";
import c_uuids from "@/assets/characteristic_uuids.json";


export const FITNESS_MACHINE_SERVICE =
    s_uuids.find(s => s.name === "Fitness Machine")!.uuid
export const INDOOR_BIKE_DATA =
    c_uuids.find(c => c.name === "Indoor Bike Data")!.uuid
const FTF_C_UUID = '2ACC'; //Fitness Machine Feature Characteristic
const FMCP_C_UUID = '2AD9' // Fitness Machine Control Point Characteristic
const FMS_C_UUID = '2ADA' // Fitness Machine Status Characteristic
const SRLR_C_UUID = '2AD6' // Supported Resistance Level Range Characteristic
const SPR_C_UUID = '2AD8' // Supported Power Range Characteristic
export const CYCLING_POWER_SERVICE =
    s_uuids.find(s => s.name === "Cycling Power")!.uuid
export const CYCLING_POWER_MEASUREMENT =
    c_uuids.find(c => c.name === "Cycling Power Measurement")!.uuid
const CPF_C_UUID = '2A65' // Cycling Power Feature Characteristic
const CPCP_C_UUID = '2A66' // Cycling power Control Point
export const CYCLING_SPEED_AND_CADENCE_SERVICE =
    s_uuids.find(s => s.name === "Cycling Speed and Cadence")!.uuid
export const WAHOO_EXTENSION =
    c_uuids.find(c => c.name === "Wahoo Extension")!.uuid

export const OLD_ZWIFT_SERVICE_UUID = "00000001-19ca-4651-86e5-fa29dcdd09d1"
export const NEW_ZWIFT_SERVICE_UUID = "FC82"

export const ZWIFT_MEASUREMENT = "00000002-19ca-4651-86e5-fa29dcdd09d1"
export const ZWIFT_CONTROL_POINT = "00000003-19ca-4651-86e5-fa29dcdd09d1"
export const ZWIFT_COMMAND_RESPONSE = "00000004-19ca-4651-86e5-fa29dcdd09d1"