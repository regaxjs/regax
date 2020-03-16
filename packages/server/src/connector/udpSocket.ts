import { ByteArray } from '@regax/protocol'
import { Socket as DgramSocket } from 'dgram'
import { SocketEvent, Socket, SocketState } from '../api'
import { Logger } from '@regax/logger'

export class UDPSocket extends Socket {
  constructor(
    readonly id: number,
    protected readonly socket: DgramSocket,
    public remoteAddress: { host: string, port: number },
    protected readonly logger: Logger
  ) {
    super()
    this.state = SocketState.INITED
  }
  /**
   * Send raw byte data.
   */
  sendRaw(msg: ByteArray): void {
    this.socket.send(msg, 0, msg.length, this.remoteAddress.port, this.remoteAddress.host, (err: Error) => {
      if (err)	{
        this.logger.error('[regax-udpsocket] send msg to remote with err: %j', err.stack)
      }
    })
  }
  close(): void {
    if (this.state === SocketState.CLOSED) {
      return
    }
    this.state = SocketState.CLOSED
    this.emit(SocketEvent.DISCONNECT)
  }
}
