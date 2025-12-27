import {BleManager, Characteristic, Device} from "react-native-ble-plx";

import {BikeTrainer} from "@/components/BikeTrainer";
import {ConnectionState} from "@/components/ConnectionState";
import {ControlMode, CycleOpsSerializer, ControlStatus} from "@/components/CycleOpsSerializer";
import {base64ToDataView, uuid_equals} from "@/components/functions";

export const CYCLEOPS_SERVICE = 'c0f4013a-a837-4165-bab9-654ef70747c6'
export const CYCLEOPS_CONTROL_POINT = 'ca31a533-a858-4dc7-a650-fdeb6dad4c14'

export class CycleOpsService implements BikeTrainer {

    // CycleOps trainers require ~3 seconds between manual target messages
    private static readonly MINIMUM_WRITE_INTERVAL = 3000; // ms
    private wattInterval: number | null = null
    private target_power_uhh: number | null = null;
    private isWriting: boolean = false;
    private readonly controlPoint
    private readonly device

    public constructor(manager: BleManager, device: Device, controlPoint: Characteristic, onDisconnect: (device_id: string, s: ConnectionState) => void) {
        if (!uuid_equals(controlPoint.uuid, CYCLEOPS_CONTROL_POINT)) {
            throw "Invalid Characteristic uuid";
        }
        this.device = device
        this.controlPoint = controlPoint

        manager.onDeviceDisconnected(device.id, (() => {
            this.stopTargetWattInterval()
            onDisconnect(device.id, ConnectionState.DISCONNECTED)
        }))
        device.monitorCharacteristicForService(
            CYCLEOPS_SERVICE,
            CYCLEOPS_CONTROL_POINT,
            this.handleValueUpdate
        )
    }


    get instantaneous_power(): () => number {
        throw new Error("Method not implemented.");
    }

    get average_power(): () => number {
        throw new Error("Method not implemented.");
    }

    get supported_power_range(): () => number {
        throw new Error("Method not implemented.");
    }


    set target_power(watts: number) {
        this.setManualPower(watts)
    }

    private stopTargetWattInterval() {
        if (this.wattInterval !== null) {
            clearInterval(this.wattInterval);
        }
    }

    private async writeTargetWatts() {
        if (this.isWriting || !this.controlPoint || this.target_power_uhh === null) {
            return;
        }

        try {
            this.isWriting = true;
            const data = CycleOpsSerializer.setControlMode(
                ControlMode.ManualPower,
                this.target_power_uhh
            );

            await this.write(data)

            this.target_power_uhh = null;
        } catch (error) {
            console.error('Failed to write target watts:', error);
            this.stopTargetWattInterval();
        } finally {
            this.isWriting = false;
        }
    }

    private async setManualPower(targetWatts: number) {
        this.target_power_uhh = targetWatts;

        // If interval is not running, start it and do initial write
        if (this.wattInterval === null) {
            await this.writeTargetWatts();
            this.wattInterval = window.setInterval(() => {
                if (this.target_power_uhh !== null && !this.isWriting) {
                    this.writeTargetWatts().catch(error => {
                        console.error('Error in interval write:', error);
                        this.stopTargetWattInterval();
                    });
                }
            }, CycleOpsService.MINIMUM_WRITE_INTERVAL);
        }
    }

    private async write(data: number[]) {
        return await this.device.writeCharacteristicWithResponseForService(
            CYCLEOPS_SERVICE,
            CYCLEOPS_CONTROL_POINT,
            btoa(String.fromCharCode.apply(null, data))
        );
    }

    private async setHeadlessMode() {
        this.stopTargetWattInterval();
        if (!this.controlPoint) return;

        try {
            const data = CycleOpsSerializer.setControlMode(
                ControlMode.Headless
            );

            await this.write(data);
        } catch (error) {
            console.error('Failed to set headless mode:', error);
        }
    }

    private handleValueUpdate() {
        if (!this.controlPoint?.value) {
            return ''
        }

        const value = new Uint8Array(base64ToDataView(this.controlPoint.value).buffer);

        const response = CycleOpsSerializer.readResponse(value);

        if (response) {
            switch (response.status) {
                case ControlStatus.SpeedOkay:
                    console.log('SpeedOkay')
                    break;
                case ControlStatus.SpeedUp:
                    console.log('SpeedUp')
                    break;
                case ControlStatus.SpeedDown:
                    console.log('SpeedDown')
                    break;
                case ControlStatus.RollDownInitializing:
                    console.log('RollDownInitializing')
                    break;
                case ControlStatus.RollDownInProcess:
                    console.log('RollDownInProcess')
                    break;
                case ControlStatus.RollDownPassed:
                    console.log('RollDownPassed')
                    break;
                case ControlStatus.RollDownFailed:
                    console.log('RollDownFailed')
                    break;
            }
        }
    }


}