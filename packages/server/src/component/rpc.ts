// tslint:disable:no-any
import { Client, createClient, createServer, LocalRegistry, Registry, Server, ServerServices } from '@regax/rpc'
import { EventEmitter, EventListener } from '@regax/common'
import { RPCService } from '../service/rpcService'
import { Application, RouteType, SessionFields, Component, inject, injectable } from '../api'
import { createProxy } from '../util/proxy'
import { ChannelRemote } from '../remote/frontend/channelRemote'
import { SessionRemote } from '../remote/frontend/sessionRemote'
import { RouteRemote } from '../remote/backend/routeRemote'

export enum RPCEvent {
  STARTED = 'started',
  STOPPED = 'stopped'
}
export interface RPCServices {
  channelRemote(method: string, args: any[]): Promise<any>
  sessionRemote(method: string, args: any[]): Promise<any>
  routeRemote(route: string, routeType: RouteType, sessionFields: SessionFields, args: any[], traceId: string): Promise<any>
  ping(): Promise<'pong'>
}

export interface RPCOpts {
  registry?: Registry,
  rpcDebugLog?: boolean,
  bufferMsg?: boolean,
  autoport?: boolean,
  port?: number,
  rootPath?: string, // rpc registry root path
  keepalive?: number // keep client alive
  invokeTimeout?: number // client invoke timeout
  flushInterval?: number // client use flush interval
  canInvokeLocal?: boolean // use local server when invoking local server
}

let curId = 0

@injectable()
export default class RPCComponent implements Component {
  readonly event = RPCEvent
  readonly rpcServer: Server
  readonly rpcClient: Client
  readonly rpcRegistry: Registry
  protected canInvokeLocal: boolean = true
  protected rpcServices: RPCServices
  protected started: boolean = false
  protected stopped: boolean = false
  protected emitter = new EventEmitter<RPCEvent>()
  constructor(
    @inject(Application) protected readonly app: Application,
  ) {
    const rpcOpts = app.getConfig<RPCOpts>('rpc') || {}
    if (rpcOpts.canInvokeLocal !== undefined) this.canInvokeLocal = rpcOpts.canInvokeLocal
    this.rpcServices = this.createRPCServices(app)
    this.rpcRegistry = !rpcOpts.registry ? new LocalRegistry({
      rootPath: rpcOpts.rootPath,
      logger: this.app.logger
    }) : rpcOpts.registry
    this.rpcServer = createServer({
      ...rpcOpts,
      registry: this.rpcRegistry,
      serverType: app.serverType,
      serverVersion: app.serverVersion,
      logger: this.app.logger,
      services: this.rpcServices as any,
    })
    this.rpcClient = createClient({
      ...rpcOpts,
      clientId: `client_${app.serverType}_${curId++}`,
      registry: this.rpcRegistry,
      logger: this.app.logger,
    })
  }
  rpcInvoke(serverId: string, serviceName: string, args: any[]): Promise<any> {
    // invoke from local
    if (this.canInvokeLocal && serverId === this.rpcServer.serverId) {
      return (this.rpcServices as any)[serviceName](...args)
    }
    return this.rpcClient.rpcInvoke(serverId, serviceName, args)
  }
  invokeProxy(serverId: string): RPCServices {
    return createProxy<RPCServices>((serviceName: keyof RPCServices) => {
      return (...args: any[]) => this.rpcInvoke(serverId, serviceName, args)
    })
  }
  getServersByType(serverType: string): string[] {
    if (!serverType || serverType === '*' || serverType === 'master') throw new Error('illegal serverType ' + serverType)
    let servers = this.rpcClient.getServersByType(serverType).concat(this.rpcClient.getServersByType('*'))
    if (serverType !== 'connector' && serverType !== 'gate') {
      servers = servers.concat(this.rpcClient.getServersByType('*'))
    }
    if (servers.length === 0) {
      throw new Error('[regax-rpc] cannot find server info by type:' + serverType)
    }
    return servers
  }
  onServiceRegistry(): RPCService {
    return new RPCService(this.app)
  }
  extendServices(services: ServerServices): void {
    Object.assign(this.rpcServices, services)
  }
  async onStart(): Promise<void> {
    if (this.started) return
    this.rpcRegistry.start()
    const rpcOpts = this.app.getConfig<RPCOpts>('rpc') || {}
    try {
      await this.rpcServer.start(rpcOpts.port)
      const serverInfo = this.rpcServer.serverInfo
      this.app.coreLogger.info('[regax-rpc] Regax RPC server (%s) started on %s:%s', serverInfo.serverType, serverInfo.host, serverInfo.port)
      this.app.setServerInfo(serverInfo)
    } catch (e) {
      this.app.coreLogger.error('[regax-rpc] Regax RPC server started error: ', e)
      throw e
    }
    try {
      await this.rpcClient.start()
    } catch (e) {
      this.app.coreLogger.error('[regax-rpc] Regax RPC client started error: ', e)
      throw e
    }
    this.started = true
    this.emitter.emit(RPCEvent.STARTED)
  }
  onStop(): void {
    if (!this.started || this.stopped) return
    this.stopped = true
    this.rpcRegistry.stop()
    this.rpcClient.stop()
    this.rpcServer.stop()
    this.emitter.emit(RPCEvent.STOPPED)
  }
  protected createRPCServices(app: Application): RPCServices {
    let channelRemote: ChannelRemote
    let sessionRemote: SessionRemote
    let routeRemote: RouteRemote
    return {
      channelRemote(method: keyof ChannelRemote, args: any[]): Promise<any> {
        if (!channelRemote) channelRemote = new ChannelRemote(app)
        return (channelRemote as any)[method](...args)
      },
      sessionRemote(method: keyof SessionRemote, args: any[]): Promise<any> {
        if (!sessionRemote) sessionRemote = new SessionRemote(app)
        return (sessionRemote as any)[method](...args)
      },
      routeRemote(route: string, routeType: RouteType, sessionFields: SessionFields, args: any[], traceId: string): Promise<any> {
        if (!routeRemote) routeRemote = new RouteRemote(app)
        return routeRemote.routeInvoke(route, routeType, sessionFields, args, traceId)
      },
      async ping(): Promise<'pong'> {
        return 'pong'
      },
    }
  }
  onReady(fn: EventListener): void {
    this.emitter.once(RPCEvent.STARTED, fn)
    if (this.started && !this.stopped) {
      this.emitter.emit(RPCEvent.STARTED)
    }
  }
}
