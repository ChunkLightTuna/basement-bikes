import {BleManager, Characteristic, Device} from 'react-native-ble-plx';
import {useEffect, useState} from 'react';


// FTMS UUID constants
const FTMS_SERVICE_UUID = '00001826-0000-1000-8000-00805f9b34fb';
const INDOOR_BIKE_DATA_CHAR_UUID = '00002ad2-0000-1000-8000-00805f9b34fb';
const TRAINING_STATUS_CHAR_UUID = '00002ad3-0000-1000-8000-00805f9b34fb';
const CONTROL_POINT_CHAR_UUID = '00002ad9-0000-1000-8000-00805f9b34fb';

interface BikeData {
    speed?: number;        // km/h
    averageSpeed?: number; // km/h
    cadence?: number;      // rpm
    power?: number;        // watts
}

interface BleError {
    errorCode: number;
    message: string;
}

interface BikeTrainerHook {
    scanForTrainers: () => Promise<void>;
    bikeData: BikeData | null;
    isConnected: boolean;
    setTargetPower: (power: number) => Promise<void>;
    error: string | null;
}

export const useBikeTrainer = (): BikeTrainerHook => {
    const [device, setDevice] = useState<Device | null>(null);
    const [bikeData, setBikeData] = useState<BikeData | null>(null);
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const bleManager = new BleManager();

    // Parse indoor bike data characteristic
    const parseBikeData = (value: string): BikeData => {
        const data = Buffer.from(value, 'base64');
        const flags = data.readUInt16LE(0);

        let parsedData: BikeData = {};
        let offset = 2;

        // Parse according to flags
        if (flags & 0x01) { // Instantaneous Speed present
            parsedData.speed = data.readUInt16LE(offset) / 100;
            offset += 2;
        }
        if (flags & 0x02) { // Average Speed present
            parsedData.averageSpeed = data.readUInt16LE(offset) / 100;
            offset += 2;
        }
        if (flags & 0x04) { // Instantaneous Cadence present
            parsedData.cadence = data.readUInt16LE(offset) / 2;
            offset += 2;
        }
        if (flags & 0x08) { // Instantaneous Power present
            parsedData.power = data.readUInt16LE(offset);
            offset += 2;
        }

        return parsedData;
    };

    // Scan for FTMS devices
    const scanForTrainers = async (): Promise<void> => {
        try {
            setError(null);
            await bleManager.startDeviceScan(
                [FTMS_SERVICE_UUID],
                null,
                (error: BleError | null, scannedDevice: Device | null) => {
                    if (error) {
                        setError(`Scan error: ${error.message}`);
                        return;
                    }

                    if (scannedDevice) {
                        bleManager.stopDeviceScan();
                        connectToDevice(scannedDevice);
                    }
                }
            );
        } catch (error) {
            setError(`Error starting scan: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    // Connect to device and set up notifications
    const connectToDevice = async (scannedDevice: Device): Promise<void> => {
        try {
            const connectedDevice = await scannedDevice.connect();
            const discoveredDevice = await connectedDevice.discoverAllServicesAndCharacteristics();
            setDevice(discoveredDevice);
            setIsConnected(true);
            setError(null);

            // Set up notification for indoor bike data
            discoveredDevice.monitorCharacteristicForService(
                FTMS_SERVICE_UUID,
                INDOOR_BIKE_DATA_CHAR_UUID,
                (error: BleError | null, characteristic: Characteristic | null) => {
                    if (error) {
                        setError(`Notification error: ${error.message}`);
                        return;
                    }

                    if (characteristic?.value) {
                        const data = parseBikeData(characteristic.value);
                        setBikeData(data);
                    }
                }
            );
        } catch (error) {
            setError(`Connection error: ${error instanceof Error ? error.message : String(error)}`);
            setIsConnected(false);
        }
    };

    // Set target power (for controllable trainers)
    const setTargetPower = async (power: number): Promise<void> => {
        if (!device || !isConnected) {
            setError('Device not connected');
            return;
        }

        try {
            const data = Buffer.alloc(3);
            data.writeUInt8(0x05, 0); // OpCode for Set Target Power
            data.writeUInt16LE(power, 1);

            await device.writeCharacteristicWithResponseForService(
                FTMS_SERVICE_UUID,
                CONTROL_POINT_CHAR_UUID,
                Buffer.from(data).toString('base64')
            )

            setError(null);
        } catch (error) {
            setError(`Error setting target power: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    // Cleanup on component unmount
    useEffect(() => {
        return () => {
            if (device) {
                device.cancelConnection();
            }
        };
    }, [device]);

    return {
        scanForTrainers,
        bikeData,
        isConnected,
        setTargetPower,
        error,
    };
};