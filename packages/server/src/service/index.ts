// tslint:disable:no-any
import { ChannelService } from './channelService'
import { ConnectionService } from './connectionService'
import { GlobalChannelService } from './globalChannelService'
import { SessionService } from './sessionService'
import { BackendSessionService } from './backendSessionService'
import { RPCService } from './rpcService'
import { MessengerService } from './messengerService'

export * from './channelService'
export * from './connectionService'
export * from './globalChannelService'
export * from './sessionService'
export * from './backendSessionService'
export * from './rpcService'
export * from './messengerService'

export interface Service {
  channel: ChannelService,
  globalChannel: GlobalChannelService,
  session: SessionService,
  backendSession: BackendSessionService,
  connection: ConnectionService,
  rpc: RPCService
  messenger: MessengerService
  [key: string]: any
}
