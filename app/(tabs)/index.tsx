/* eslint-disable no-bitwise */
import React, {Context, createContext, useEffect, useState} from "react"
import {Button, FlatList} from 'react-native'

import {BleError, BleManager, Characteristic, Device, fullUUID,} from "react-native-ble-plx"
import {ThemedText} from "@/components/ThemedText"
import {ThemedView} from "@/components/ThemedView"
import {parseCyclingPowerMeasurement, parseIndoorBikeData} from "@/components/CyclePower"
import {CYCLEOPS_CONTROL_POINT, CYCLEOPS_SERVICE, CycleOpsService} from "@/components/CycleOpsService"
import c_uuids from "@/assets/characteristic_uuids.json"
import s_uuids from "@/assets/service_uuids.json"
import {router} from "expo-router"
import {ConnectionState, DeviceConnectionState} from "@/components/ConnectionState"
import {requestPermissions} from "@/components/permissions"
import {BikeTrainer} from "@/components/BikeTrainer";
import {
    CYCLING_POWER_MEASUREMENT,
    CYCLING_POWER_SERVICE,
    CYCLING_SPEED_AND_CADENCE_SERVICE,
    FITNESS_MACHINE_SERVICE,
    INDOOR_BIKE_DATA
} from "@/components/Bluetooth_UUIDS";
import {uuid_equals} from "@/components/functions";


const SUPPORTED_SERVICES = [
    FITNESS_MACHINE_SERVICE,
    CYCLING_POWER_SERVICE,
    CYCLING_SPEED_AND_CADENCE_SERVICE,
    CYCLEOPS_SERVICE
]

interface DeviceListItem {
    item: [string, Device]
}

interface DeviceWattage {
    [key: string]: number
}

interface DeviceServices {
    [key: string]: React.JSX.Element[]
}

// export let SharedContext: Context<BikeTrainer>

const index = () => {
    const [manager] = useState(() => new BleManager())
    const [devices, setDevices] = useState<Map<string, Device>>(new Map())
    const [connectionStates, setConnectionStates] = useState<DeviceConnectionState>({})
    const [deviceServices, setDeviceServices] = useState<DeviceServices>({})
    const [scanning, setScanning] = useState(false)
    const [deviceWattage, setDeviceWattage] = useState<DeviceWattage>({})
    const [bikeTrainer, setBikeTrainer] = useState<BikeTrainer>()

    function updateConnectionState(device: Device, state: ConnectionState) {
        return setConnectionStates(prev => ({...prev, [device.id]: state}))
    }

    const checkConnectionState = async (device: Device) => {
        try {
            const isConnected = await device.isConnected()
            updateConnectionState(device, isConnected ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED)
            if (isConnected) {
                router.navigate("/(tabs)/ride")
            }
        } catch (error) {
            console.log('Error checking connection state:', error)
            updateConnectionState(device, ConnectionState.DISCONNECTED)
        }
    }


    // Start scanning for FTMS devices
    const startScan = async () => {
        const hasPermission = await requestPermissions()
        if (!hasPermission) return

        setScanning(true)
        setConnectionStates({})
        setDevices(new Map())


        manager.startDeviceScan(
            SUPPORTED_SERVICES,
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

    // Stop scanning
    const stopScan = () => {
        manager.stopDeviceScan()
        setScanning(false)
    }

    // Clean up BLE manager when component unmounts
    useEffect(() => {
        return () => {
            manager.destroy()
        }
    }, [manager])


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
                        }))
                    }
                    value = JSON.stringify(cyclingPowerMeasurement)
                    break
                case fullUUID(INDOOR_BIKE_DATA): // Indoor Bike Data
                    value = JSON.stringify(parseIndoorBikeData(characteristic?.value))
                    break
            }

            console.log(`${device_name || ''} | ${characteristic_name || ''} | ${characteristic?.uuid.slice(4, 8)}: ${value}`)
        }
    }

    const toggleDeviceConnection = async (device: Device) => {
        try {
            switch (connectionStates[device.id]) {
                case ConnectionState.DISCONNECTED:
                    await connectToDevice(device)
                    break
                case ConnectionState.CONNECTED:
                    updateConnectionState(device, ConnectionState.PENDING_DISCONNECT)
                    await manager.cancelDeviceConnection(device.id)
                    break
            }

        } catch (e) {
            console.log("FAILED TO DISCONNECT", e)
        } finally {
            await checkConnectionState(device)
        }
    }


    const connectToDevice = async (device: Device) => {
        updateConnectionState(device, ConnectionState.PENDING_CONNECT)
        const deviceConnection = await manager.connectToDevice(device.id)
        await deviceConnection.discoverAllServicesAndCharacteristics()

        const services = (await device.services())
            .filter(s => SUPPORTED_SERVICES.some(u => uuid_equals(u, s.uuid)))

        const service_ids_to_characteristics: { [key: string]: Characteristic[] } =
            Object.fromEntries(await Promise.all(services.map(async s => {
                const characteristics = (await s.characteristics())
                // .filter(c =>
                //     c_uuids.some(u =>
                //         uuid_equals(u.uuid, c.uuid)
                //     ))
                await Promise.all(characteristics.map(async c => {
                    if (uuid_equals(c.uuid, CYCLEOPS_CONTROL_POINT)) {
                        const cos: BikeTrainer = new CycleOpsService(manager, device, c, updateConnectionState)
                        // SharedContext = createContext(cos);
                        setBikeTrainer(cos)
                    }
                    device.monitorCharacteristicForService(
                        s.uuid,
                        c.uuid,
                        onDataUpdateWithName(
                            device.name,
                            c_uuids.find(u => uuid_equals(u.uuid, c.uuid))?.name ?? 'UNKNOWN'
                        )
                    )
                }))

                return [s.id, characteristics]
            })))


        const serviceElements = services.map(s =>
            <ThemedView key={`${s.id}_view`}>
                <ThemedText key={`${s.id}_title`} style={{fontSize: 14, fontWeight: 'bold'}}>  {
                    s_uuids.find(u => uuid_equals(u.uuid, s.uuid))?.name ?? s.uuid
                }</ThemedText>
                {service_ids_to_characteristics[s.id].map(c =>
                    <ThemedText key={c.id}>    {
                        c_uuids.find(u => uuid_equals(u.uuid, c.uuid))?.name ?? c.uuid
                    }</ThemedText>
                )}
            </ThemedView>
        )
        setDeviceServices(prev => ({...prev, [device.id]: serviceElements}))
    }

    // Render each device
    const renderDevice = ({item}: DeviceListItem) => {
        const device = item[1]

        return (
            <ThemedView style={{padding: 10, borderBottomWidth: 1, borderBottomColor: '#ccc'}}>
                <ThemedText style={{
                    fontSize: 16,
                    fontWeight: connectionStates[device.id] == ConnectionState.CONNECTED ? 'bold' : 'normal'
                }}>
                    {device.name || 'Unnamed Device'}
                </ThemedText>
                <ThemedText>  {device.rssi} dBm</ThemedText>
                <ThemedText>  {deviceWattage[device.id] || '0'} watts</ThemedText>
                {deviceServices[device.id]}
                <Button
                    title={connectionStates[device.id] ?? 'Connect'}
                    onPress={() => toggleDeviceConnection(device)}
                    disabled={connectionStates[device.id] in [ConnectionState.PENDING_CONNECT, ConnectionState.PENDING_DISCONNECT]}
                />
                <Button
                    title={'SET POWER TO 100'} onPress={() => bikeTrainer!.target_power = 100}
                    disabled={!bikeTrainer}
                />
            </ThemedView>
        )
    }

    return (
        <ThemedView style={{flex: 1, padding: 20}}>
            <Button
                title={'Scan for Bike Trainers'}
                onPress={scanning ? stopScan : startScan}
                disabled={scanning}
            />
            <FlatList
                data={Array.from(devices.entries()).sort(([, a], [, b]) => (b?.rssi ?? -100) - (a?.rssi ?? -100))}
                renderItem={renderDevice}
                keyExtractor={([, device], index) => `${device.id}_${index}`}
                ListEmptyComponent={
                    <ThemedText style={{textAlign: 'center', marginTop: 20}}>
                        {scanning ? 'Scanning...' : ''}
                    </ThemedText>
                }
            />
        </ThemedView>
    )
}


export default index