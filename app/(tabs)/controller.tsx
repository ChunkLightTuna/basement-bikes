/* eslint-disable no-bitwise */
import React, {useState} from "react"
import {Button, FlatList} from 'react-native'

import {Characteristic, Device,} from "react-native-ble-plx"
import {ThemedText} from "@/components/ThemedText"
import {ThemedView} from "@/components/ThemedView"
import c_uuids from "@/assets/characteristic_uuids.json"
import s_uuids from "@/assets/service_uuids.json"
import {ConnectionState} from "@/components/ConnectionState"
import {NEW_ZWIFT_SERVICE_UUID, OLD_ZWIFT_SERVICE_UUID, ZWIFT_CONTROL_POINT} from "@/components/Bluetooth_UUIDS";
import {uuid_equals} from "@/components/functions";
import {ZwiftCryptoService} from "@/components/ZwiftCryptoService";
import {useBle} from "@/components/BleContext";

const SUPPORTED_SERVICES = [
    OLD_ZWIFT_SERVICE_UUID, NEW_ZWIFT_SERVICE_UUID
]

interface DeviceListItem {
    item: [string, Device]
}

interface DeviceServices {
    [key: string]: React.JSX.Element[]
}

const controllers = () => {
    const {
        manager,
        connectionStates,
        updateConnectionState,
        scanning,
        stopScan,
        startScan,
        devices,
        toggleDeviceConnection
    } = useBle();
    const [deviceServices, setDeviceServices] = useState<DeviceServices>({})

    const handleZwiftHandshake = async (device: any) => {
        const zwiftCrypto = new ZwiftCryptoService();

        // 1. Send Local Public Key to Zwift
        const localKey = zwiftCrypto.getLocalPublicKeyForDevice();
        await device.writeCharacteristicWithResponseForService(
            OLD_ZWIFT_SERVICE_UUID,
            ZWIFT_CONTROL_POINT,
            Buffer.from(localKey).toString('base64')
        );

        const char = await device.readCharacteristicForService(
            OLD_ZWIFT_SERVICE_UUID,
            ZWIFT_CONTROL_POINT
        );

        const deviceKeyRaw = Buffer.from(char.value, 'base64');

        const aesKey = await zwiftCrypto.deriveSessionKey(new Uint8Array(deviceKeyRaw));

        console.log("Handshake Complete. AES Key derived:", Buffer.from(aesKey).toString('hex'));
        return aesKey;
    };


    const connectToDevice = async (device: Device) => {
        updateConnectionState(device.id, ConnectionState.PENDING_CONNECT)
        const deviceConnection = await manager.connectToDevice(device.id)
        await deviceConnection.discoverAllServicesAndCharacteristics()

        const services = (await device.services())
            .filter(s => SUPPORTED_SERVICES.some(u => uuid_equals(u, s.uuid)))

        const service_ids_to_characteristics: { [key: string]: Characteristic[] } =
            Object.fromEntries(await Promise.all(services.map(async s => {
                const characteristics = (await s.characteristics())
                await Promise.all(characteristics.map(async c => {
                    device.monitorCharacteristicForService(
                        s.uuid,
                        c.uuid,
                        (_, characteristic) => console.log(`${device.name || ''} | ${c_uuids.find(u => uuid_equals(u.uuid, c.uuid))?.name ?? 'UNKNOWN'} | ${characteristic?.uuid.slice(4, 8)}: ${characteristic?.value || ''}`)
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
                    fontWeight: connectionStates[device.id] === ConnectionState.CONNECTED ? 'bold' : 'normal'
                }}>
                    {device.name || 'Unnamed Device'}
                </ThemedText>
                <ThemedText>  {device.rssi} dBm</ThemedText>
                {deviceServices[device.id]}
                <Button
                    title={connectionStates[device.id] ?? 'Connect'}
                    onPress={() => toggleDeviceConnection(device, connectToDevice)}
                    disabled={connectionStates[device.id] in [ConnectionState.PENDING_CONNECT, ConnectionState.PENDING_DISCONNECT]}
                />
            </ThemedView>
        )
    }

    return (
        <ThemedView style={{flex: 1, padding: 20}}>
            <Button
                title={'Scan for Controllers'}
                onPress={scanning ? stopScan : () => startScan(SUPPORTED_SERVICES)}
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


export default controllers