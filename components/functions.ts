import {fullUUID} from "react-native-ble-plx";

export function isNumber(x: any) {
    if (isNaN(x)) return false;
    return equals(typeof x, 'number');
}

export function toFixed(x: number, points = 2, fallback = 0) {
    if (!isNumber(x)) return fallback;
    const precision = 10 ** points;
    return Math.round(x * precision) / precision;
}

export function dataViewToArray(dataview: DataView) {
    return Array.from(new Uint8Array(dataview.buffer));
}


function isNull(x: any) {
    return Object.is(x, null);
}

function isUndefined(x: any) {
    return Object.is(x, undefined);
}

export function exists(x: any) {
    return !isNull(x) && !isUndefined(x);
}

export function hex(n: number) {
    return '0x' + n.toString(16).toUpperCase().padStart(2, '0');
}

export const base64ToDataView = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return new DataView(bytes.buffer);
}


export const arrayBufferToBase64 = (buffer: ArrayBufferLike) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

export const dataViewToBase64 =
    (dataView: DataView) => arrayBufferToBase64(dataView.buffer);


function clamp(lower: number, upper: number, value: number) {
    if (value >= upper) {
        return upper;
    } else if (value < lower) {
        return lower;
    } else {
        return value;
    }
}

function curry2(fn: (a1: any, a2: any) => any) {
    return function (arg1: any, arg2?: any) {
        if (exists(arg2)) {
            return fn(arg1, arg2);
        } else {
            return function (arg2: any) {
                return fn(arg1, arg2);
            };
        }
    };
}

export interface Definition {
    resolution: number;
    unit: string;
    size: number;
    min: number;
    max: number;
    default: number
}

export interface Definitions {
    power?: Definition
    circumference?: Definition
    grade?: Definition
    weight?: Definition
    crr?: Definition
    windResistance?: Definition
    windSpeed?: Definition
    intensity?: Definition
    level?: Definition
}

export function Spec(args: { definitions: Definitions }) {
    const definitions = args.definitions

    const applyResolution = curry2((prop: keyof Definitions, value: number) => {

        return value / definitions[prop]!.resolution;
    });

    const removeResolution = curry2((prop: keyof Definitions, value: number) => {
        return value * definitions[prop]!.resolution;
    });

    function encodeField(prop: keyof Definitions, input: number, transform: (n: number) => number = applyResolution(prop)) {
        const fallback = definitions[prop]!.default;
        const min = applyResolution(definitions[prop]!.min);
        const max = applyResolution(definitions[prop]!.max);
        const value = input ?? fallback;

        return Math.floor(clamp(min, max, transform(value)));
    }

    function decodeField(prop: keyof Definitions, input: number, transform = removeResolution) {
        return transform(prop, input);
    }

    return {
        definitions,
        applyResolution,
        removeResolution,
        encodeField,
        decodeField,
    };
}

export async function wait(ms: number) {
    return await new Promise(res => setTimeout(res, ms));
}

export function equals(a: any, b: any) {
    return Object.is(a, b);
}

// Helper function to read 24-bit integers
export const getUint24 = (dataView: DataView, offset: number, littleEndian: boolean): number => {
    if (littleEndian) {
        return (
            dataView.getUint8(offset) |
            (dataView.getUint8(offset + 1) << 8) |
            (dataView.getUint8(offset + 2) << 16)
        );
    } else {
        return (
            (dataView.getUint8(offset) << 16) |
            (dataView.getUint8(offset + 1) << 8) |
            dataView.getUint8(offset + 2)
        );
    }
};

export const uuid_equals = (a: string, b: string) => fullUUID(a) == fullUUID(b)


export function RevsOverTime(args: {
    resolution: number,
    format?: (n: number) => number,
    maxRevs: number,
    maxTime: number,
    rate?: number
}) {
    const defaults = {
        revs: -1,
        time: -1,
        value: 0,
        rate: 0.5, // (1024/2 / 1024), 0.5 second,
        maxRateCount: 3,
        rateCount: 0,
    };


    const format = args.format ?? ((x) => x)
    let rate = args.rate ?? 0.5

    // state
    let maxRateCount = defaults.maxRateCount;
    let rateCount = defaults.rateCount;
    let revs_1 = defaults.revs;
    let time_1 = defaults.time;
    let value = defaults.value;

    const setRevs = (revs: number) => {
        revs_1 = revs;
        return revs_1;
    };
    const setTime = (time: number) => {
        time_1 = time;
        return time_1;
    };
    const setRateCount = (count: number) => {
        rateCount = count;
        return rateCount;
    };
    const getRevs = () => revs_1;
    const getTime = () => time_1;
    const getRateCount = () => rateCount;
    const getMaxRateCount = () => maxRateCount;
    const isRolloverTime = (time_2: number) => time_2 < getTime();
    const isRolloverRevs = (revs_2: number) => revs_2 < getRevs();
    const rollOverTime = () => getTime() - args.maxTime;
    const rollOverRevs = () => getRevs() - args.maxRevs;
    // coasting or not moving
    const stillRevs = (revs_2: number) => equals(getRevs(), revs_2);
    // multiple transmissions of the same time
    const stillTime = (time: number) => equals(getTime(), time);

    function setMaxRateCount(maxCount: number) {
        maxRateCount = maxCount ?? defaults.maxRateCount;
        console.log(`maxRateCount: ${maxRateCount}`);
        return maxRateCount;
    }

    function reset() {
        setRevs(defaults.revs);
        setTime(defaults.time);
        setRateCount(defaults.rateCount);
        value = defaults.value;
        return {revs: revs_1, time: time_1};
    }

    function underRate(time: number) {
        if (equals(rateCount, maxRateCount)) {
            rateCount = 0;
            return false;
        }
        if (equals(getTime(), time)) {
            rateCount += 1;
            return true;
        }
        if ((time - getTime()) < rate) {
            rateCount += 1;
            return true;
        }
        rateCount = 0;
        return false;
    }

    function calculate(revs_2: number, time_2: number) {
        if (getRevs() < 0) setRevs(revs_2); // set initial revs
        if (getTime() < 0) setTime(time_2); // set initial time

        if (underRate(time_2)) {
            return value;
        }

        if (stillRevs(revs_2)) {
            setTime(time_2);
            value = 0;
            return value;
        }

        if (isRolloverTime(time_2)) {
            setTime(rollOverTime());
        }

        if (isRolloverRevs(revs_2)) {
            setRevs(rollOverRevs());
        }

        value = format(
            (revs_2 - getRevs()) / ((time_2 - getTime()) / args.resolution)
        );

        setRevs(revs_2);
        setTime(time_2);
        return value;
    }

    return {
        reset,
        calculate,
        setMaxRateCount,
    };
}

export function RateAdjuster(
    onDone: any = (x: number) => x,
    sensor: string = 'cscs'
) {
    const Status = {
        reading: 'reading',
        done: 'done',
        is: (expected: any, value: any) => equals(expected, value)
    };

    const defaults = {
        sampleSize: 0,
        rate: 3, // [0,1,2,3]
        cutoff: 20,
        maxStillTime: 3000, // ms
        sensor: 'cscs',
        onDone: ((x: number) => x),
    };

    let _sample: Sample[] = [];
    let _sampleSize = defaults.sampleSize;
    let _rate = defaults.rate;
    let _maxStillTime = defaults.maxStillTime;

    let _cutoff = defaults.cutoff;
    let _status = Status.reading;

    const setCutoff = (count: number) => _cutoff = count;
    const setMaxStillTime = (ms: number) => _maxStillTime = ms;
    const getSampleSize = () => _sampleSize;
    const getSample = () => _sample;
    const getRate = () => _rate;
    const getStatus = () => _status;
    const getCutoff = () => _cutoff;
    const getMaxStillTime = (ms: number) => _maxStillTime;
    const isDone = () => equals(_status, Status.done);

    function reset() {
        _sample = [];
        _sampleSize = defaults.sampleSize;
        _rate = defaults.rate;
        _status = Status.reading;
    }

    interface Sample {
        ts: number,
        r: number,
        t: number,
        c: number
    }

    function clamp(lower: number, upper: number, value: number) {
        if (value >= upper) {
            return upper;
        } else if (value < lower) {
            return lower;
        } else {
            return value;
        }
    }


    function timestampAvgDiff(sample: Sample[]) {
        return sample.reduce(function (acc, x, i, xs) {
            let tsd = 1000;
            if (i > 0) {
                tsd = xs[i].ts - xs[i - 1].ts;
            }
            acc += (tsd - acc) / (i + 1);
            return acc;
        }, 0);
    }

    function calculate(sample: Sample[]) {
        const tsAvgDiff = timestampAvgDiff(sample);

        const maxRateCount = clamp(2, 15, Math.round(_maxStillTime / tsAvgDiff) - 1);

        console.log(`rateAdjuster on: ${sensor} tsAvgDiff: ${tsAvgDiff} result: ${maxRateCount}`);

        return maxRateCount;
    }

    function update(value: Sample) {
        if (isDone()) return;

        _sample.push(value);
        _sampleSize += 1;

        if (_sampleSize >= _cutoff) {
            _status = Status.done;
            _rate = calculate(_sample);
            onDone(_rate);
        }
    };

    return Object.freeze({
        reset,
        isDone,
        timestampAvgDiff,
        calculate,
        update,
    });
}