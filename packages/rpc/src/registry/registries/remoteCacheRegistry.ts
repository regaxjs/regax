// tslint:disable:no-any
import { Registry, RegistryEvent, RegistryOpts, ServerInfo, ServerMap } from '../registry'
import { EventEmitter, Tick } from '@regax/common'
import { RPC_DEFAULT_ROOT_PATH } from '../../util/constants'
import { Logger, defaultLogger } from '@regax/logger'
import { RemoteCache, RemoteFs, SimpleRemoteCache } from '../../util/remoteCache'
import { normalizeDirPath } from '../../util'

export const REMOTE_CACHE_DEFAULT_SYNC_INTERVAL = 1000 * 3 // 3 s
export const REMOTE_CACHE_DEFAULT_START_LONG_SYNC = 1000 * 60 * 3 // 3 mins
export const REMOTE_CACHE_DEFAULT_LONG_SYNC_INTERVAL = 1000 * 60 * 60 // 1 hour

export interface RemoteCacheRegistryOpts extends RegistryOpts {
  remoteCache?: RemoteCache
  syncInterval?: number // ms
  longSyncInterval?: number // ms
  startLongSync?: number // ms
  expiredTime?: number // ms
}
/**
 *  Remote cache registry
 */
export class RemoteCacheRegistry extends EventEmitter<RegistryEvent> implements Registry {
  protected started = false
  protected stopped = false
  protected rootPath = RPC_DEFAULT_ROOT_PATH
  protected remoteCache: SimpleRemoteCache
  protected remoteFs: RemoteFs
  protected logger: Logger = defaultLogger
  protected version = -1
  protected tick: Tick = new Tick(this.opts.syncInterval || REMOTE_CACHE_DEFAULT_SYNC_INTERVAL)
  protected serverMap: ServerMap
  protected currentRegisterServers: string[] = []
  protected startLongSyncTimoutId?: NodeJS.Timer
  constructor(
    readonly opts: RemoteCacheRegistryOpts
  ) {
    super()
    if (opts.logger) this.logger = opts.logger
    if (opts.rootPath) this.rootPath = normalizeDirPath(opts.rootPath)
    this.remoteCache = opts.remoteCache || new RemoteCache()
    this.remoteFs = new RemoteFs(this.remoteCache, this.rootPath, opts.expiredTime ? opts.expiredTime / 1000 : opts.expiredTime)
  }
  setSyncInterval(syncInterval: number): void {
    this.tick.setTick(syncInterval)
  }
  start(): void {
    if (this.started) return
    this.started = true
    this.syncData()
    const longSyncInterval = this.opts.startLongSync || REMOTE_CACHE_DEFAULT_START_LONG_SYNC
    // start long sync interval after 3 mins
    this.startLongSyncTimoutId = setTimeout(() => {
      this.logger.info('[regax-rpc-remoteRegistry] start long sync interval after ' + longSyncInterval + 'ms')
      this.setSyncInterval(this.opts.longSyncInterval || REMOTE_CACHE_DEFAULT_LONG_SYNC_INTERVAL)
      this.startLongSyncTimoutId = undefined
    }, longSyncInterval)
    this.emit(RegistryEvent.CONNECTION)
  }
  stop(): void {
    if (!this.started || this.stopped) return
    this.stopped = true
    this.tick.stop()
    this.off(RegistryEvent.CHANGED)
    if (this.startLongSyncTimoutId) clearTimeout(this.startLongSyncTimoutId)
    // clear current register server
    this.remoteFs.removeFiles(...this.currentRegisterServers)
  }
  async register(serverInfo: ServerInfo): Promise<void> {
    this.checkConnect('register')
    this.currentRegisterServers.push(serverInfo.serverId)
    await this.remoteFs.writeFile(serverInfo.serverId, serverInfo)
  }
  async unRegister(serverId: string): Promise<void> {
    this.checkConnect('unRegister')
    this.currentRegisterServers = this.currentRegisterServers.filter(id => id !== serverId)
    await this.remoteFs.removeFiles(serverId)
  }
  subscribe(fn: (servers: ServerMap) => void): () => void {
    const listener = async () => {
      fn(this.serverMap)
    }
    listener.fn = fn
    this.on(RegistryEvent.CHANGED, listener)
    return () => this.off(RegistryEvent.CHANGED, listener)
  }
  async getServerInfo(serverId: string): Promise<ServerInfo> {
    this.checkConnect('getServerInfo')
    return this.remoteFs.readFile(serverId)
  }
  async getAllServers(): Promise<ServerMap> {
    this.checkConnect('getAllServers')
    const data = await this.remoteFs.readdir()
    if (data.version !== this.version) {
      this.version = data.version
      this.serverMap = data.files
      this.emit(RegistryEvent.CHANGED)
    }
    return data.files
  }
  protected syncData(): void {
    this.tick.next(async () => {
      if (!this.started || this.stopped) return
      try {
        await this.getAllServers()
      } catch { }
      this.syncData()
    })
  }
  protected checkConnect(msg: string): void {
    if (!this.started) throw new Error(`[regax-rpc-remoteRegistry] (${msg}) CONNECTION_LOSS: registry is no started`)
    if (this.stopped) throw new Error(`[regax-rpc-remoteRegistry] (${msg}) CONNECTION_LOSS: registry is stopped`)
  }
  async clear(): Promise<void> {
    await this.remoteFs.removedir()
  }
  isConnected(): boolean {
    return this.started && !this.stopped
  }
}
