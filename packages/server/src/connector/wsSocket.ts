import { ByteArray } from '@regax/protocol'
import * as WebSocket from 'ws'
import { SocketEvent, Socket, SocketState } from '../api'
import { Logger } from '@regax/logger'

export class WSSocket extends Socket {
  constructor(
    readonly id: number,
    protected readonly socket: WebSocket,
    readonly remoteAddress: { host: string, port: number },
    protected readonly logger: Logger
  ) {
    super()
    socket.once('close', this.emit.bind(this, SocketEvent.DISCONNECT))
    socket.on('error', this.emit.bind(this, SocketEvent.ERROR))
    socket.on('message', this.onMessage.bind(this))
  }
  /**
   * Send raw byte data.
   */
  sendRaw(msg: ByteArray): void {
    this.socket.send(msg, {binary: true}, err => {
      if (err && !err.message.match('CLOSING') && !err.message.match('CLOSED')) {
        this.logger.error('[regax-websocket] websocket send binary data failed: %j', err.stack)
        return
      }
    })
  }
  close(): void {
    if (this.state === SocketState.CLOSED) {
      return
    }
    this.state = SocketState.CLOSED
    this.socket.emit('close')
    this.socket.close()
  }
}
