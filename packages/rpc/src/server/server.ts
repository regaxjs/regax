// tslint:disable:no-any
import { Acceptor, AcceptorDispacher, AcceptorEvent, AcceptorOpts, createAcceptor } from './acceptors'
import { delay, EventEmitter, PromiseDelegate, RegaxError } from '@regax/common'
import { Tracer } from '../util/tracer'
import { RPC_ERROR } from '../util/constants'
import { Logger, defaultLogger } from '@regax/logger'
import { LocalRegistry, Registry } from '../registry/registry'

const detectPort = require('detect-port')
const localHost = require('address').ip()

export interface ServerInfo {
  host: string,
  port: number,
  serverId: string,
  serverType: string,
  serverVersion?: string,
  weight?: number,
  registerTime?: number,
}

export function isServerInfoChanged(oldServer: ServerInfo, newServer: ServerInfo): boolean {
  if (Object.keys(oldServer).length !== Object.keys(newServer).length) return true
  return !!Object.keys(oldServer).find((key: keyof ServerInfo) => oldServer[key] !== newServer[key])
}

export interface ServerMap { [serverId: string]: ServerInfo }

export interface ServerServices {
  [serviceName: string]: (...args: any[]) => any
}

export interface ServerOpts extends AcceptorOpts {
  port?: number | string,
  serverType?: string,
  serverId?: string,
  serverVersion?: string,
  createAcceptor?: (opts: AcceptorOpts, dispacher: AcceptorDispacher) => Acceptor
  services: ServerServices,
  serviceContext?: any
  registryRootPath?: string,
  registry?: Registry
  autoport?: boolean, // default true
}
export type ServerEvent = AcceptorEvent
export const ServerEvent = AcceptorEvent

async function normalizeServerInfo(opts: ServerOpts, autoPort: boolean): Promise<ServerInfo> {
  const port = await detectPort(opts.port || 3723)
  if (!autoPort && port !== opts.port) {
    throw new Error(`port ${opts.port} already in use`)
  }
  return {
    host: localHost,
    port,
    serverType: opts.serverType || '*',
    serverId: opts.serverId || `${localHost}(${opts.serverType || '*'}):${port}`,
    serverVersion: opts.serverVersion,
    registerTime: Date.now(),
  }
}
export class Server extends EventEmitter<ServerEvent> {
  protected started = false
  protected stopped = false
  protected registry: Registry
  protected autoport: boolean
  serverId: string
  serverInfo: ServerInfo
  protected acceptor: Acceptor
  protected logger: Logger = defaultLogger
  constructor(
    readonly opts: ServerOpts
  ) {
    super()
    if (opts.logger) this.logger = opts.logger
    this.registry = opts.registry || new LocalRegistry({ rootPath: opts.registryRootPath, logger: opts.logger })
    this.autoport = opts.autoport !== undefined ? opts.autoport : true
  }
  createAcceptor(): Acceptor {
    return this.opts.createAcceptor
      ? this.opts.createAcceptor(this.opts, this.dispatcher.bind(this))
      : createAcceptor(this.opts, this.dispatcher.bind(this))
  }
  protected tryToStartAccetpor(port: number): Promise<void> {
    const p = new PromiseDelegate<void>()
    const startError = (e: Error) => {
      this.acceptor.off(AcceptorEvent.LISTENING, startSuccess)
      p.reject(e)
    }
    const startSuccess = () => {
      this.acceptor.off(AcceptorEvent.ERROR, startError)
      p.resolve()
    }
    this.acceptor.once(AcceptorEvent.ERROR, startError)
    this.acceptor.once(AcceptorEvent.LISTENING, startSuccess)
    this.acceptor.listen(port)
    return p.promise
  }
  async start(port?: number, retryTimes: number = 10): Promise<void> {
    if (this.started) {
      throw new Error('[regax-rpc] RPC Server has already started.')
    }
    if (port) this.opts.port = port
    if (!this.autoport) retryTimes = 0
    try {
      this.started = true
      this.acceptor = this.createAcceptor()
      this.registry.start()
      this.serverInfo = await normalizeServerInfo(this.opts, this.autoport)
      this.serverId = this.serverInfo.serverId
      await this.tryToStartAccetpor(this.serverInfo.port)
      this.acceptor.on(AcceptorEvent.CLOSE, () => {
        this.emit(ServerEvent.CLOSE)
      })
      this.acceptor.on(AcceptorEvent.ERROR, (e: RegaxError) => {
        this.logger.error('[regax-rpc] rpc error: %j', e.stack)
        this.emit(ServerEvent.ERROR, e)
      })
      // register the server
      try {
        await this.registry.register(this.serverInfo)
      } catch (e) {
        this.logger.error('[regax-rpc] rpc registry error: ', e)
      }
    } catch (e) {
      this.started = false
      this.acceptor.off(AcceptorEvent.CLOSE)
      this.acceptor.off(AcceptorEvent.ERROR)
      this.acceptor.close()
      if (retryTimes > 0) {
        await delay(Math.floor(Math.random() * 20))
        return this.start(port, retryTimes - 1)
      }
      throw e
    }
  }
  stop(): void {
    if (!this.started || this.stopped) return
    this.stopped = true
    this.registry.stop()
    try {
      this.acceptor.close()
    } catch (e) {
      this.logger.error(e)
    }
  }
  protected dispatcher(serviceName: string, args: any[], tracer?: Tracer): Promise<any> {
    const services = this.opts.services
    if (this.stopped) {
      if (tracer) tracer.error('server', 'dispatcher', `Server ${this.serverId} is closed`)
      throw RegaxError.create(`Server "${this.serverId}" is closed`, RPC_ERROR.SERVER_CLOSED)
    }
    if (!services[serviceName]) {
      if (tracer) tracer.error('server', 'dispatcher', `no such service: ${serviceName}`)
      throw RegaxError.create(`no such service: ${serviceName}.`, RPC_ERROR.SERVICE_NOT_FOUND)
    }
    return Promise.resolve(services[serviceName].apply(this.opts.serviceContext, args))
  }
}

export function createServer(opts: ServerOpts): Server {
  return new Server(opts)
}
