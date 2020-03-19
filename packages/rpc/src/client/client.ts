// tslint:disable:no-any
import { MailboxOpts, Mailbox } from './mailboxes'
import { EventEmitter } from '@regax/common'
import { Mailstation, MailstationEvent } from './mailstation'
import { Tracer } from '../util/tracer'
import { Logger, defaultLogger } from '@regax/logger'
import { Registry, ServerInfo } from '../registry/registry'
import { Route, defRoute, Routes } from './router'

export {
  Route,
  Routes,
}

export interface ClientOpts extends MailboxOpts {
  createMailbox?: (server: ServerInfo, opts: MailboxOpts) => Mailbox
  registry?: Registry
  registryRootPath?: string
  route?: Route
}

export enum ClientState {
  INITED,
  STARTED,
  CLOSED
}

export enum ClientEvent {
  ERROR = 'error',
  CLOSE = 'close'
}

export class Client extends EventEmitter<ClientEvent> {
  public state = ClientState.INITED
  public station: Mailstation
  public readonly clientId: string
  protected route: Route = defRoute
  protected logger: Logger = defaultLogger
  routeCache: { [key: string]: any } = {}
  constructor(
    readonly opts: ClientOpts
  ) {
    super()
    this.station = new Mailstation(opts)
    this.clientId = this.opts.clientId || ''
    if (opts.logger) this.logger = opts.logger
    if (opts.route) this.route = opts.route
    this.station.on(MailstationEvent.CLOSE, this.emit.bind(this, ClientEvent.CLOSE))
    this.station.on(MailstationEvent.ERROR, this.emit.bind(this, ClientEvent.ERROR))
  }
  async start(): Promise<void> {
    if (this.state > ClientState.INITED) {
      this.logger.warn('[regax-rpc] has started.')
      return
    }
    await this.station.start()
    this.state = ClientState.STARTED
  }
  stop(force?: boolean): void {
    if (this.state !== ClientState.STARTED) {
      this.logger.warn('[regax-rpc] client is not running now.')
      return
    }
    this.state = ClientState.CLOSED
    this.station.stop(force)
  }
  getServersByType(serverType: string): string[] {
    return this.station.serversMap[serverType] || []
  }
  async rpcInvokeByRoute(serverType: string, serviceName: string, args: any[], searchSeed?: string): Promise<any> {
    const servers = serverType === '*' ? this.getServersByType('*') : this.getServersByType(serverType).concat(this.getServersByType('*'))
    if (servers.length === 0) {
      throw new Error('[regax-rpc] cannot find server info by type:' + serverType)
    }
    const serverId = this.route(servers, { serverType, serviceName, args }, searchSeed, this)
    return this.rpcInvoke(serverId, serviceName, args)
  }
  /**
   * Do the rpc invoke directly.
   *
   * @param serverId - remote server id
   * @param serviceName - service name
   * @param args - service args
   */
  async rpcInvoke(serverId: string, serviceName: string, args: any[] = []): Promise<any> {
    let tracer: Tracer | undefined

    if (this.opts.rpcDebugLog) {
      tracer = new Tracer(this.logger, this.clientId, serverId, { service: serviceName, args })
      tracer.info('client', 'rpcInvoke', 'the entrance of rpc invoke')
    }

    if (this.state !== ClientState.STARTED) {
      if (tracer) tracer.error('client', 'rpcInvoke', 'fail to do rpc invoke for client is not running')
      this.logger.error('[regax-rpc] fail to do rpc invoke for client is not running')
      throw new Error('[regax-rpc] fail to do rpc invoke for client is not running')
    }
    return this.station.dispatch(serverId, { service: serviceName, args }, tracer)
  }
}

export function createClient(opts: ClientOpts = {}): Client {
  return new Client(opts)
}
