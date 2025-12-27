import * as Crypto from 'expo-crypto'
import {p256} from '@noble/curves/nist.js'
import {hkdf} from '@noble/hashes/hkdf'
import {sha256} from '@noble/hashes/sha2'
import crypto from 'react-native-quick-crypto'
import {Service} from "react-native-ble-plx"
import {ZWIFT_CONTROL_POINT_SERVICE, ZWIFT_MEASUREMENT_SERVICE} from "@/components/Bluetooth_UUIDS"
import {Alert} from "react-native"
import React from "react"
import {Buffer} from 'buffer'

export const RIDE_ON_HEADER = Buffer.from([0x52, 0x69, 0x64, 0x65, 0x4f, 0x6e, 0x01, 0x02])


export const handleZwiftHandshake = async (
    service: Service,
    setSessionKeys: React.Dispatch<React.SetStateAction<{ [deviceId: string]: Uint8Array<ArrayBufferLike> }>>
) => {
    try {
        const cryptoService = new ZwiftCryptoService()
        const localRawKey = cryptoService.getRawLocalPublicKey() // Ensure this helper exists in your service

        // 1. Send Handshake: Header + 64-byte Local Pub Key
        const handshakePacket = Buffer.concat([RIDE_ON_HEADER, Buffer.from(localRawKey)])

        await service.writeCharacteristicWithResponse(
            ZWIFT_CONTROL_POINT_SERVICE,
            handshakePacket.toString('base64')
        )

        // 2. Read Response: Expecting Header + 64-byte Device Pub Key
        const char = await service.readCharacteristic(
            ZWIFT_CONTROL_POINT_SERVICE
        )

        const responseData = Buffer.from(char.value as string, 'base64')
        const deviceKeyRaw = responseData.subarray(8, 72) // Skip "RideOn\x01\x02"

        // 3. Derive 36-byte Session Key (HKDF)
        const sessionKey = await cryptoService.deriveSessionKey(new Uint8Array(deviceKeyRaw))

        setSessionKeys(prev => ({...prev, [service.deviceID]: sessionKey}))
        console.log(`Handshake successful`)

        service.monitorCharacteristic(
            ZWIFT_MEASUREMENT_SERVICE,
            (error, characteristic) => {
                if (error) {
                    console.error(error)
                    return
                }
                if (characteristic?.value) {
                    const raw = Buffer.from(characteristic.value, 'base64')
                    const decrypted = decryptZwiftPacket(raw, sessionKey)
                    console.log("Decrypted Protobuf Payload:", Buffer.from(decrypted).toString('hex'))
                    // Next step: ControllerNotification.decode(decrypted)
                }
            }
        )

    } catch (e) {
        console.error("Handshake Failed", e)
        Alert.alert("Handshake Error", "Could not negotiate encryption with controller")
    }
}

const decryptZwiftPacket = (
    encryptedPacket: Buffer,
    sessionKey: Uint8Array
): Uint8Array => {
    const seqNumBytes = encryptedPacket.subarray(0, 4)
    const ciphertext = encryptedPacket.subarray(4)

    const key = sessionKey.slice(0, 16)
    const nonceBase = sessionKey.slice(16, 28)
    const authTag = Buffer.from(sessionKey.slice(28, 36))

    const nonce = new Uint8Array(nonceBase)
    for (let i = 0; i < 4; i++) {
        nonce[nonce.length - 1 - i] ^= seqNumBytes[i]
    }

    const decipher = crypto.createDecipheriv('aes-128-ccm', key, nonce, {
        authTagLength: 8
    })

    // @ts-ignore
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
    ])

    return new Uint8Array(decrypted)
}

export class ZwiftCryptoService {
    private readonly privateKey: Uint8Array
    private publicKey: Uint8Array // 65 bytes (with 0x04 prefix)

    constructor() {
        this.privateKey = Crypto.getRandomBytes(32)
        this.publicKey = p256.getPublicKey(this.privateKey, false)
    }

    // Returns the 64-byte raw key (no 0x04 prefix) as expected by Zwift
    getRawLocalPublicKey(): Uint8Array {
        return this.publicKey.slice(1)
    }

    async deriveSessionKey(devicePubKeyRaw: Uint8Array): Promise<Uint8Array> {
        // 1. Ensure device key is 65 bytes for the library (add 0x04 if missing)
        const formattedDeviceKey = devicePubKeyRaw.length === 64
            ? Buffer.concat([Buffer.from([0x04]), devicePubKeyRaw])
            : devicePubKeyRaw

        // 2. Compute ECDH Shared Secret
        const sharedSecret = p256.getSharedSecret(this.privateKey, formattedDeviceKey)

        // 3. Create the Salt: DevicePubKey(64) + LocalPubKey(64)
        const salt = Buffer.concat([
            Buffer.from(devicePubKeyRaw.slice(-64)),
            Buffer.from(this.getRawLocalPublicKey())
        ])

        // 4. Use HKDF-SHA256 to derive the 36-byte key
        return hkdf(sha256, sharedSecret, salt, undefined, 36)
    }
}