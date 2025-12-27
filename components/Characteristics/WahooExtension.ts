//
// Wahoo Cycling Power Service
//
import {CYCLING_POWER_MEASUREMENT, WAHOO_EXTENSION} from "@/components/Bluetooth_UUIDS";
import {arrayBufferToBase64, wait} from "@/components/functions";
import {cyclingPowerMeasurement as cyclingPowerMeasurementParser} from "@/components/CyclingPowerMeasurement";
import {control as controlParser} from '@/components/Characteristics/WahooExtensionControlPoint';
import {Service} from "react-native-ble-plx";

const ControlMode = {
    erg: 'erg',
    sim: 'sim',
    resistance: 'resistance',
    virtualGear: 'virtualGear',
};

export interface Msg {
    status: string
    request: string
    value?: number
}


async function WCPS(cyclingPowerService: Service, onData: ((s: string) => void)) {
    const characteristic = await cyclingPowerService.characteristics()
        .then(cs => cs.find(c => c.uuid === WAHOO_EXTENSION)!)


    // config
    const txRate = 1000;

    // private state
    let controlMode = ControlMode.sim;
    let q: { command: string; params: { grade: any } }[] = [];
    let msgSeqLock = false;

    // end private state

    function onControlResponse(msg: Msg) {
        // let control = cyclingPowerService.characteristics.control;

        if (msgSeqLock) {
            if (msg.request === 'setSimMode') {
                if (msg.status === 'success') {
                    msgSeqLock = false;
                    setSimulation(q.pop()?.params ?? {grade: 0});
                    return;
                } else {
                    msgSeqLock = true;
                    setSimMode();
                    return;
                }
            }
        }

        // control.release();
    }

    // Void -> Bool
    async function protocol() {
        // TODO: return false if any of those fails or
        // returns false and dicsonnect the device
        await requestControl();
        await wait(txRate);
        await setUser();
        await wait(txRate);
        await setWindResistance();
        await wait(txRate);
        await setWheelCircumference();

        return true;
    }

    const spec = {
        measurement: {
            uuid: CYCLING_POWER_MEASUREMENT,
            notify: {callback: onData, parser: cyclingPowerMeasurementParser},
        },
        control: {
            uuid: WAHOO_EXTENSION,
            notify: {callback: onControlResponse, parser: controlParser.response},
        },
    };


    // methods

    // {WindSpeed: Float, Grade: Float, Crr: Float, WindResistance: Float} -> Void
    function setSimulation(parameters: { grade: number }) {
        // const control = service.characteristics.control;
        // if (!exists(control) || !control.isReady() || msgSeqLock) return false;

        const gradeParams = {grade: parameters.grade};

        // if in erg mode -> init sim mode -> send grade
        // else send grade
        if (controlMode === ControlMode.sim) {
            characteristic.writeWithResponse(
                arrayBufferToBase64(
                    controlParser.grade.encode(gradeParams)
                )
            )
            control.write(controlParser.grade.encode(gradeParams));
            control.block();
        } else {
            msgSeqLock = true;
            q.push({command: "setSimulation", params: gradeParams});
            setSimMode();
        }
    }

    // {resistance: Int} -> Void
    function setResistanceTarget(args = {}) {
        const control = service.characteristics.control;
        control.write(controlParser.loadIntensity.encode({
            intensity: (args.resistance / 100),
        }));
        controlMode = ControlMode.resistance;
        // control.block();
    }

    // {power: Int} -> Void
    function setPowerTarget(args = {}) {
        const control = service.characteristics.control;
        control.write(controlParser.setERG.encode(args));
        controlMode = ControlMode.erg;
        // control.block();
    }

    // {weigth: Float, crr: Float, windResistance: Float} -> Void
    function setSimMode(args = {}) {
        const control = service.characteristics.control;
        const weight = userData.userWeight() + userData.bikeWeight();
        control.write(controlParser.sim.encode({
            weight,
            crr: args.crr,
            windResistance: args.windResistance
        }));
        controlMode = ControlMode.sim;
    }

    function setUser() {
        setSimMode();
    }

    async function requestControl() {
        const control = service.characteristics.control;

        return await control.write(controlParser.requestControl.encode());
    }

    async function setWindResistance() {
        const control = service.characteristics.control;

        return await control.write(controlParser.windSpeed.encode({windSpeed: 0}));
    }

    async function setWheelCircumference() {
        const control = service.characteristics.control;

        return await control.write(
            controlParser.wheelCircumference.encode({
                circumference: controlParser.wheelCircumference.definitions.circumference.default,
            })
        );
    }

    // end methods

    return Object.freeze({
        ...service, // WCPS will have all the public methods and properties of Service
        setSimulation,
        setResistanceTarget,
        setPowerTarget,
        setUser,
        setWindResistance,
        setWheelCircumference,
        requestControl,
    });
}

export default WCPS;
