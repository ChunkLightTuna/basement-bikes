/* eslint-disable no-bitwise */
import React, {useMemo, useState} from "react"
import {Button, FlatList} from 'react-native'
import {useBle} from "@/components/BleContext"
import {BleError, Characteristic, Device, fullUUID,} from "react-native-ble-plx"
import {ThemedText} from "@/components/ThemedText"
import {ThemedView} from "@/components/ThemedView"
import {parseCyclingPowerMeasurement, parseIndoorBikeData} from "@/components/CyclePower"
import {CYCLEOPS_CONTROL_POINT, CYCLEOPS_SERVICE, CycleOpsService} from "@/components/CycleOpsService"
import c_uuids from "@/assets/characteristic_uuids.json"
import s_uuids from "@/assets/service_uuids.json"
import {ConnectionState} from "@/components/ConnectionState"
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

interface DeviceWattage {
    [key: string]: number
}

interface DeviceServices {
    [key: string]: React.JSX.Element[]
}

const index = () => {
    const {
        manager,
        connectionStates,
        updateConnectionState,
        bikeTrainer,
        setBikeTrainer,
        scanning,
        stopScan,
        startScan,
        toggleDeviceConnection
    } = useBle();
    const [deviceServices, setDeviceServices] = useState<DeviceServices>({})
    const [deviceWattage, setDeviceWattage] = useState<DeviceWattage>({})

    const [devices, setDevices] = useState<{ [id: string]: Device }>({})

    const onDataUpdateWithName = (device_name: string | null, characteristic_name: string | undefined) => {
        return (
            error: BleError | null,
            characteristic: Characteristic | null
        ) => {
            if (error) {
                console.log(`onDataUpdateWithName: ${error.reason}`)
                return
            } else if (!characteristic) {
                console.log('onDataUpdateWithName: characteristic not found?')
                return
            }

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


    const connectToDevice = async (device: Device) => {
        updateConnectionState(device.id, ConnectionState.PENDING_CONNECT)
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
    const renderDevice = (device: Device) => {
        return (
            <ThemedView style={{padding: 10, borderBottomWidth: 1, borderBottomColor: '#ccc'}}>
                <ThemedText style={{
                    fontSize: 16,
                    fontWeight: connectionStates[device.id] === ConnectionState.CONNECTED ? 'bold' : 'normal'
                }}>
                    {device.name || 'Unnamed Device'}
                </ThemedText>
                <ThemedText>  {device.rssi} dBm</ThemedText>
                <ThemedText>  {deviceWattage[device.id] || '0'} watts</ThemedText>
                {deviceServices[device.id]}
                <Button
                    title={connectionStates[device.id] ?? 'Connect'}
                    onPress={() => toggleDeviceConnection(device, connectToDevice)}
                    disabled={connectionStates[device.id] in [ConnectionState.PENDING_CONNECT, ConnectionState.PENDING_DISCONNECT]}
                />
                <Button
                    title={'SET POWER TO 100'} onPress={() => bikeTrainer!.target_power = 100}
                    disabled={!bikeTrainer}
                />
            </ThemedView>
        )
    }

    const sortedData = useMemo(() => {
        return Object.entries(devices).sort(([, a], [, b]) => (b?.rssi ?? -100) - (a?.rssi ?? -100));
    }, [devices]);

    return (
        <ThemedView style={{flex: 1, padding: 20}}>
            <Button
                title={'Scan for Bike Trainers'}
                onPress={scanning ? stopScan : () => startScan(SUPPORTED_SERVICES, setDevices)}
                disabled={scanning}
            />
            <FlatList
                data={sortedData}
                renderItem={({item: [, device]}) => renderDevice(device)}
                keyExtractor={([id]) => id}
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