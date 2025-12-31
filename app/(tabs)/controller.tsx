/* eslint-disable no-bitwise */
import React, {useMemo, useState} from "react"
import {Button, FlatList, Pressable, View} from 'react-native'
import {Buffer} from 'buffer'

import {BleError, Characteristic, Device, fullUUID,} from "react-native-ble-plx"
import {ThemedText} from "@/components/ThemedText"
import {ThemedView} from "@/components/ThemedView"
import c_uuids from "@/assets/characteristic_uuids.json"
import {ConnectionState} from "@/components/ConnectionState"
import {
    BATTERY_LEVEL,
    BATTERY_SERVICE_UUID,
    ZWIFT_SERVICE_UUID,
    ZWIFT_SERVICE_UUID_NEW
} from "@/components/Bluetooth_UUIDS"
import {uuid_equals} from "@/components/functions"
import {handleZwiftHandshake} from "@/components/ZwiftCryptoService"
import {useBle} from "@/components/BleContext"
import {useBottomTabBarHeight} from "@react-navigation/bottom-tabs"

const ZWIFT_SERVICES = [ZWIFT_SERVICE_UUID, ZWIFT_SERVICE_UUID_NEW]
const SUPPORTED_SERVICES = [...ZWIFT_SERVICES, BATTERY_SERVICE_UUID]

const Controllers = () => {
    const {
        manager,
        connectionStates,
        updateConnectionState,
        scanning,
        stopScan,
        startScan,
        toggleDeviceConnection
    } = useBle()
    const [deviceCharacteristics, setDeviceCharacteristics] = useState<{ [deviceId: string]: Characteristic[] }>({})
    const [devices, setDevices] = useState<{ [id: string]: Device }>({})
    const [sessionKeys, setSessionKeys] = useState<{ [deviceId: string]: Uint8Array }>({})
    type BatteryState = { [deviceId: string]: number }
    const [batteryLevels, setBatteryLevel] = useState<BatteryState>({})

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
        updateConnectionState(device.id, ConnectionState.PENDING_CONNECT)
        const deviceConnection = await manager.connectToDevice(device.id)
        await deviceConnection.discoverAllServicesAndCharacteristics()

        const services = (await device.services())
            .filter(s => SUPPORTED_SERVICES.some(u => uuid_equals(u, s.uuid)))

        const zwift_service = services.find(s => ZWIFT_SERVICES.some(u => uuid_equals(u, s.uuid)))
        if (zwift_service)
            await handleZwiftHandshake(zwift_service, setSessionKeys)

        if (services.some(s => uuid_equals(s.uuid, BATTERY_SERVICE_UUID))) {
            const char = await device.readCharacteristicForService(BATTERY_SERVICE_UUID, BATTERY_LEVEL)
            update_battery_level(char)
        }

        const allChars: Characteristic[] = []
        for (const service of services) {
            const chars = await service.characteristics()
            allChars.push(...chars)

            chars.forEach(c => {
                device.monitorCharacteristicForService(service.uuid, c.uuid, characteristic_listener)
            })
        }

        setDeviceCharacteristics(prev => ({...prev, [device.id]: allChars}))
    }

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
            const data = Buffer.from(device.manufacturerData, 'base64')
            const side_n = data[2]
            const sideLabels: Record<number, string> = {
                2: ' Right',
                3: ' Left',
                9: ' Click'
            }
            name += sideLabels[side_n] ?? ''
        }

        const chars = deviceCharacteristics[device.id] || []

        return (
            <ThemedView key={device.id} style={{padding: 10, borderBottomWidth: 1, borderBottomColor: '#ccc'}}>
                <ThemedText style={{fontSize: 16, fontWeight: 'bold'}}>{name}</ThemedText>
                <ThemedText>RSSI: {device.rssi}dBm</ThemedText>
                {chars.map(c => (
                    <ThemedText key={c.id}>  {set_label(c)}</ThemedText>
                ))}

                <Button
                    title={connectionStates[device.id] ?? 'Connect'}
                    onPress={() => toggleDeviceConnection(device, connectToDevice)}
                />
            </ThemedView>
        )
    }

    const sortedData = useMemo(() => {
        return Object.values(devices).sort((a, b) => (b.rssi ?? -100) - (a.rssi ?? -100))
    }, [devices])

    const tabBarHeight = useBottomTabBarHeight()
    return (
        <ThemedView style={{flex: 1}}>
            <FlatList
                data={sortedData}
                renderItem={({item}) => renderDevice(item)}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{paddingHorizontal: 20, paddingTop: 20}}
                ListEmptyComponent={
                    <ThemedText style={{
                        textAlign: 'center',
                        marginTop: 40,
                        fontSize: 16,
                        opacity: 0.6
                    }}>
                        {scanning ? 'Searching for controllers...' : 'No controllers found'}
                    </ThemedText>
                }
            />

            <View style={{
                paddingHorizontal: 20,
                paddingBottom: tabBarHeight + 12, // Dynamic tab bar height + small gap
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: '#e5e7eb',
                backgroundColor: '#ffffff'
            }}>
                <Pressable
                    onPress={scanning ? stopScan : () => startScan([ZWIFT_SERVICE_UUID, ZWIFT_SERVICE_UUID_NEW], setDevices)}
                    disabled={scanning}
                    style={({pressed}) => [
                        {
                            backgroundColor: scanning ? '#94a3b8' : '#3b82f6',
                            paddingVertical: 16,
                            paddingHorizontal: 24,
                            borderRadius: 12,
                            alignItems: 'center',
                            shadowColor: '#000',
                            shadowOffset: {width: 0, height: 4},
                            shadowOpacity: 0.15,
                            shadowRadius: 6,
                            elevation: 4,
                        },
                        pressed && {backgroundColor: '#2563eb', transform: [{scale: 0.98}]}
                    ]}
                >
                    <ThemedText style={{
                        color: '#ffffff',
                        fontSize: 16,
                        fontWeight: '600',
                        letterSpacing: 0.5
                    }}>
                        {scanning ? '⟳ Scanning...' : 'Scan for Zwift Play'}
                    </ThemedText>
                </Pressable>
            </View>
        </ThemedView>
    )
}

export default Controllers