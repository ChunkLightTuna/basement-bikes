import * as Crypto from 'expo-crypto';
import {p256} from '@noble/curves/nist.js';
import {Buffer} from 'buffer';

export class ZwiftCryptoService {
    private privateKey: Uint8Array;
    private publicKey: Uint8Array;
    private sharedSecret: Uint8Array | null = null;

    constructor() {
        // 1. Generate local keypair immediately on instantiation
        this.privateKey = Crypto.getRandomBytes(32);
        this.publicKey = p256.getPublicKey(this.privateKey, false); // 'false' for uncompressed 65-byte
    }

    /**
     * Returns the public key formatted for the Zwift 'Control Point'
     * The blog indicates Zwift expects the 65-byte uncompressed key.
     */
    getLocalPublicKeyForDevice(): Uint8Array {
        return this.publicKey;
    }

    /**
     * Processes the public key received from the Zwift Controller (Command Response)
     * @param devicePubKeyRaw The 65-byte raw value from the BLE characteristic
     */
    async deriveSessionKey(devicePubKeyRaw: Uint8Array): Promise<Uint8Array> {
        // 1. Compute the raw ECDH shared secret
        const sharedSecret = p256.getSharedSecret(this.privateKey, devicePubKeyRaw);

        // 2. Convert Uint8Array to Hex string for expo-crypto
        // We use Buffer for a clean conversion
        const hexSecret = Buffer.from(sharedSecret).toString('hex');

        // 3. Hash the hex string (tell expo-crypto the input is Hex)
        const hashHex = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            hexSecret,
            {encoding: Crypto.CryptoEncoding.HEX}
        );

        // 4. Convert the resulting Hex hash back to Uint8Array and take 16 bytes
        return new Uint8Array(Buffer.from(hashHex, 'hex').slice(0, 16));
    }
}