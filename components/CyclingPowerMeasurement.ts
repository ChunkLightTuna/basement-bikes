import {getUint24, RateAdjuster, RevsOverTime} from "@/components/functions";

const pedalPowerBalancePresent = (flags: number): boolean => ((flags >> 0) & 1) === 1;
const pedalPowerBalanceRefPresent = (flags: number): boolean => ((flags >> 1) & 1) === 1;
const accumulatedTorquePresent = (flags: number): boolean => ((flags >> 2) & 1) === 1;
const accumulatedTorqueSourcePresent = (flags: number): boolean => ((flags >> 3) & 1) === 1;
const wheelRevolutionDataPresent = (flags: number): boolean => ((flags >> 4) & 1) === 1;
const crankRevolutionDataPresent = (flags: number): boolean => ((flags >> 5) & 1) === 1;
const cadencePresent = (flags: number): boolean => ((flags >> 5) & 1) === 1;
const extremeForceMagnitudesPresent = (flags: number): boolean => ((flags >> 6) & 1) === 1;
const extremeTorqueMagnitudesPresent = (flags: number): boolean => ((flags >> 7) & 1) === 1;
const extremeAnglesPresent = (flags: number): boolean => ((flags >> 8) & 1) === 1;
const topDeadSpotAnglePresent = (flags: number): boolean => ((flags >> 9) & 1) === 1;
const bottomDeadSpotAnglePresent = (flags: number): boolean => ((flags >> 10) & 1) === 1;
const accumulatedEnergyPresent = (flags: number): boolean => ((flags >> 11) & 1) === 1;
const offsetIndicator = (flags: number): boolean => ((flags >> 12) & 1) === 1;

interface Field {
    resolution: number
    unit: '' | 'W' | 's' | 'deg' | 'kJ'
    size: 1 | 2 | 3 | 4
    type: 'Uint16' | 'Int16' | 'Uint8' | 'Uint32' | 'Uint24'
    present: (flag: number) => boolean
}

interface Fields {
    [key: string]: Field
}

const fields: Fields = {
    flags: {resolution: 1, unit: '', size: 2, type: 'Uint16', present: () => true},
    power: {resolution: 1, unit: 'W', size: 2, type: 'Int16', present: () => true},
    pedalPowerBalance: {resolution: 0.5, unit: '', size: 1, type: 'Uint8', present: pedalPowerBalancePresent},
    accumulatedTorque: {resolution: (1 / 32), unit: '', size: 2, type: 'Uint16', present: accumulatedTorquePresent},
    cumulativeWheelRevolutions: {resolution: 1, unit: '', size: 4, type: 'Uint32', present: wheelRevolutionDataPresent},
    lastWheelEventTime: {
        resolution: (1 / 2048),
        unit: 's',
        size: 2,
        type: 'Uint16',
        present: wheelRevolutionDataPresent
    },
    cumulativeCrankRevolutions: {resolution: 1, unit: '', size: 2, type: 'Uint16', present: crankRevolutionDataPresent},
    lastCrankEventTime: {
        resolution: (1 / 1024),
        unit: 's',
        size: 2,
        type: 'Uint16',
        present: crankRevolutionDataPresent
    },
    maximumForceMagnitude: {resolution: 1, unit: '', size: 2, type: 'Int16', present: extremeForceMagnitudesPresent},
    minimumForceMagnitude: {resolution: 1, unit: '', size: 2, type: 'Int16', present: extremeForceMagnitudesPresent},
    maximumTorqueMagnitude: {
        resolution: (1 / 32),
        unit: '',
        size: 2,
        type: 'Int16',
        present: extremeTorqueMagnitudesPresent
    },
    minimumTorqueMagnitude: {
        resolution: (1 / 32),
        unit: '',
        size: 2,
        type: 'Int16',
        present: extremeTorqueMagnitudesPresent
    },
    extremeAngles: {resolution: 1, unit: 'deg', size: 3, type: 'Uint24', present: extremeAnglesPresent},
    // maximumAngle:               {resolution: 1,        unit: 'deg', size: 1.5, type: 'Uint12', present: extremeAnglesPresent},
    // minimumAngle:               {resolution: 1,        unit: 'deg', size: 1.5, type: 'Uint12', present: extremeAnglesPresent},
    topDeadSpotAngle: {resolution: 1, unit: 'deg', size: 2, type: 'Uint16', present: topDeadSpotAnglePresent},
    bottomDeadSpotAngle: {resolution: 1, unit: 'deg', size: 2, type: 'Uint16', present: bottomDeadSpotAnglePresent},
    accumulatedEnergy: {resolution: 1, unit: 'kJ', size: 2, type: 'Uint16', present: accumulatedEnergyPresent},
};

type OrderType = Array<keyof Fields>;

const order: OrderType = [
    ' flags',
    'power',
    'pedalPowerBalance',
    'accumulatedTorque',
    'cumulativeWheelRevolutions',
    'lastWheelEventTime',
    'cumulativeCrankRevolutions',
    'lastCrankEventTime',
    'maximumForceMagnitude',
    'minimumForceMagnitude',
    'maximumTorqueMagnitude',
    'minimumTorqueMagnitude',
    'extremeAngles', // maybe remove those it's Uint12 + Uint12
    'topDeadSpotAngle',
    'bottomDeadSpotAngle',
    'accumulatedEnergy',
];

// Example input:
//
//
//      flags  power  wheel revs   wheel time  crank revs  crank time
//       0  1   2  3   4  5  6  7   8  9       10 11       12 13
//
// (0x) 30-00 -21-00 -2A-00-00-00  -C4-60      -12-00      -F7-04
//      48, 0, 33, 0, 42, 0, 0, 0, 196,96,      18, 0,     247, 4
// (0x) 30-00 -56-00 -00-00-00-00  -00-00      -00-00      -F7-04
//      48, 0, 86, 0,  0, 0, 0, 0,   0, 0,       0, 0,     247, 4
// (0x) 30-00 -5E-00 -03-00-00-00  -16-0B      -01-00      -0A-03
//      48, 0, 94, 0,  3, 0, 0, 0,  22,11,       1, 0,      10, 3
//
// '30-00-21-00-2A-00-00-00-C4-60-12-00-F7-04'.split('-').map(x => Number('0x'+x))
//

function CyclingPowerMeasurement(args = {}) {

    function getField(field: Field, dataview: DataView, i: number) {
        switch (field.type) {
            case 'Uint16':
                return dataview.getUint16(i, true) * field.resolution
            case 'Int16':
                return dataview.getInt16(i, true) * field.resolution
            case 'Uint8':
                return dataview.getUint8(i) * field.resolution
            case 'Uint32':
                return dataview.getUint32(i, true) * field.resolution
            case 'Uint24':
                return getUint24(dataview, i, true) * field.resolution
            default:
                throw ('unsupported field type.')
        }
    }

    const cadence = RevsOverTime({
        resolution: 1,
        maxRevs: (2 ** 16) * fields.cumulativeCrankRevolutions.resolution, // 1
        maxTime: (2 ** 16) * fields.lastCrankEventTime.resolution, // 1024
        // revs per second to revs per 60 seconds
        format: (x) => Math.round(x * 60),
    });

    const rateAdjuster = RateAdjuster({
            sensor: 'powerMeter',
            onDone: cadence.setMaxRateCount
        })
    ;

    function decode(dataview: DataView) {
        const byteLength = dataview.byteLength;

        return order.reduce(function (acc, fieldName) {
            const field = fields[fieldName];

            if ((acc.i + field.size) > byteLength) return acc;

            if (field.present(acc.flags)) {
                const value = getField(field, dataview, acc.i);
                const unit = field.unit;
                const name = fieldName;

                if (acc.i === 0) {
                    acc.flags = value;
                }

                acc.data[name] = value;

                if (name === 'lastCrankEventTime') {
                    acc.data['cadence'] = cadence.calculate(
                        acc.data['cumulativeCrankRevolutions'],
                        acc.data['lastCrankEventTime'],
                    );
                }

                acc.i += field.size;
            }

            return acc;

        }, {i: 0, flags: 0, data: {}}).data;
    }

    return Object.freeze({
        decode,
    });
}

const cyclingPowerMeasurement = CyclingPowerMeasurement();

export {
    CyclingPowerMeasurement,
    cyclingPowerMeasurement,
};

