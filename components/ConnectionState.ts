export enum ConnectionState {
    CONNECTED = 'Disconnect',
    DISCONNECTED = 'Connect',
    PENDING_CONNECT = 'Connecting',
    PENDING_DISCONNECT = 'Disconnecting',
}
export interface DeviceConnectionState {
    [key: string]: ConnectionState;
}