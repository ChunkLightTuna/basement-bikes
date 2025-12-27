// Convert base64 to ArrayBuffer/DataView
import {base64ToDataView, getUint24} from "@/components/functions";


// Parse the cycling power measurement
export const parseCyclingPowerMeasurement = (value: string | null | undefined) => {
    if (!value) {
        return ''
    }
    const data = base64ToDataView(value);

    // Read flags (first 2 bytes)
    const flags = data.getUint16(0, true); // true for little-endian

    // Read instantaneous power (next 2 bytes)
    const power = data.getInt16(2, true);

    // Additional fields based on flags...
    let offset = 4;
    const result: any = {
        power: power // watts
    };

    // If bit 0 is set, Pedal Power Balance is present
    if (flags & 0x0001) {
        result.pedalPowerBalance = data.getUint8(offset++);
    }

    // If bit 1 is set, Accumulated Torque is present
    if (flags & 0x0002) {
        result.accumulatedTorque = data.getUint16(offset, true);
        offset += 2;
    }

    // If bit 2 is set, Wheel Revolution Data is present
    if (flags & 0x0004) {
        result.wheelRevolutions = data.getUint32(offset, true);
        result.wheelEventTime = data.getUint16(offset + 4, true);
        offset += 6;
    }

    // If bit 3 is set, Crank Revolution Data is present
    if (flags & 0x0008) {
        result.crankRevolutions = data.getUint16(offset, true);
        result.crankEventTime = data.getUint16(offset + 2, true);
        offset += 4;
    }

    return result;
};

export const parseIndoorBikeData = (value: string | null | undefined) => {
    if (!value) {
        return ''
    }
    const data = base64ToDataView(value);

    const flags = data.getUint16(0, true);
    let offset = 2;

    const result: any = {};

    if (flags & 0x0001) {
        result.instantaneousSpeed = data.getUint16(offset, true) / 100; // km/h
        offset += 2;
    }

    if (flags & 0x0002) {
        result.averageSpeed = data.getUint16(offset, true) / 100; // km/h
        offset += 2;
    }

    if (flags & 0x0004) {
        result.instantaneousCadence = data.getUint16(offset, true) / 2; // rpm
        offset += 2;
    }

    if (flags & 0x0008) {
        result.averageCadence = data.getUint16(offset, true) / 2; // rpm
        offset += 2;
    }

    if (flags & 0x0010) {
        result.totalDistance = getUint24(data, offset, true); // meters
        offset += 3;
    }

    if (flags & 0x0020) {
        result.resistanceLevel = data.getUint16(offset, true);
        offset += 2;
    }

    if (flags & 0x0040) {
        result.instantaneousPower = data.getInt16(offset, true); // watts
        offset += 2;
    }

    if (flags & 0x0080) {
        result.averagePower = data.getInt16(offset, true); // watts
        offset += 2;
    }

    if (flags & 0x0100) {
        result.totalEnergy = data.getUint16(offset, true); // calories
        result.energyPerHour = data.getUint16(offset + 2, true); // calories per hour
        result.energyPerMinute = data.getUint8(offset + 4); // calories per minute
        offset += 5;
    }

    if (flags & 0x0200) {
        result.heartRate = data.getUint8(offset); // bpm
        offset += 1;
    }

    if (flags & 0x0400) {
        result.metabolicEquivalent = data.getUint8(offset) / 10;
        offset += 1;
    }

    if (flags & 0x0800) {
        result.elapsedTime = data.getUint16(offset, true); // seconds
        offset += 2;
    }

    if (flags & 0x1000) {
        result.remainingTime = data.getUint16(offset, true); // seconds
        offset += 2;
    }

    return result;
};