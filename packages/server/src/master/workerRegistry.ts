import { Registry, RegistryEvent, RegistryOpts, ServerInfo, ServerMap } from '@regax/rpc'
import { delay, EventEmitter } from '@regax/common'
import { Logger, defaultLogger } from '@regax/logger'

export class WorkerRegistry extends EventEmitter<RegistryEvent> implements Registry {
  protected started = false
  protected stopped = false
  protected registerMap: ServerMap = {}
  protected logger: Logger = defaultLogger
  protected version: 0
  constructor(
    readonly opts: RegistryOpts
  ) {
    super()
    if (opts.logger) this.logger = opts.logger
  }
  start(): void {
    if (this.started) return
    this.started = true
    this.emit(RegistryEvent.CONNECTION)
  }
  stop(): void {
    if (!this.started || this.stopped) return
    this.stopped = true
    this.off(RegistryEvent.CHANGED)
  }
  async register(serverInfo: ServerInfo): Promise<void> {
    this.registerMap[serverInfo.serverId] = serverInfo
    this.emitChanged()
  }
  async unRegister(serverId: string): Promise<void> {
    delete this.registerMap[serverId]
    this.emitChanged()
  }
  subscribe(fn: (servers: ServerMap) => void): () => void {
    let subscribeVersion = this.version
    const listener = async () => {
      try {
        if (!this.started || this.stopped) return
        const servers = await this.getAllServers()
        if (subscribeVersion === this.version) return
        subscribeVersion = this.version
        fn(servers)
      } catch (e) {
        this.logger.error(e)
        this.emit(RegistryEvent.ERROR, e)
      }
    }
    listener.fn = fn
    this.on(RegistryEvent.CHANGED, listener)
    return () => this.unSubscribe(fn)
  }
  unSubscribe(fn: (servers: ServerMap) => void): void {
    this.off(RegistryEvent.CHANGED, fn)
  }
  async getServerInfo(serverId: string): Promise<ServerInfo> {
    return this.registerMap[serverId]
  }
  async getAllServers(): Promise<ServerMap> {
    return this.registerMap
  }
  isConnected(): boolean {
    return this.started && !this.stopped
  }
  updateServerMap(serverMap: ServerMap): void {
    this.registerMap = serverMap
    this.emitChanged()
  }
  protected emitChanged(): void {
    this.version ++
    delay(0).then(() => {
      this.emit(RegistryEvent.CHANGED)
    })
  }
}
