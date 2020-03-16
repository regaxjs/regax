// tslint:disable:no-any
import { EventEmitter, PromiseDelegate, RegaxError } from '@regax/common'
import { Logger, defaultLogger } from '@regax/logger'
import { ClientOpts } from './client'
import { createMailbox, Mailbox, MailboxEvent } from './mailboxes'
import { LocalRegistry, Registry, ServerInfo, ServerMap } from '../registry/registry'
import { isServerInfoChanged } from '../server/server'
import { RPC_ERROR } from '../util/constants'
import { Tracer } from '../util/tracer'
import { retry } from '../util'

const DEFAULT_PENDING_SIZE = 10000
const GRACE_TIMEOUT = 3 * 1000
const CONNECT_RETRIES = 3
const CONNECT_RETRY_DELAY = 100

export enum MailstationEvent {
  ERROR = 'error',
  CLOSE = 'close'
}
export enum MailstationState {
  INITED,
  STARTED,
  CLOSED
}

export class Mailstation extends  EventEmitter<MailstationEvent> {
  public servers: ServerMap = {} // remote server info map, key: server id, value: info
  public serversMap: { [serverType: string]: string[] } = {} // remote server info map, key: serverType, value: servers array
  protected registry: Registry
  protected pendings: { [serverId: string]: ({ serverId: string | number, msg: any, p: PromiseDelegate<any>, tracer?: Tracer})[] } = {} // pending request queues
  protected connecting: { [serverId: string]: boolean } = {} // connecting remote server mailbox map
  protected mailboxes: { [serverId: string]: Mailbox } = {} // working mailbox map
  protected pendingSize = DEFAULT_PENDING_SIZE
  protected createMailbox = createMailbox
  protected logger: Logger = defaultLogger
  protected state = MailstationState.INITED
  protected unSubscribe: () => void
  constructor(
    protected opts: ClientOpts
  ) {
    super()
    if (opts.logger) this.logger = opts.logger
    if (opts.createMailbox) this.createMailbox = opts.createMailbox
    this.registry = opts.registry || new LocalRegistry({ rootPath: opts.registryRootPath, logger: this.logger })
  }
  /**
   * Init and start station. Connect all mailbox to remote servers.
   */
  async start(): Promise<void> {
    if (this.state > MailstationState.INITED) {
      return
    }
    this.state = MailstationState.STARTED
    this.registry.start()
    this.unSubscribe = this.registry.subscribe(this.syncServers.bind(this))
    const servers = await this.registry.getAllServers()
    this.syncServers(servers)
  }
  protected removeMailbox(serverId: string): void {
    const mailbox = this.mailboxes[serverId]
    if (mailbox) {
      mailbox.close()
      delete this.mailboxes[serverId]
    }
  }
  protected syncServers(servers: ServerMap): void {
    // this.logger.info('[regax-rpc] servers map sync from registry.')
    this.removeOldMailboxes(servers)
    this.servers = servers
    this.serversMap = Object.keys(servers).reduce((res: any, serverId: string) => {
      const server = servers[serverId]
      if (!res[server.serverType]) res[server.serverType] = []
      res[server.serverType].push(serverId)
      res[server.serverType] = res[server.serverType].sort((s1: string, s2: string) => servers[s1].port - servers[s2].port)
      return res
    }, {})
  }
  protected removeOldMailboxes(newServers: ServerMap): any {
    for (const serverId in this.servers) {
      const newServerInfo = newServers[serverId]
      if (!newServerInfo || isServerInfoChanged(this.servers[serverId], newServerInfo)) {
        this.removeMailbox(serverId)
      }
    }
  }
  /**
   * Stop station and all its mailboxes
   *
   * @param force - whether stop station forcely
   */
  stop(force?: boolean): void {
    if (this.state !== MailstationState.STARTED) {
      this.logger.warn('[regax-rpc] client is not running now.')
      return
    }
    this.unSubscribe()
    this.registry.stop()
    this.state = MailstationState.CLOSED
    const closeAll = () => {
      for (const id in this.mailboxes) {
        this.mailboxes[id].close()
      }
    }
    if (force) {
      closeAll()
    } else {
      setTimeout(closeAll, GRACE_TIMEOUT)
    }
  }
  /**
   * Dispatch rpc message to the mailbox
   *
   * @param  serverId - remote server id
   * @param  msg - rpc invoke message
   * @param  tracer - rpc debug tracer
   */
  async dispatch(serverId: string | number, msg: any, tracer?: Tracer): Promise<any> {
    const p = new PromiseDelegate<any>()
    if (tracer) tracer.info('client', 'dispatch', 'dispatch rpc message to the mailbox')
    if (this.state !== MailstationState.STARTED) {
      if (tracer) tracer.error('client', 'dispatch', 'client is not running now')
      this.logger.error('[regax-rpc] client is not running now.')
      this.emit(MailstationEvent.ERROR, RPC_ERROR.SERVER_NOT_STARTED, tracer, serverId, msg)
      throw RegaxError.create('client is not running now', RPC_ERROR.SERVER_NOT_STARTED)
    }

    let mailbox = this.mailboxes[serverId]
    if (!mailbox) {
      if (tracer) tracer.debug('client', 'dispatch', 'mailbox is not exist')
      // Try to connect remote server if mailbox instance does not exist
      if (!(await this.lazyConnect(serverId, tracer))) {
        if (tracer) tracer.error('client', 'dispatch', 'fail to find remote server:' + serverId)
        this.logger.error('[regax-rpc] fail to find remote server:' + serverId)
        this.emit(MailstationEvent.ERROR, RPC_ERROR.SERVER_NOT_FOUND, tracer, serverId, msg)
        throw RegaxError.create('fail to find remote server:' + serverId, RPC_ERROR.SERVER_NOT_FOUND)
      }
    }

    if (this.connecting[serverId]) {
      if (tracer) tracer.debug('client', 'dispatch', 'request add to connecting')
      // if the mailbox is connecting to remote server
      this.addToPending(serverId, msg, p, tracer)
      return p.promise
    }

    if (tracer) tracer.info('client', 'send', 'get corresponding mailbox and try to send message')
    mailbox = this.mailboxes[serverId]
    try {
      return mailbox.send(msg, tracer)
    } catch (sendError) {
      this.logger.error('[regax-rpc] fail to send message %s', sendError.stack || sendError.message)
      this.emit(MailstationEvent.ERROR, RPC_ERROR.FAIL_SEND_MESSAGE, tracer, serverId)
      throw RegaxError.create(sendError, sendError.code || RPC_ERROR.FAIL_SEND_MESSAGE)
    }
  }
  /**
   * Try to connect to remote server
   * @param serverId - remote server id
   * @param tracer - rpc debug tracer
   */
  async connect(serverId: string | number, tracer?: Tracer): Promise<void> {
    const mailbox = this.mailboxes[serverId]
    try {
      await mailbox.connect(tracer)
    } catch (e) {
      if (tracer) tracer.error('client', 'lazyConnect', 'fail to connect to remote server: ' + serverId)
      this.logger.error('[regax-rpc] mailbox fail to connect to remote server "%s": %s', serverId, e.stack)
      if (this.mailboxes[serverId]) {
        delete this.mailboxes[serverId]
      }
      this.emit(MailstationEvent.ERROR, RPC_ERROR.FAIL_CONNECT_SERVER, tracer, serverId, this.opts)
      return
    }
    mailbox.on(MailboxEvent.CLOSE, (id: string | number) => {
      const mbox = this.mailboxes[id]
      if (!!mbox) {
        mbox.close()
        delete this.mailboxes[id]
      }
      this.emit(MailstationEvent.CLOSE, id)
    })
    delete this.connecting[serverId]
    this.flushPending(serverId, tracer)
  }
  protected flushPending(serverId: string | number, tracer?: Tracer): void {
    if (tracer) tracer.info('client', 'flushPending', 'flush pending requests to dispatch method')
    const pending = this.pendings[serverId]
    const mailbox = this.mailboxes[serverId]
    if (!pending || !pending.length) {
      return
    }
    if (!mailbox) {
      if (tracer) tracer.error('client', 'flushPending', 'fail to flush pending messages for empty mailbox: ' + serverId)
      this.logger.error('[regax-rpc] fail to flush pending messages for empty mailbox: ' + serverId)
    }
    for (let i = 0, l = pending.length; i < l; i++) {
      const item = pending[i]
      this.dispatch.call(this, item.serverId, item.msg, item.tracer).then((res: any) => item.p.resolve(res)).catch((e: Error) => item.p.reject(e))
    }
    delete this.pendings[serverId]
  }
  protected addToPending(serverId: string | number, msg: any, p: PromiseDelegate<any>, tracer?: Tracer): void {
    if (tracer) tracer.info('client', 'addToPending', 'add pending requests to pending queue')
    let pending = this.pendings[serverId]
    if (!pending) {
      pending = this.pendings[serverId] = []
    }
    if (pending.length > this.pendingSize) {
      if (tracer) tracer.debug('client', 'addToPending', 'station pending too much for: ' + serverId)
      this.logger.warn('[regax-rpc] station pending too much for: %s', serverId)
      return
    }
    pending.push({
      serverId,
      msg,
      tracer,
      p,
    })
  }
  protected async lazyConnect(serverId: string | number, tracer?: Tracer): Promise<boolean> {
    if (this.connecting[serverId]) return true
    if (tracer) tracer.info('client', 'lazyConnect', 'create mailbox and try to connect to remote server')
    // get serverInfo from registry withe delay
    const server = await retry<ServerInfo>(() => Promise.resolve(this.servers[serverId]), CONNECT_RETRIES, CONNECT_RETRY_DELAY)
    if (!server) {
      this.logger.error('[regax-rpc] unknown server: %s', serverId)
      return false
    }
    if (this.connecting[serverId]) return true // check again
    const mailbox = this.createMailbox(server, this.opts)
    this.connecting[serverId] = true
    this.mailboxes[serverId] = mailbox
    await this.connect(serverId, tracer)
    return true
  }
}
