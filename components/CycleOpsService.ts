import { EventEmitter } from 'events';
import {ControlStatus, CycleOpsSerializer} from "@/components/CycleOpsSerializer";
import {Characteristic} from "react-native-ble-plx";
import {base64ToDataView} from "@/components/CyclePower";


export class CycleOpsService extends EventEmitter {
    public static readonly UUID = 'c0f4013a-a837-4165-bab9-654ef70747c6';

    private static readonly CHARACTERISTIC_TYPES = {
        CONTROL_POINT: 'ca31a533-a858-4dc7-a650-fdeb6dad4c14'
    };

    // CycleOps trainers require ~3 seconds between manual target messages
    private static readonly MINIMUM_WRITE_INTERVAL = 3000; // ms
    private updateTargetWattTimer: NodeJS.Timer | null = null;
    private targetWatts: number | null = null;

    private async init() {
        try {
            // Get and setup control point characteristic
            this.controlPoint = await this.service.getCharacteristic(
                CycleOpsService.CHARACTERISTIC_TYPES.CONTROL_POINT
            );
            await this.controlPoint.startNotifications();

            // Setup value change listener
            this.controlPoint.addEventListener('characteristicvaluechanged',
                (event: Event) => this.handleValueUpdate(event));
        } catch (error) {
            console.error('Failed to initialize CycleOps service:', error);
        }
    }

    private handleValueUpdate(characteristic: Characteristic) {
        if (!characteristic.value) {
            return ''
        }

        const value = new Uint8Array(base64ToDataView(characteristic.value).buffer);

        const response = CycleOpsSerializer.readResponse(value);

        if (response) {
            switch (response.status) {
                case ControlStatus.SpeedOkay:
                    this.emit('speedStatus', 'okay');
                    break;
                case ControlStatus.SpeedUp:
                    this.emit('speedStatus', 'speedUp');
                    break;
                case ControlStatus.SpeedDown:
                    this.emit('speedStatus', 'speedDown');
                    break;
                case ControlStatus.RollDownInitializing:
                    this.emit('rollDownStatus', 'initializing');
                    break;
                case ControlStatus.RollDownInProcess:
                    this.emit('rollDownStatus', 'inProcess');
                    break;
                case ControlStatus.RollDownPassed:
                    this.emit('rollDownStatus', 'passed');
                    break;
                case ControlStatus.RollDownFailed:
                    this.emit('rollDownStatus', 'failed');
                    break;
            }
        }
    }

    private stopTargetWattTimer() {
        if (this.updateTargetWattTimer) {
            clearInterval(this.updateTargetWattTimer);
            this.updateTargetWattTimer = null;
        }
    }

    private async writeTargetWatts() {
        if (!this.controlPoint || !this.targetWatts) {
            this.stopTargetWattTimer();
            return;
        }

        try {
            const data = CycleOpsSerializer.setControlMode(
                CycleOpsSerializer.ControlMode.MANUAL_POWER,
                this.targetWatts
            );
            await this.controlPoint.writeValue(data);
            this.targetWatts = null;
        } catch (error) {
            console.error('Failed to write target watts:', error);
            this.stopTargetWattTimer();
        }
    }

    public async setHeadlessMode() {
        this.stopTargetWattTimer();
        if (!this.controlPoint) return;

        try {
            const data = CycleOpsSerializer.setControlMode(
                CycleOpsSerializer.ControlMode.HEADLESS
            );
            await this.controlPoint.writeValue(data);
        } catch (error) {
            console.error('Failed to set headless mode:', error);
        }
    }

    public async setManualPower(targetWatts: number) {
        this.targetWatts = targetWatts;

        if (!this.updateTargetWattTimer) {
            await this.writeTargetWatts();
            this.updateTargetWattTimer = setInterval(
                () => this.writeTargetWatts(),
                CycleOpsService.MINIMUM_WRITE_INTERVAL
            );
        }
    }

    public async setManualSlope(riderWeight: number, gradePercent: number) {
        this.stopTargetWattTimer();
        if (!this.controlPoint) return;

        try {
            const data = CycleOpsSerializer.setControlMode(
                CycleOpsSerializer.ControlMode.MANUAL_SLOPE,
                riderWeight,
                gradePercent
            );
            await this.controlPoint.writeValue(data);
        } catch (error) {
            console.error('Failed to set manual slope:', error);
        }
    }

    public async setPowerRange(lowerTargetWatts: number, upperTargetWatts: number) {
        this.stopTargetWattTimer();
        if (!this.controlPoint) return;

        try {
            const data = CycleOpsSerializer.setControlMode(
                CycleOpsSerializer.ControlMode.POWER_RANGE,
                lowerTargetWatts,
                upperTargetWatts
            );
            await this.controlPoint.writeValue(data);
        } catch (error) {
            console.error('Failed to set power range:', error);
        }
    }

    public async setWarmUp() {
        this.stopTargetWattTimer();
        if (!this.controlPoint) return;

        try {
            const data = CycleOpsSerializer.setControlMode(
                CycleOpsSerializer.ControlMode.WARM_UP
            );
            await this.controlPoint.writeValue(data);
        } catch (error) {
            console.error('Failed to set warm up mode:', error);
        }
    }

    public async setRollDown() {
        this.stopTargetWattTimer();
        if (!this.controlPoint) return;

        try {
            const data = CycleOpsSerializer.setControlMode(
                CycleOpsSerializer.ControlMode.ROLL_DOWN
            );
            await this.controlPoint.writeValue(data);
        } catch (error) {
            console.error('Failed to set roll down mode:', error);
        }
    }
}