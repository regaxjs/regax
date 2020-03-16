// tslint:disable:no-any
import { Registry, RegistryEvent, RegistryOpts, ServerInfo, ServerMap, REGISTRY_CHANGE_DELAY } from '../registry'
import { EventEmitter, PromiseDelegate, delay } from '@regax/common'
import { Logger, defaultLogger } from '@regax/logger'
import { join } from 'path'
import { normalizeDirPath } from '../../util'
import { Client, createClient, CreateMode, ACL, Permission, Id } from 'node-zookeeper-client'
import { RPC_DEFAULT_ROOT_PATH } from '../../util/constants'

const crypto = require('crypto')

export interface ZookeeperRegistryOpts extends RegistryOpts {
  host?: string,
  port?: number,
  username?: string,
  password?: string
  sessionTimeout?: number, // Session timeout in milliseconds, defaults to 30 seconds.
  spinDelay?: number, // The delay (in milliseconds) between each connection attempts
  retries?: number // The number of retry attempts for connection loss exception
}

export class ZookeeperRegistry extends EventEmitter<RegistryEvent> implements Registry {
  protected started = false
  protected stopped = false
  protected rootPath = RPC_DEFAULT_ROOT_PATH
  // protected registerMap: ServerMap = {}
  protected version = 0
  protected rootDirCreated = false
  protected logger: Logger = defaultLogger
  protected client: Client
  constructor(
    readonly opts: ZookeeperRegistryOpts
  ) {
    super()
    if (opts.logger) this.logger = opts.logger
    if (opts.rootPath) this.rootPath = normalizeDirPath(opts.rootPath)
    const address = `${opts.host || '127.0.0.1'}:${opts.port || 2181}`
    let authentication: string
    let acls: any[]
    if (opts.username && opts.password) {
      authentication = opts.username + ':' + opts.password
      const shaDigest = crypto.createHash('sha1').update(authentication).digest('base64')
      acls = [
        new ACL(
          Permission.ALL,
          new Id('digest', opts.username + ':' + shaDigest)
        )
      ]
    }
    this.client = createClient(address, opts)
    this.client.on('connected', () => {
      if (authentication) {
        this.client.addAuthInfo('digest', Buffer.from(authentication))
        this.client.setACL(this.rootPath, acls, -1, (err: Error, stat: any) => {
          if (!!err) {
            this.logger.error('failed to set ACL: %j', err.stack)
            return
          }
        })
      }
      this.logger.info('[regax-rpc] zookeeper client connected to %s', address)
      this.emit(RegistryEvent.CONNECTION)
      // this.reRegister()
    })
    this.client.on('disconnected', () => {
      this.logger.error('[regax-rpc] zookeeper client disconnect')
      this.emit(RegistryEvent.DISCONNECT)
    })
    this.client.on('error', this.emit.bind(RegistryEvent.ERROR))
    this.client.on('expired', () => {
      if (this.stopped) return
      // TODO support session expired
      // setImmediate(() => this.client.connect())
    })
  }
  start(): void {
    if (this.started) return
    this.started = true
    this.client.connect()
  }
  stop(): void {
    if (!this.started || this.stopped) return
    this.stopped = true
    this.off(RegistryEvent.CHANGED)
    this.client.close()
  }
  async register(serverInfo: ServerInfo): Promise<void> {
    const buffer = Buffer.from(JSON.stringify(serverInfo))
    // this.registerMap.set(serverInfo.serverId, serverInfo)
    await this.createNode(join(this.rootPath, serverInfo.serverId), buffer)
  }
  async unRegister(serverId: string): Promise<void> {
    // this.registerMap.delete(serverId)
    await this.remove(join(this.rootPath, serverId))
  }
  subscribe(fn: (servers: ServerMap, event: any) => void): () => void {
    let subscribeVersion = this.version
    const listener = async (event: any) => {
      try {
        if (!this.started || this.stopped) return
        const servers = await this.getAllServers()
        // 防止重复触发
        if (subscribeVersion === this.version) return
        subscribeVersion = this.version
        fn(servers, event)
      } catch (error) {
        this.logger.error(error)
        this.emit(RegistryEvent.ERROR, error)
      }
    }
    listener.fn = fn
    this.on(RegistryEvent.CHANGED, listener)
    this.getChildren(true).catch(e => { })
    return () => this.off(RegistryEvent.CHANGED, listener)
  }
  protected async createNode(path: string, value: Buffer, mode: number = CreateMode.EPHEMERAL): Promise<void> {
    if (await this.exists(path)) {
      await this.remove(path)
    }
    return this.promiseInvoke('create', path, value, mode)
  }
  getServerInfo(serverId: string): Promise<ServerInfo> {
    return this.promiseInvoke('getData', join(this.rootPath, serverId)).then(d => JSON.parse(d.toString()))
  }
  getAllServers(): Promise<ServerMap> {
    return this.getChildren(true).then(list => {
      return Promise.all(list.map((serverId: string) => this.getServerInfo(serverId)))
    }).then(list => {
      return list.reduce((res: ServerMap, item) => {
        res[item.serverId] = item
        return res
      }, {})
    })
  }
  protected getChildren(emitChanged?: boolean): Promise<string[]> {
    const args: any[] = [this.rootPath]
    const version = this.version
    if (emitChanged) args.push((e: any) => {
      this.version++
      this.emit(RegistryEvent.CHANGED, e)
    })
    return this.promiseInvoke('getChildren', ...args).then(async d => {
      if (!emitChanged) return d
      await delay(REGISTRY_CHANGE_DELAY)
      if (this.version !== version) return this.getChildren(emitChanged)
      return d
    })
  }
  protected exists(path: string): Promise<boolean> {
    return this.promiseInvoke('exists', path)
  }
  protected remove(path: string): Promise<void> {
    return this.promiseInvoke('remove', path)
  }
  protected promiseInvoke(method: string, ...args: any[]): Promise<any> {
    const p = new PromiseDelegate<any>()
    if (!this.rootDirCreated) {
      this.client.mkdirp(this.rootPath, (error: Error) => {
        if (error) {
          p.reject(error)
          return
        }
        this.rootDirCreated = true
        this.promiseInvoke(method, ...args)
          .then(d => p.resolve(d))
          .catch(e => p.reject(e))
      })
      return p.promise
    }
    (this.client as any)[method](...args, (error: Error, d: any) => {
      if (error) {
        p.reject(error)
        return
      }
      p.resolve(d)
    })
    return p.promise
  }
  isConnected(): boolean {
    return this.started && !this.stopped
  }
}
