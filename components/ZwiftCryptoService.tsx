import * as Crypto from 'expo-crypto';
import {p256} from '@noble/curves/nist.js';
import {hkdf} from '@noble/hashes/hkdf';
import {sha256} from '@noble/hashes/sha2';
import crypto from 'react-native-quick-crypto';

export const RIDE_ON_HEADER = Buffer.from([0x52, 0x69, 0x64, 0x65, 0x4f, 0x6e, 0x01, 0x02]);

export const decryptZwiftPacket = (
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
    });

    // @ts-ignore
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
    ])

    return new Uint8Array(decrypted)
}

export class ZwiftCryptoService {
    private privateKey: Uint8Array;
    private publicKey: Uint8Array; // 65 bytes (with 0x04 prefix)

    constructor() {
        this.privateKey = Crypto.getRandomBytes(32);
        this.publicKey = p256.getPublicKey(this.privateKey, false);
    }

    // Returns the 64-byte raw key (no 0x04 prefix) as expected by Zwift
    getRawLocalPublicKey(): Uint8Array {
        return this.publicKey.slice(1);
    }

    async deriveSessionKey(devicePubKeyRaw: Uint8Array): Promise<Uint8Array> {
        // 1. Ensure device key is 65 bytes for the library (add 0x04 if missing)
        const formattedDeviceKey = devicePubKeyRaw.length === 64
            ? Buffer.concat([Buffer.from([0x04]), devicePubKeyRaw])
            : devicePubKeyRaw;

        // 2. Compute ECDH Shared Secret
        const sharedSecret = p256.getSharedSecret(this.privateKey, formattedDeviceKey);

        // 3. Create the Salt: DevicePubKey(64) + LocalPubKey(64)
        const salt = Buffer.concat([
            Buffer.from(devicePubKeyRaw.slice(-64)),
            Buffer.from(this.getRawLocalPublicKey())
        ]);

        // 4. Use HKDF-SHA256 to derive the 36-byte key
        // Note: You may need to install @noble/hashes
        return hkdf(sha256, sharedSecret, salt, undefined, 36);
    }
}