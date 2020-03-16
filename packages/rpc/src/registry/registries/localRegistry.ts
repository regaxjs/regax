// tslint:disable:no-any
import { Registry, RegistryEvent, RegistryOpts, ServerInfo, ServerMap } from '../registry'
import { EventEmitter, delay } from '@regax/common'
import { normalizeDirPath } from '../../util'
import { RPC_DEFAULT_ROOT_PATH } from '../../util/constants'
import { Logger, defaultLogger } from '@regax/logger'

const localRegistryStore: { [rootPath: string]: LocalRegistry[] } = {}
const localRegistryVersion: { [rootPath: string]: number } = {}

export interface LocalRegistryOpts extends RegistryOpts {
  changeDelay?: number,
}
/**
 * Local registry for single mode
 */
export class LocalRegistry extends EventEmitter<RegistryEvent> implements Registry {
  protected started = false
  protected stopped = false
  protected rootPath = RPC_DEFAULT_ROOT_PATH
  protected registerMap: ServerMap = {}
  protected logger: Logger = defaultLogger
  protected get version(): number {
    return localRegistryVersion[this.rootPath] || 0
  }
  protected set version(v: number) {
    localRegistryVersion[this.rootPath] = v
  }
  protected get clients(): LocalRegistry[] {
    return localRegistryStore[this.rootPath] || []
  }
  constructor(
    readonly opts: LocalRegistryOpts
  ) {
    super()
    if (opts.logger) this.logger = opts.logger
    if (opts.rootPath) this.rootPath = normalizeDirPath(opts.rootPath)
    if (!localRegistryStore[this.rootPath]) localRegistryStore[this.rootPath] = []
    localRegistryStore[this.rootPath].push(this)
  }
  start(): void {
    if (this.started) return
    this.started = true
    this.emit(RegistryEvent.CONNECTION)
  }
  stop(): void {
    if (!this.started || this.stopped) return
    // remove registry client
    this.stopped = true
    const i = localRegistryStore[this.rootPath].indexOf(this)
    if (i !== -1) {
      localRegistryStore[this.rootPath].splice(i, 1)
      if (localRegistryStore[this.rootPath].length === 0) {
        delete localRegistryStore[this.rootPath]
        delete localRegistryVersion[this.rootPath]
      }
      this.emitChanged()
    }
    this.off(RegistryEvent.CHANGED)
  }
  async register(serverInfo: ServerInfo): Promise<void> {
    this.checkConnect('register')
    this.clients.forEach(client => {
      delete client.registerMap[serverInfo.serverId]
    })
    this.registerMap[serverInfo.serverId] = serverInfo
    this.emitChanged()
  }
  async registerMore(serverMap: ServerMap): Promise<void> {
    this.checkConnect('register')
    for (const i in serverMap) {
      const serverInfo = serverMap[i]
      this.clients.forEach(client => {
        delete client.registerMap[serverInfo.serverId]
      })
      this.registerMap[serverInfo.serverId] = serverInfo
    }
    this.emitChanged()
  }
  async unRegister(serverId: string): Promise<void> {
    this.checkConnect('unRegister')
    delete this.registerMap[serverId]
    this.emitChanged()
  }
  subscribe(fn: (servers: ServerMap) => void): () => void {
    let subscribeVersion = this.version
    const listener = async () => {
      try {
        if (!this.started || this.stopped) return
        const servers = await this.getAllServers()
        // 防止重复触发
        if (subscribeVersion === this.version) return
        subscribeVersion = this.version
        fn(servers)
      } catch (e) {
        this.logger.error(e)
        this.emit(RegistryEvent.ERROR, e)
      }
    }
    listener.fn = fn
    this.clients.forEach(client => client.on(RegistryEvent.CHANGED, listener))
    return () => this.unSubscribe(fn)
  }
  unSubscribe(fn: any): void {
    this.clients.forEach(client => client.off(RegistryEvent.CHANGED, fn))
  }
  async getServerInfo(serverId: string): Promise<ServerInfo> {
    this.checkConnect('getServerInfo')
    for (const client of this.clients) {
      if (client.registerMap[serverId]) {
        return client.registerMap[serverId]
      }
    }
    throw new Error('unRegister server ' + serverId)
  }
  async getAllServers(): Promise<ServerMap> {
    this.checkConnect('getAllServers')
    return this.clients.reduce((res: ServerMap, client: LocalRegistry) => {
      if (client.started && !client.stopped) {
        Object.assign(res, client.registerMap)
      }
      return res
    }, {})
  }
  protected emitChanged(): void {
    this.version ++
    delay(this.opts.changeDelay || 0).then(() => {
      this.clients.forEach(client => client.emit(RegistryEvent.CHANGED))
    })
  }
  protected checkConnect(msg: string): void {
    if (!this.started) throw new Error(`[regax-rpc-localRegistry] (${msg}) CONNECTION_LOSS: registry is no started`)
    if (this.stopped) throw new Error(`[regax-rpc-localRegistry] (${msg}) CONNECTION_LOSS: registry is stopped`)
  }
  isConnected(): boolean {
    return this.started && !this.stopped
  }
}
