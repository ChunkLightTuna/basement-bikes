/* eslint-disable no-bitwise */
import React, {useMemo, useState} from "react"
import {Button, FlatList} from 'react-native'

import {BleError, Characteristic, Device, fullUUID, Service,} from "react-native-ble-plx"
import {ThemedText} from "@/components/ThemedText"
import {ThemedView} from "@/components/ThemedView"
import c_uuids from "@/assets/characteristic_uuids.json"
import {ConnectionState} from "@/components/ConnectionState"
import {
    BATTERY_LEVEL,
    BATTERY_SERVICE_UUID,
    ZWIFT_CONTROL_POINT_SERVICE,
    ZWIFT_SERVICE_UUID,
    ZWIFT_SERVICE_UUID_NEW
} from "@/components/Bluetooth_UUIDS";
import {uuid_equals} from "@/components/functions";
import {RIDE_ON_HEADER, ZwiftCryptoService} from "@/components/ZwiftCryptoService";
import {Devices, useBle} from "@/components/BleContext";

const ZWIFT_SERVICES = [ZWIFT_SERVICE_UUID, ZWIFT_SERVICE_UUID_NEW]
const SUPPORTED_SERVICES = [...ZWIFT_SERVICES, BATTERY_SERVICE_UUID]

const controllers = () => {
    const {
        manager,
        connectionStates,
        updateConnectionState,
        scanning,
        stopScan,
        startScan,
        toggleDeviceConnection
    } = useBle();
    const [deviceCharacteristics, setDeviceCharacteristics] = useState<{ [deviceId: string]: Characteristic[] }>({});
    const [devices, setDevices] = useState<Devices>({})


    type BatteryState = { [deviceId: string]: number };
    const [batteryLevels, setBatteryLevel] = useState<BatteryState>({})

    const handleZwiftHandshake = async (service: Service) => {
        const zwiftCrypto = new ZwiftCryptoService()
        const localRawKey = zwiftCrypto.getRawLocalPublicKey()

        const handshakePacket = Buffer.concat([RIDE_ON_HEADER, localRawKey])

        await service.writeCharacteristicWithResponse(
            ZWIFT_CONTROL_POINT_SERVICE,
            handshakePacket.toString('base64')
        )

        const char = await service.readCharacteristic(ZWIFT_CONTROL_POINT_SERVICE)
        const responseData = Buffer.from(char.value as string, 'base64')
        const deviceKeyRaw = responseData.subarray(8, 72)
        const sessionKey = await zwiftCrypto.deriveSessionKey(new Uint8Array(deviceKeyRaw))

        console.log(
            "Handshake Complete. Session Key (36 bytes):",
            Buffer.from(sessionKey).toString('hex')
        )
        return sessionKey
    }

    const set_label = (c: Characteristic) => {
        const label = c_uuids.find(u => uuid_equals(u.uuid, c.uuid))?.name ?? c.uuid
        console.log(`LABEL: ${label}`)
        if (uuid_equals(c.uuid, BATTERY_LEVEL)) {
            const battery_lvl = batteryLevels[c.deviceID]
            if (battery_lvl !== undefined) {
                return `${label} (${battery_lvl}%)`
            }
        }
        return label
    }

    const connectToDevice = async (device: Device) => {
        updateConnectionState(device.id, ConnectionState.PENDING_CONNECT);
        const deviceConnection = await manager.connectToDevice(device.id);
        await deviceConnection.discoverAllServicesAndCharacteristics();

        const services = (await device.services())
            .filter(s => SUPPORTED_SERVICES.some(u => uuid_equals(u, s.uuid)));

        const zwift_service = services.find(s => ZWIFT_SERVICES.some(u => uuid_equals(u, s.uuid)))
        if (zwift_service)
            await handleZwiftHandshake(zwift_service)

        if (services.some(s => uuid_equals(s.uuid, BATTERY_SERVICE_UUID))) {
            const char = await device.readCharacteristicForService(BATTERY_SERVICE_UUID, BATTERY_LEVEL);
            update_battery_level(char);
        }

        const allChars: Characteristic[] = [];
        for (const service of services) {
            const chars = await service.characteristics();
            allChars.push(...chars);

            chars.forEach(c => {
                device.monitorCharacteristicForService(service.uuid, c.uuid, characteristic_listener);
            });
        }

        setDeviceCharacteristics(prev => ({...prev, [device.id]: allChars}));
    };

    const characteristic_listener = (
        error: BleError | null,
        characteristic: Characteristic | null
    ) => {
        if (error) {
            console.log(`onDataUpdate: ${error.reason}`)
            return
        } else if (!characteristic) {
            console.log('onDataUpdate: characteristic not found?')
            return
        } else {
            console.log(c_uuids.find(u => uuid_equals(u.uuid, characteristic.uuid))?.name ?? '?characteristic?')
            console.log(characteristic.uuid.slice(4, 8))
            console.log(characteristic.value || '?value?')
        }

        switch (fullUUID(characteristic.uuid)) {
            case fullUUID(BATTERY_LEVEL):
                update_battery_level(characteristic)
                break
        }
    }

    const update_battery_level = (c: Characteristic) => {
        if (c === null || !uuid_equals(c.uuid, BATTERY_LEVEL)) return
        const battery_lvl = Buffer.from(c.value as string, 'base64').readUInt8(0)
        setBatteryLevel(prevLevels => ({
            ...prevLevels,
            [c.deviceID]: battery_lvl
        }))
    }

    // Render each device
    const renderDevice = (device: Device) => {
        let name = device.name || 'Unnamed Device'
        if (device.manufacturerData) {
            const data = Buffer.from(device.manufacturerData, 'base64');
            const side_n = data[2];
            const sideLabels: Record<number, string> = {
                2: ' Right',
                3: ' Left',
                9: ' Click'
            };
            name += sideLabels[side_n] ?? '';
        }

        const chars = deviceCharacteristics[device.id] || [];

        return (
            <ThemedView style={{padding: 10, borderBottomWidth: 1, borderBottomColor: '#ccc'}}>
                <ThemedText style={{fontSize: 16, fontWeight: 'bold'}}>{name}</ThemedText>
                <ThemedText>  {device.rssi} dBm</ThemedText>
                {chars.map(c => (
                    <ThemedText key={c.id}>  {set_label(c)}</ThemedText>
                ))}

                <Button
                    title={connectionStates[device.id] ?? 'Connect'}
                    onPress={() => toggleDeviceConnection(device, connectToDevice)}
                />
            </ThemedView>
        );
    }

    const sortedData = useMemo(() => {
        return Object.entries(devices).sort(([, a], [, b]) => (b?.rssi ?? -100) - (a?.rssi ?? -100));
    }, [devices]);

    return (
        <ThemedView style={{flex: 1, padding: 20}}>
            <Button
                title={'Scan for Controllers'}
                onPress={scanning ? stopScan : () => startScan([ZWIFT_SERVICE_UUID, ZWIFT_SERVICE_UUID_NEW], setDevices)}
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

export default controllers