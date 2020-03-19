// tslint:disable:no-any
import { Acceptor, AcceptorDispacher, AcceptorEvent, AcceptorOpts } from './index'
import { defaultLogger, Logger } from '@regax/logger'
import { Tracer } from '../../util/tracer'
import * as WebSocket from 'ws'
import { EventEmitter, RegaxError } from '@regax/common'

let curId = 1

interface AcceptorSocket extends WebSocket {
  id: number
}

export class WSAcceptor extends EventEmitter<AcceptorEvent> implements Acceptor {
  protected server: WebSocket.Server
  protected closed = false
  protected logger: Logger = defaultLogger
  protected rpcDebugLog: boolean = false
  protected interval?: NodeJS.Timer
  protected sockets: {
    [socketId: string]: AcceptorSocket
  } = {}
  protected msgQueues: {
    [socketId: string]: any
  } = {}
  constructor(
    protected readonly opts: AcceptorOpts,
    protected readonly dispatcher: AcceptorDispacher
  ) {
    super()
    if (opts.logger) this.logger = opts.logger
    if (opts.rpcDebugLog) this.rpcDebugLog = true
  }
  listen(port: number): void {
    this.server = new WebSocket.Server({
      port,
      perMessageDeflate: {
        zlibDeflateOptions: {
          // See zlib defaults.
          chunkSize: 1024,
          memLevel: 7,
          level: 3
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024
        },
      }
    })
    this.server.on('listening', this.emit.bind(this, AcceptorEvent.LISTENING))
    this.server.on('error', (err: RegaxError) => {
      if (err && err.code === 'EADDRINUSE') {
        this.close()
      }
      this.emit(AcceptorEvent.ERROR, err)
    })
    this.server.on('connection', (socket: AcceptorSocket) => {
      socket.id = curId++

      this.emit(AcceptorEvent.CONNECTION, {
        id: socket.id,
        ip: (socket as any)._socket.remoteAddress
      })

      socket.on('message', (pkg: string) => {
        try {
          pkg = JSON.parse(pkg)
          if (Array.isArray(pkg)) {
            for (let i = 0, l = pkg.length; i < l; i++) {
              this.processMsg(socket, pkg[i])
            }
          } else {
            this.processMsg(socket, pkg)
          }
        } catch (err) {
          this.logger.error('process rpc message error %s', err.stack)
        }
      })

      socket.on('close', () => {
        this.onSocketClose(socket)
      })
      socket.on('error', (e: Error) => {
        this.emit(AcceptorEvent.ERROR, e)
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
    try {
      if (this.server) this.server.close()
    } catch (e) {
      this.logger.error('[regax-rpc] rpc server close error %s', e.stack)
    }
    this.emit(AcceptorEvent.CLOSE)
  }
  protected async processMsg(socket: any, pkg: any): Promise<void> {
    let tracer: Tracer | undefined
    if (this.rpcDebugLog) {
      tracer = new Tracer(this.logger, pkg.source, pkg.remote, pkg.msg, pkg.traceId, pkg.seqId)
      tracer.info('server', 'processMsg', 'ws-acceptor receive message and try to process message')
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
    const id = socket.id
    delete this.sockets[id]
    delete this.msgQueues[id]
    this.emit(AcceptorEvent.DISCONNECT)
  }
  protected doSend(socket: any, msg: any): void {
    const str = JSON.stringify(msg)
    socket.send(str, (err: Error) => {
      if (err && !err.message.match('CLOSING') && !err.message.match('CLOSED')) {
        this.logger.error('[regax-rpc] wsAccepctor send data failed: %j', err.message)
      }
    })
  }
}
