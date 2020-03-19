// tslint:disable:no-any
import { EventEmitter } from '@regax/common'

export enum ConnectorEvent {
  DISCONNECT = 'disconnect',
  CONNECTION = 'connection',
}

export const CONNECTOR_DEFAULT_CLIENT_TYPE = 'ws'

export interface Connector extends EventEmitter<ConnectorEvent> {
  start(): Promise<number>
  stop(): Promise<void>
}

export interface StickyServer {
  start(): Promise<void>
  stop(): Promise<void>
}
