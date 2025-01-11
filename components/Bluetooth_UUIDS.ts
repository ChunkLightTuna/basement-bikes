import s_uuids from "@/assets/service_uuids.json";
import c_uuids from "@/assets/characteristic_uuids.json";


export const FITNESS_MACHINE_SERVICE =
    s_uuids.find(s => s.name == "Fitness Machine")!.uuid
export const INDOOR_BIKE_DATA =
    c_uuids.find(c => c.name == "Indoor Bike Data")!.uuid
const FTF_C_UUID = '2acc'; //Fitness Machine Feature Characteristic
const FMCP_C_UUID = '2ad9' // Fitness Machine Control Point Characteristic
const FMS_C_UUID = '2ada' // Fitness Machine Status Characteristic
const SRLR_C_UUID = '2ad6' // Supported Resistance Level Range Characteristic
const SPR_C_UUID = '2ad8' // Supported Power Range Characteristic
export const CYCLING_POWER_SERVICE =
    s_uuids.find(s => s.name == "Cycling Power")!.uuid
export const CYCLING_POWER_MEASUREMENT =
    c_uuids.find(c => c.name == "Cycling Power Measurement")!.uuid
const CPF_C_UUID = '2a65' // Cycling Power Feature Characteristic
const CPCP_C_UUID = '2a66' // Cycling power Control Point
export const CYCLING_SPEED_AND_CADENCE_SERVICE =
    s_uuids.find(s => s.name == "Cycling Speed and Cadence")!.uuid
export const WAHOO_EXTENSION =
    c_uuids.find(c => c.name == "Wahoo Extension")!.uuid