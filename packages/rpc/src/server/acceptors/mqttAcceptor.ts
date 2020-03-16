// tslint:disable:no-any
import { Acceptor, AcceptorDispacher, AcceptorEvent, AcceptorOpts } from './index'
import { Logger, defaultLogger } from '@regax/logger'
import { Tracer } from '../../util/tracer'
import { Server } from 'net'
import { EventEmitter, RegaxError } from '@regax/common'
// const host = require('address').ip()
const MqttCon = require('mqtt-connection')

let curId = 1

export class MqttAcceptor extends EventEmitter<AcceptorEvent> implements Acceptor {
  protected server: Server
  protected closed = false
  protected logger: Logger = defaultLogger
  protected rpcDebugLog: boolean = false
  protected interval?: NodeJS.Timer
  protected sockets: {
    [socketId: string]: any
  } = {}
  protected msgQueues: {
    [socketId: string]: any
  } = {}
  constructor(
    protected readonly opts: AcceptorOpts,
    protected readonly dispatcher: AcceptorDispacher
  ) {
    super()
    this.server = new Server()
    if (opts.logger) this.logger = opts.logger
    if (opts.rpcDebugLog) this.rpcDebugLog = true
  }
  listen(port: number): void {
    this.server.on('listening', this.emit.bind(this, AcceptorEvent.LISTENING))
    this.server.listen(port)
    this.server.on('error', (err: RegaxError) => {
      if (err && err.code === 'EADDRINUSE') {
        this.close()
      }
      this.emit(AcceptorEvent.ERROR, err)
    })
    this.server.on('connection', (stream: any) => {
      const socket = MqttCon(stream)
      socket.id = curId++

      socket.on('connect', (pkg: any) => {
      })

      socket.on('publish', (pkg: any) => {
        pkg = pkg.payload.toString()
        let isArray = false
        try {
          pkg = JSON.parse(pkg)
          if (Array.isArray(pkg)) {
            for (let i = 0, l = pkg.length; i < l; i++) {
              this.processMsg(socket, pkg[i])
            }
            isArray = true
          } else {
            this.processMsg(socket, pkg)
          }
        } catch (err) {
          if (!isArray) {
            this.doSend(socket, {
              id: pkg.id,
              error: RegaxError.toJSON(err),
            })
          }
          this.logger.error('process rpc message error %s', err.stack)
        }
      })

      socket.on('pingreq', () => {
        socket.pingresp()
      })

      socket.on('error', (e: Error) => {
        this.onSocketClose(socket)
        this.emit(AcceptorEvent.ERROR, e)
      })

      socket.on('close', () => {
        this.onSocketClose(socket)
      })

      socket.on('disconnect', (reason: any) =>  {
        this.onSocketClose(socket)
      })

      this.sockets[socket.id] = socket
    })

    if (this.opts.bufferMsg && this.opts.flushInterval) {
      this.interval = setInterval(this.flush.bind(this), this.opts.flushInterval)
    }
  }
  close(): void {
    if (this.closed) return
    this.closed = true
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = undefined
    }
    this.server.close()
    this.emit(AcceptorEvent.CLOSE)
  }
  protected async processMsg(socket: any, pkg: any): Promise<void> {
    let tracer: Tracer | undefined
    if (this.rpcDebugLog) {
      tracer = new Tracer(this.logger, pkg.source, pkg.remote, pkg.msg, pkg.traceId, pkg.seqId)
      tracer.info('server', 'processMsg', 'mqtt-acceptor receive message and try to process message')
    }
    let error: any
    let resp: any
    try {
      resp = await this.dispatcher(pkg.msg.service, pkg.msg.args, tracer)
    } catch (e) {  error = RegaxError.toJSON(e) }
    if (tracer) {
      resp = {
        traceId: tracer.id,
        seqId: tracer.seq,
        source: tracer.source,
        id: pkg.id,
        error,
        msg: resp,
      }
    } else {
      resp = {
        id: pkg.id,
        msg: resp,
        error,
      }
    }
    if (this.interval) {
      this.enqueue(socket, resp)
    } else {
      this.doSend(socket, resp)
    }
  }
  protected flush(): void {
    const sockets = this.sockets
    const queues = this.msgQueues
    for (const socketId in queues) {
      const socket = sockets[socketId]
      if (!socket) {
        // clear pending messages if the socket not exist any more
        delete queues[socketId]
        continue
      }
      const queue = queues[socketId]
      if (!queue || !queue.length) {
        continue
      }
      this.doSend(socket, queue)
      queues[socketId] = []
    }
  }
  protected enqueue(socket: any, msg: any): void {
    const id = socket.id
    let queue = this.msgQueues[id]
    if (!queue) {
      queue = this.msgQueues[id] = []
    }
    queue.push(msg)
  }
  protected onSocketClose(socket: any): void {
    if (!socket.closed) {
      const id = socket.id
      delete this.sockets[id]
      delete this.msgQueues[id]
    }
  }
  protected doSend(socket: any, msg: any): void {
    socket.publish({
      topic: 'rpc',
      payload: JSON.stringify(msg)
    })
  }
}
