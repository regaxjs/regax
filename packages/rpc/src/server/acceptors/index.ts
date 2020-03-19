// tslint:disable:no-any
import { EventEmitter } from '@regax/common'
import { Logger } from '@regax/logger'
// import { MqttAcceptor } from './mqttAcceptor'
import { WSAcceptor } from './wsAcceptor'
import { Tracer } from '../../util/tracer'

export interface AcceptorOpts {
  logger?: Logger
  bufferMsg?: boolean
  rpcDebugLog?: boolean
  flushInterval?: number // flush interval in ms
}

export interface AcceptorDispacher {
  (serviceName: string, args: any[], tracer?: Tracer): Promise<any>
}

export enum AcceptorEvent {
  ERROR = 'error',
  CLOSE = 'close',
  LISTENING = 'listening',
  DISCONNECT = 'disconnect',
  CONNECTION = 'connection',
}

export interface Acceptor extends EventEmitter<AcceptorEvent> {
  listen(port: number): void
  close(): void
}

export function createAcceptor(opts: AcceptorOpts, dispatcher: AcceptorDispacher): Acceptor {
  return new WSAcceptor(opts, dispatcher)
}
