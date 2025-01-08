/* eslint-disable no-bitwise */
import React, {useEffect, useState} from "react";
import {Button, FlatList, PermissionsAndroid, Platform} from 'react-native';
import service_uuids from '@/assets/service_uuids.json';
import characteristic_uuids from '@/assets/characteristic_uuids.json';
import * as ExpoDevice from "expo-device";

import {BleError, BleManager, Characteristic, Device, fullUUID,} from "react-native-ble-plx";
import {ThemedText} from "@/components/ThemedText";
import {ThemedView} from "@/components/ThemedView";
import {parseCyclingPowerMeasurement, parseIndoorBikeData, uuid_equals} from "@/components/CyclePower";


const FITNESS_MACHINE_SERVICE = '1826';
const INDOOR_BIKE_DATA = '2ad2'
const FTF_C_UUID = '2acc'; //Fitness Machine Feature Characteristic
const FMCP_C_UUID = '2ad9' // Fitness Machine Control Point Characteristic
const FMS_C_UUID = '2ada' // Fitness Machine Status Characteristic
const SRLR_C_UUID = '2ad6' // Supported Resistance Level Range Characteristic
const SPR_C_UUID = '2ad8' // Supported Power Range Characteristic

const CYCLING_POWER_SERVICE = '1818';
const CYCLING_POWER_MEASUREMENT = '2a63'
const CPF_C_UUID = '2a65' // Cycling Power Feature Characteristic
const CPCP_C_UUID = '2a66' // Cycling power Control Point

const CYCLING_SPEED_AND_CADENCE_SERVICE = '1816'

const CYCLEOPS_SERVICE = 'c0f4013a-a837-4165-bab9-654ef70747c6'
const CYCLEOPS_CONTROL_POINT = 'CA31A533-A858-4DC7-A650-FDEB6DAD4C14'

const SUPPORTED_SERVICES = [
    FITNESS_MACHINE_SERVICE,
    CYCLING_POWER_SERVICE,
    CYCLING_SPEED_AND_CADENCE_SERVICE,
    CYCLEOPS_SERVICE
]

interface DeviceListItem {
    item: [string, Device];
}

interface DeviceConnectionState {
    [key: string]: boolean;
}

interface DeviceWattage {
    [key: string]: number;
}

interface DeviceServices {
    [key: string]: React.JSX.Element[]
}

const BleScanner = () => {
    const [manager] = useState(() => new BleManager());
    const [devices, setDevices] = useState<Map<string, Device>>(new Map());
    const [connectionStates, setConnectionStates] = useState<DeviceConnectionState>({});
    const [connectionPending, setConnectionPending] = useState<DeviceConnectionState>({});
    const [deviceServices, setDeviceServices] = useState<DeviceServices>({});
    const [scanning, setScanning] = useState(false);
    const [deviceWattage, setDeviceWattage] = useState<DeviceWattage>({});


    // Check connection state for a device
    const checkConnectionState = async (device: Device) => {
        try {
            const isConnected = await device.isConnected();
            setConnectionStates(prev => ({
                ...prev,
                [device.id]: isConnected
            }));
        } catch (error) {
            console.log('Error checking connection state:', error);
            setConnectionStates(prev => ({
                ...prev,
                [device.id]: false
            }));
        }
    };
    const requestAndroid31Permissions = async () => {
        const bluetoothScanPermission = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            {
                title: "Location Permission",
                message: "Bluetooth Low Energy requires Location",
                buttonPositive: "OK",
            }
        );
        const bluetoothConnectPermission = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            {
                title: "Location Permission",
                message: "Bluetooth Low Energy requires Location",
                buttonPositive: "OK",
            }
        );
        const fineLocationPermission = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
                title: "Location Permission",
                message: "Bluetooth Low Energy requires Location",
                buttonPositive: "OK",
            }
        );

        return (
            bluetoothScanPermission === "granted" &&
            bluetoothConnectPermission === "granted" &&
            fineLocationPermission === "granted"
        );
    };

    const requestPermissions = async () => {
        if (Platform.OS === "android") {
            if ((ExpoDevice.platformApiLevel ?? -1) < 31) {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    {
                        title: 'Bluetooth Permission',
                        message: "Bluetooth Low Energy requires Location",
                        buttonNeutral: 'Ask Me Later',
                        buttonNegative: 'Cancel',
                        buttonPositive: 'OK',
                    }
                );
                return granted === PermissionsAndroid.RESULTS.GRANTED;
            } else {
                return await requestAndroid31Permissions();
            }
        } else {
            return true;
        }
    };

    // Start scanning for FTMS devices
    const startScan = async () => {
        const hasPermission = await requestPermissions();
        if (!hasPermission) return;

        setScanning(true);
        setDevices(new Map());
        setConnectionStates({});

        manager.startDeviceScan(
            SUPPORTED_SERVICES,
            {allowDuplicates: false},
            (error, device) => {
                if (error) {
                    console.log('Scan error:', error);
                    stopScan();
                    return;
                }

                if (device) {
                    setDevices(prevDevices => {
                        const newDevices = new Map(prevDevices);
                        newDevices.set(device.id, device);
                        return newDevices;
                    });
                    // Check connection state when device is discovered
                    checkConnectionState(device);
                }
            }
        );

        // Stop scan after 10 seconds
        setTimeout(stopScan, 10000);
    };

    // Stop scanning
    const stopScan = () => {
        manager.stopDeviceScan();
        setScanning(false);
    };

    // Clean up BLE manager when component unmounts
    useEffect(() => {
        return () => {
            manager.destroy();
        };
    }, [manager]);


    const onDataUpdateWithName = (device_name: string | null, characteristic_name: string | undefined) => {
        return (
            error: BleError | null,
            characteristic: Characteristic | null
        ) => {
            let value = characteristic?.value || ''

            switch (fullUUID(characteristic?.uuid || '')) {
                case fullUUID(CYCLING_POWER_MEASUREMENT): // Cycling Power Measurement
                    const cyclingPowerMeasurement = parseCyclingPowerMeasurement(characteristic?.value)
                    if (characteristic?.deviceID) {
                        setDeviceWattage(prev => ({
                            ...prev, [characteristic.deviceID]: cyclingPowerMeasurement.power
                        }));
                    }
                    value = JSON.stringify(cyclingPowerMeasurement)
                    break
                case fullUUID(INDOOR_BIKE_DATA): // Indoor Bike Data
                    value = JSON.stringify(parseIndoorBikeData(characteristic?.value))
                    break
            }

            console.log(`${device_name || ''} ${characteristic_name || ''} ${characteristic?.uuid.slice(4, 8)}: ${value}`)
        }
    }

    const disconnectFomDevice = async (device: Device) => {
        try {
            setConnectionPending(prev => ({...prev, [device.id]: true}));
            await manager.cancelDeviceConnection(device.id)
            await checkConnectionState(device)
        } catch (e) {
            console.log("FAILED TO DISCONNECT", e);
        } finally {
            setConnectionPending(prev => ({...prev, [device.id]: false}));
        }

    }
    const getServiceDeets = async (device: Device) => {
        return await Promise.all((await device.services())
            .filter(s => SUPPORTED_SERVICES.some(u => uuid_equals(u, s.uuid)))
            .map(async s => ({
                    ...s,
                    'name': service_uuids.uuids.find(u =>
                        uuid_equals(u.uuid, s.uuid)
                    )?.name,
                    characteristics: (await s.characteristics())
                        .filter(c =>
                            characteristic_uuids.uuids.some(u =>
                                uuid_equals(u.uuid, c.uuid)
                            ))
                        .map(c => ({
                            ...c,
                            'name': characteristic_uuids.uuids.find(u =>
                                uuid_equals(u.uuid, c.uuid))?.name
                        }))
                }
            )))
    }

    const connectToDevice = async (device: Device) => {
        try {
            setConnectionPending(prev => ({...prev, [device.id]: true}));
            const deviceConnection = await manager.connectToDevice(device.id);
            await deviceConnection.discoverAllServicesAndCharacteristics();

            const services = await getServiceDeets(device)

            services.forEach(s => {
                s.characteristics.forEach(c => {
                    device.monitorCharacteristicForService(
                        s.uuid,
                        c.uuid,
                        onDataUpdateWithName(device.name, c.name)
                    );
                })
            })


            const serviceElements = services.map(s =>
                <ThemedView>
                    <ThemedText style={{fontSize: 14, fontWeight: 'bold'}} key={s.uuid}> {s.name}</ThemedText>
                    {s.characteristics.map(c =>
                        <ThemedText key={c.uuid}>  {c.name}:{c.uuid.slice(4, 8)}</ThemedText>
                    )}
                </ThemedView>
            )
            setDeviceServices(prev => ({...prev, [device.id]: serviceElements}))
            await checkConnectionState(device)
        } catch (e) {
            console.log("FAILED TO CONNECT", e);
        } finally {
            setConnectionPending(prev => ({...prev, [device.id]: false}));
        }
    };

    // Render each device
    const renderDevice = ({item}: DeviceListItem) => {
        const device = item[1];

        return (
            <ThemedView style={{padding: 10, borderBottomWidth: 1, borderBottomColor: '#ccc'}}>
                <ThemedText style={{fontSize: 16, fontWeight: 'bold'}}>
                    {device.name || 'Unnamed Device'}
                </ThemedText>
                <ThemedText>
                    {connectionStates[device.id] ? ' Connected' : ' Disconnected'}
                </ThemedText>
                <ThemedText>Wattage: {deviceWattage[device.id] || '0'}</ThemedText>
                {deviceServices[device.id]}
                <Button
                    title={
                        `${connectionStates[device.id] ? 'Disconnect' : 'Connect'}${connectionPending[device.id] ? 'ing...' : ''}`
                    }
                    onPress={() => connectionStates[device.id] ? disconnectFomDevice(device) : connectToDevice(device)}
                    disabled={connectionPending[device.id]}
                />
            </ThemedView>
        );
    };

    return (
        <ThemedView style={{flex: 1, padding: 20}}>
            <Button
                title={scanning ? 'Scanning...' : 'Scan for Bike Trainers'}
                onPress={scanning ? stopScan : startScan}
                disabled={scanning}
            />
            <FlatList
                data={Array.from(devices.entries())}
                renderItem={renderDevice}
                keyExtractor={([id]) => id}
                ListEmptyComponent={
                    <ThemedText style={{textAlign: 'center', marginTop: 20}}>
                        {scanning ? 'Scanning...' : 'No devices found'}
                    </ThemedText>
                }
            />
        </ThemedView>
    );
};


export default BleScanner;