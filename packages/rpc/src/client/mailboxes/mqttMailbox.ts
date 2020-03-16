// tslint:disable:no-any
import { EventEmitter, PromiseDelegate, RegaxError, ErrorCode } from '@regax/common'
import { Mailbox, MailboxEvent, MailboxOpts } from './index'
import { ServerInfo } from '../../server/server'
import { Logger, defaultLogger } from '@regax/logger'
import { Tracer } from '../../util/tracer'
import * as net from 'net'
import * as util from 'util'
const MqttCon = require('mqtt-connection')
import { RPC_ERROR } from '../../util/constants'
import { DEFAULT_CONNECT_TIMEOUT, DEFAULT_KEEPALIVE, DEFAULT_INVOKE_TIMEOUT, DEFAULT_FLUSH_INTERVAL } from './index'

export class MqttMailbox extends EventEmitter<MailboxEvent> implements Mailbox {
  protected curId = 0
  protected id: string | number
  protected host: string
  protected port: number
  protected requests: { [reqId: string]: { p: PromiseDelegate<void>, tracer?: Tracer }} = {}
  protected timeout: { [reqId: string]: NodeJS.Timer } = {}
  protected queue: any[] = []
  protected bufferMsg = false
  protected keepalive: number = DEFAULT_KEEPALIVE
  protected interval?: NodeJS.Timer
  protected flushInterval: number = DEFAULT_FLUSH_INTERVAL
  protected invokeTimeout: number = DEFAULT_INVOKE_TIMEOUT
  protected keepaliveTimer?: NodeJS.Timer
  protected connected = false
  protected closed = false
  protected lastPing = -1
  protected lastPong = -1
  protected logger: Logger = defaultLogger
  protected clientId: string
  protected socket: any
  constructor(readonly serverInfo: ServerInfo, protected opts: MailboxOpts) {
    super()
    this.id = serverInfo.serverId
    this.host = serverInfo.host
    this.port = serverInfo.port
    this.bufferMsg = !!opts.bufferMsg
    this.clientId = opts.clientId || ''
    if (opts.logger) this.logger = opts.logger
    if (opts.invokeTimeout) this.invokeTimeout = opts.invokeTimeout
    if (opts.flushInterval) this.flushInterval = opts.flushInterval
    if (opts.keepalive) this.keepalive = opts.keepalive
  }
  connect(tracer?: Tracer): Promise<void> {
    const p = new PromiseDelegate<void>()
    if (tracer) tracer.info('client', 'connect', 'mqtt-mailbox try to connect')
    if (this.connected) {
      if (tracer) tracer.error('client', 'connect', 'mailbox has already connected')
      p.reject(new Error('mailbox has already connected.'))
      return p.promise
    }

    const stream = net.createConnection(this.port, this.host)
    this.socket = MqttCon(stream)

    const connectTimeout = global.setTimeout(() => {
      this.logger.error('[regax-rpc] rpc client %s connect to remote server %s timeout', this.clientId, this.id)
      this.emit(MailboxEvent.CLOSE, this.id)
      p.reject(RegaxError.create(`rpc client ${this.clientId} connect to remote server ${this.id} timeout`, ErrorCode.TIMEOUT))
    }, this.opts.connectTimeout || DEFAULT_CONNECT_TIMEOUT)

    this.socket.connect({
      clientId: 'MQTT_RPC_' + Date.now()
    }, () => {
      if (this.connected) {
        return
      }
      clearTimeout(connectTimeout)
      this.connected = true
      if (this.bufferMsg) {
        this.interval = global.setInterval(this.flush.bind(this), this.flushInterval)
      }

      this.setupKeepAlive()
      p.resolve()
    })

    this.socket.on('publish', (pkg: any) => {
      pkg = pkg.payload.toString()
      try {
        pkg = JSON.parse(pkg)
        if (pkg instanceof Array) {
          for (let i = 0, l = pkg.length; i < l; i++) {
            this.processMsg(pkg[i])
          }
        } else {
          this.processMsg(pkg)
        }
      } catch (err) {
        this.logger.error('[regax-rpc] rpc client %s process remote server %s message with error: %s', this.clientId, this.id, err.stack)
      }
    })

    this.socket.on('error', (err: any) => {
      this.logger.error('[regax-rpc] rpc socket %s is error, remote server %s host: %s, port: %s', this.clientId, this.id, this.host, this.port)
      this.logger.error(err)
      this.close()
    })

    this.socket.on('pingresp', () => {
      this.lastPong = Date.now()
    })

    this.socket.on('disconnect', (reason: string) => {
      this.logger.error('[regax-rpc] rpc socket %s is disconnect from remote server %s, reason: %s', this.clientId, this.id, reason)
      const reqs = this.requests
      for (const id in reqs) {
        const req = reqs[id]
        if (req.tracer) req.tracer.error('client', 'send', this.clientId + ' disconnect with remote server ' + this.id)
        req.p.reject(RegaxError.create(this.clientId + ' disconnect with remote server ' + this.id, RPC_ERROR.SERVER_CLOSED))
      }
      this.close()
    })
    return p.promise
  }
  close(): void {
    if (this.closed) {
      return
    }
    this.closed = true
    this.connected = false
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = undefined
    }
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer)
      this.keepaliveTimer = undefined
    }
    this.socket.destroy()
    this.emit(MailboxEvent.CLOSE, this.id)
  }
  send(msg: any, tracer?: Tracer): Promise<void> {
    const p = new PromiseDelegate<void>()
    if (tracer) tracer.info('client', 'send', 'mqtt-mailbox try to send')
    if (!this.connected) {
      if (tracer) tracer.error('client', 'send', 'mqtt-mailbox not init')
      p.reject(new Error(this.clientId + ' mqtt-mailbox is not init ' + this.id))
      return p.promise
    }

    if (this.closed) {
      if (tracer) tracer.error('client', 'send', 'mailbox has already closed')
      p.reject(new Error(this.clientId + ' mqtt-mailbox has already closed ' + this.id))
      return p.promise
    }

    const id = this.curId++
    this.requests[id] = { p, tracer }
    const timer = setTimeout(() => {
      this.clearCbTimeout(id)
      if (this.requests[id]) {
        delete this.requests[id]
      }
      const eMsg = util.format('rpc (%s) callback timeout %d, remote server host: %s, port: %s', this.clientId, this.invokeTimeout, this.host, this.port)
      if (tracer) tracer.error('client', 'send', eMsg)
      p.reject(RegaxError.create(eMsg, ErrorCode.TIMEOUT))
    }, this.invokeTimeout)
    this.timeout[id] = timer

    let pkg: any
    if (tracer) {
      pkg = {
        traceId: tracer.id,
        seqId: tracer.seq,
        source: tracer.source,
        remote: tracer.remote,
        id,
        msg,
      }
    } else {
      pkg = {
        id,
        msg,
      }
    }
    if (this.bufferMsg) {
      this.queue.push(msg)
    } else {
      this.doSend(this.socket, pkg)
    }
    return p.promise
  }
  protected setupKeepAlive(): void {
    this.keepaliveTimer = global.setInterval(() => {
      this.checkKeepAlive()
    }, this.keepalive)
  }
  protected checkKeepAlive(): void {
    if (this.closed) {
      return
    }
    const now = Date.now()
    const KEEP_ALIVE_TIMEOUT = this.keepalive * 2
    if (this.lastPing > 0) {
      if (this.lastPong < this.lastPing) {
        if (now - this.lastPing > KEEP_ALIVE_TIMEOUT) {
          this.logger.error('[regax-rpc] mqtt rpc client %s checkKeepAlive timeout from remote server %s for %d lastPing: %s lastPong: %s',
            this.clientId, this.id, KEEP_ALIVE_TIMEOUT, this.lastPing, this.lastPong)
          // this.emit(MailboxEvent.CLOSE, this.id)
          this.lastPing = -1
          // TODO test
          this.close()
        }
      } else {
        this.socket.pingreq()
        this.lastPing = Date.now()
      }
    } else {
      this.socket.pingreq()
      this.lastPing = Date.now()
    }
  }
  protected processMsg(pkg: any): void {
    const pkgId = pkg.id
    this.clearCbTimeout(pkgId)
    const req = this.requests[pkgId]
    if (!req) {
      return
    }

    delete this.requests[pkgId]
    if (pkg.error) {
      const error = RegaxError.create(pkg.error.message, pkg.error.code)
      error.stack = pkg.error.stack
      // TODO keep alive fail to check closed
      if (error.code === RPC_ERROR.SERVER_CLOSED) {
        this.close()
      }
      req.p.reject(error)
    } else {
      req.p.resolve(pkg.msg)
    }
  }
  protected flush(): void {
    if (this.closed || !this.queue.length) {
      return
    }
    this.doSend(this.socket, this.queue)
    this.queue = []
  }
  protected clearCbTimeout(id: number): void {
    if (!this.timeout[id]) {
      this.logger.warn('[regax-rpc] timer is not exsits, serverId: %s remote: %s, host: %s, port: %s', this.clientId, id, this.host, this.port)
      return
    }
    clearTimeout(this.timeout[id])
    delete this.timeout[id]
  }
  protected doSend(socket: any, msg: any): void {
    socket.publish({
      topic: 'rpc',
      payload: JSON.stringify(msg)
    })
  }
}
