// tslint:disable:no-any
import { Client, createClient, LocalRegistry, ClientOpts, Registry, ServerMap, RPC_ERROR } from '@regax/rpc'
import { ErrorCode } from '@regax/common'
import { Logger, defaultLogger } from '@regax/logger'

// export const DEFAULT_MONITOR_KEEPALIVE = 1000
export const DEFAULT_MONITOR_INVOKE_TIMEOUT = 3000

const rpcErrors = Object.values(RPC_ERROR)
export interface MonitorOpts extends ClientOpts {}

export class Monitor {
  readonly rpcClient: Client
  readonly rpcRegistry: Registry
  protected readonly logger: Logger = defaultLogger
  protected started: boolean = false
  protected stopped: boolean = false
  constructor(
    protected readonly opts: MonitorOpts = {}
  ) {
    if (opts.logger) this.logger = opts.logger
    this.rpcRegistry = opts.registry ? opts.registry : new LocalRegistry({
      rootPath: opts.registryRootPath,
      logger: this.logger,
    })
    this.rpcClient = createClient({
      ...opts,
      clientId: 'monitor_client',
      registry: this.rpcRegistry,
      // keepalive: opts.keepalive || DEFAULT_MONITOR_KEEPALIVE, // monitor keep alive
      invokeTimeout: opts.invokeTimeout || DEFAULT_MONITOR_INVOKE_TIMEOUT,
      logger: this.logger,
    })
  }
  async start(): Promise<void> {
    if (this.started) return
    this.started = true
    this.rpcRegistry.start()
    await this.rpcClient.start()
  }
  stop(): void {
    if (!this.started || this.stopped) return
    this.stopped = true
    this.rpcRegistry.stop()
    this.rpcClient.stop()
  }
  getAllServers(): Promise<ServerMap> {
    return this.rpcRegistry.getAllServers()
  }
  async checkServerAlive(serverId: string): Promise<boolean> {
    try {
      return (await this.rpcClient.rpcInvoke(serverId, 'ping')) === 'pong'
    } catch (e) {
      if (e.code === ErrorCode.TIMEOUT || rpcErrors.includes(e.code)) return false
      throw e
    }
  }
  async checkAllServersAlive(serverIds?: string[]): Promise<string[]> {
    serverIds = serverIds || Object.keys(await this.getAllServers())
    const unAliveServers: string[] = []
    for (let i = 0; i < serverIds.length; i ++) {
      const serverId = serverIds[i]
      const isAlive = await this.checkServerAlive(serverId)
      if (!isAlive) unAliveServers.push(serverId)
    }
    return unAliveServers
  }
  async clearDiedServers(serverIds?: string[]): Promise<string[]> {
    serverIds = serverIds || Object.keys(await this.getAllServers())
    const unAliveServers: string[] = []
    for (let i = 0; i < serverIds.length; i ++) {
      const serverId = serverIds[i]
      const isAlive = await this.checkServerAlive(serverId)
      if (!isAlive) {
        // remove from registry
        await this.rpcRegistry.unRegister(serverId)
        unAliveServers.push(serverId)
      }
    }
    return unAliveServers
  }
  async stopServer(serverId: string, waitTime?: number): Promise<void> {
    return this.rpcClient.rpcInvoke(serverId, 'stop', waitTime !== undefined ?  [waitTime] : [])
  }
  async restartServer(serverId: string, waitTime?: number): Promise<void> {
    return this.rpcClient.rpcInvoke(serverId, 'restart', waitTime !== undefined ?  [waitTime] : [])
  }
}
