import { EventEmitter, PlainData } from '@regax/common'
import { PackageType, Package, strdecode, PackageDataType, ByteArray } from '@regax/protocol'

export enum SocketState {
  INITED,
  WAIT_ACK,
  WORKING,
  CLOSED,
}

export enum SocketEvent {
  DISCONNECT = 'disconnect',
  ERROR = 'error',
  HANDSHAKE = 'handshake',
  HEARTBEAT = 'heartbeat',
  DATA = 'data',
  KICK = 'kick' // kick user
}

export abstract class Socket extends EventEmitter<SocketEvent> {
  readonly event = SocketEvent
  state: SocketState
  protected constructor() {
    super()
    this.state = SocketState.INITED
  }
  abstract readonly remoteAddress: {
    host: string,
    port: number,
  }
  abstract readonly id: number
  /**
   * Send raw byte data.
   */
  abstract sendRaw(msg: ByteArray): void
  close(): void {
    this.state = SocketState.CLOSED
  }
  get closed(): boolean {
    return this.state === SocketState.CLOSED
  }
  /**
   * Send message to client no matter whether handshake.
   */
  sendForce(msg: ByteArray): void {
    if (this.state === SocketState.CLOSED) {
      return
    }
    this.sendRaw(msg)
  }
  sendBatch(msgs: Buffer[]): void {
    if (this.state !== SocketState.WORKING) {
      return
    }
    const rs = []
    for (let i = 0; i < msgs.length; i++) {
      const src = Package.encode(PackageType.DATA, msgs[i])
      rs.push(src)
    }
    this.sendRaw(Buffer.concat(rs))
  }
  /**
   * Send byte data to client
   * @param msg
   */
  send(msg: PlainData | Buffer): void {
    if (this.state !== SocketState.WORKING) {
      return
    }
    if (typeof msg === 'string') {
      msg = Buffer.from(msg)
    } else if (!(msg instanceof Buffer)) {
      msg = Buffer.from(JSON.stringify(msg))
    }
    this.sendRaw(Package.encode(PackageType.DATA, msg as Buffer))
  }

  handshakeResponse(msg: ByteArray): void {
    if (this.state !== SocketState.INITED) {
      return
    }
    this.sendRaw(msg)
    this.state = SocketState.WAIT_ACK
  }
  onMessage(msg: ByteArray): void {
    if (msg) {
      const msgs = Package.decode(msg)
      if (Array.isArray(msgs)) {
        for (let i = 0; i < msgs.length; i++) {
          this.onPackageMessage(msgs[i])
        }
      } else {
        this.onPackageMessage(msgs)
      }
    }
  }
  onPackageMessage(msg: PackageDataType): void {
    const { type, body } = msg
    switch (type) {
      case PackageType.HANDSHAKE:
        if (this.state !== SocketState.INITED) return
        try {
          this.emit(SocketEvent.HANDSHAKE, JSON.parse(strdecode(body!)))
        } catch (ex) {
          this.emit(SocketEvent.HANDSHAKE, {})
        }
        break
      case PackageType.HANDSHAKE_ACK:
        if (this.state !== SocketState.WAIT_ACK) return
        this.state = SocketState.WORKING
        this.emit(SocketEvent.HEARTBEAT)
        break
      case PackageType.HEARTBEAT:
        if (this.state !== SocketState.WORKING) return
        this.emit(SocketEvent.HEARTBEAT)
        break
      case PackageType.DATA:
        if (this.state !== SocketState.WORKING) return
        this.emit(SocketEvent.DATA, msg)
        break
    }
  }
}
