// tslint:disable:no-any
import { EventEmitter } from '@regax/common'
import { Logger } from '@regax/logger'
import { Tracer } from '../../util/tracer'
// import { MqttMailbox } from './mqttMailbox'
import { WSMailbox } from './wsMailbox'
import { ServerInfo } from '../../server/server'

export const DEFAULT_CONNECT_TIMEOUT = 5000
export const DEFAULT_KEEPALIVE = 10 * 1000
export const DEFAULT_INVOKE_TIMEOUT = 10 * 1000
export const DEFAULT_FLUSH_INTERVAL = 50

export interface MailboxOpts {
  clientId?: string,
  logger?: Logger
  bufferMsg?: boolean,
  keepalive?: number
  invokeTimeout?: number
  connectTimeout?: number
  flushInterval?: number
  rpcDebugLog?: boolean
}

export enum MailboxEvent {
  ERROR = 'error',
  CLOSE = 'close',
}

export interface Mailbox extends EventEmitter<MailboxEvent> {
  close(): void
  connect(tracer?: Tracer): Promise<void>
  send(msg: any, tracer?: Tracer): Promise<void>
}

export function createMailbox(server: ServerInfo, opts: MailboxOpts): Mailbox {
  return new WSMailbox(server, opts)
}
