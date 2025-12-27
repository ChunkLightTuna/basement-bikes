import React, {createContext, ReactNode, useContext, useEffect, useState} from 'react';
import {BleManager, Device} from 'react-native-ble-plx';
import {ConnectionState, DeviceConnectionState} from '@/components/ConnectionState';
import {BikeTrainer} from '@/components/BikeTrainer';
import {requestPermissions} from "@/components/permissions";

interface BleContextType {
    manager: BleManager;
    // Global mapping of device IDs to their connection status
    connectionStates: DeviceConnectionState;
    // Reference to the active trainer (if any) across tabs
    bikeTrainer: BikeTrainer | null;
    setBikeTrainer: (trainer: BikeTrainer | null) => void;
    updateConnectionState: (deviceId: string, state: ConnectionState) => void;
    scanning: boolean;
    stopScan: () => void;
    startScan: (services: string[]) => Promise<void>;
    devices: Map<string, Device>;
    toggleDeviceConnection: (device: Device, connectToDevice: (device: Device) => Promise<void>) => Promise<void>;
}

const BleContext = createContext<BleContextType | undefined>(undefined);

export const BleProvider = ({children}: { children: ReactNode }) => {
    const [manager] = useState(() => new BleManager());
    const [connectionStates, setConnectionStates] = useState<DeviceConnectionState>({});
    const [bikeTrainer, setBikeTrainer] = useState<BikeTrainer | null>(null);
    const [scanning, setScanning] = useState(false)
    const [devices, setDevices] = useState<Map<string, Device>>(new Map())

    const updateConnectionState = (deviceId: string, state: ConnectionState) => {
        setConnectionStates(prev => ({...prev, [deviceId]: state}));
    };

    const resetConnectionStates = () => {
        setConnectionStates({});
    };

    const toggleDeviceConnection = async (device: Device, connectToDevice: (device: Device) => Promise<void>) => {
        try {
            switch (connectionStates[device.id]) {
                case ConnectionState.DISCONNECTED:
                    await connectToDevice(device)
                    break
                case ConnectionState.CONNECTED:
                    updateConnectionState(device.id, ConnectionState.PENDING_DISCONNECT)
                    await manager.cancelDeviceConnection(device.id)
                    break
            }

        } catch (e) {
            console.log("FAILED TO DISCONNECT", e)
        } finally {
            await checkConnectionState(device)
        }
    }


    const startScan = async (services: string[]) => {
        const hasPermission = await requestPermissions()
        if (!hasPermission) return

        setScanning(true)
        resetConnectionStates()
        setDevices(new Map())


        manager.startDeviceScan(
            services,
            {allowDuplicates: false},
            (error, device) => {
                if (error) {
                    console.log('Scan error:', error)
                    stopScan()
                    return
                }

                if (device) {
                    setDevices(prevDevices => {
                        const newDevices = new Map(prevDevices)
                        newDevices.set(device.id, device)
                        return newDevices
                    })
                    // Check connection state when device is discovered
                    checkConnectionState(device)
                }
            }
        )

        // Stop scan after 10 seconds
        setTimeout(stopScan, 10000)
    }


    const stopScan = () => {
        manager.stopDeviceScan()
        setScanning(false)
    }

    const checkConnectionState = async (device: Device) => {
        try {
            const isConnected = await device.isConnected()
            updateConnectionState(device.id, isConnected ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED)
            // if (isConnected) {
            //     router.navigate("/(tabs)/ride")
            // }
        } catch (error) {
            console.log('Error checking connection state:', error)
            updateConnectionState(device.id, ConnectionState.DISCONNECTED)
        }
    }

    // Listen for global disconnection events from the native side
    useEffect(() => {
        const subscription = manager.onStateChange((state) => {
            if (state === 'PoweredOff') {
                // Handle Bluetooth being turned off globally if needed
            }
        }, true);

        return () => {
            subscription.remove();
            manager.destroy();
        };
    }, [manager]);


    useEffect(() => {
        return () => {
            manager.destroy()
        }
    }, [manager])

    return (
        <BleContext.Provider value={{
            manager,
            connectionStates,
            bikeTrainer,
            setBikeTrainer,
            updateConnectionState,
            scanning,
            stopScan,
            startScan,
            devices,
            toggleDeviceConnection
        }}>
            {children}
        </BleContext.Provider>
    );
};

export const useBle = () => {
    const context = useContext(BleContext);
    if (!context) throw new Error('useBle must be used within a BleProvider');
    return context;
};