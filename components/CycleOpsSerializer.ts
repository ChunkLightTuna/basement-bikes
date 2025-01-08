export enum ControlMode {
    Headless = 0x00,
    ManualPower = 0x01,
    ManualSlope = 0x02,
    PowerRange = 0x03,
    WarmUp = 0x04,
    RollDown = 0x05,
}

export enum ControlStatus {
    SpeedOkay = 0x00,
    SpeedUp = 0x01,
    SpeedDown = 0x02,
    RollDownInitializing = 0x03,
    RollDownInProcess = 0x04,
    RollDownPassed = 0x05,
    RollDownFailed = 0x06,
}

class Response {
    mode: number = ControlMode.Headless;
    status: number = ControlStatus.SpeedOkay;
    parameter1: number = 0;
    parameter2: number = 0;
}

export class CycleOpsSerializer {
    static setControlMode(
        mode: number,
        parameter1: number = 0,
        parameter2: number = 0
    ): number[] {
        return [
            0x00,
            0x10,
            mode,
            parameter1 & 0xff,
            (parameter1 >> 8) & 0xff,
            parameter2 & 0xff,
            (parameter2 >> 8) & 0xff,
            0x00,
            0x00,
            0x00,
        ];
    }

    static readResponse(data: Uint8Array): Response | null {
        const bytes = Array.from(data);
        let index = 0;

        if (bytes.length > 9) {
            const responseCode = bytes[index++] | (bytes[index++] << 8);
            const commandIdRaw = bytes[index++] | (bytes[index++] << 8);

            if (commandIdRaw === 0x1000) {
                const controlRaw = bytes[index++];
                const parameter1 = bytes[index++] | (bytes[index++] << 8);
                const parameter2 = bytes[index++] | (bytes[index++] << 8);
                const statusRaw = bytes[index++];

                const controlMode = Object.values(ControlMode).includes(
                    controlRaw
                )
                    ? controlRaw
                    : null;
                const status = Object.values(ControlStatus).includes(
                    statusRaw
                )
                    ? statusRaw
                    : null;

                if (controlMode !== null && status !== null) {
                    const response = new Response();
                    response.mode = controlMode;
                    response.status = status;
                    response.parameter1 = parameter1;
                    response.parameter2 = parameter2;
                    return response;
                }
            }
        }

        return null;
    }
}
