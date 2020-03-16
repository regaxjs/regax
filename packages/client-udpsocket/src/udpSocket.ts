// tslint:disable:no-any
import { EventEmitter, PlainData, Tick, RegaxError, Fn } from '@regax/common'
import { ByteArray, Package, PackageType, strdecode, strencode, PackageDataType } from '@regax/protocol'

export interface UDPSocket extends EventEmitter<'message' | 'error' | 'close' | 'listening' | 'connect'> {
  send(message: string | ArrayBuffer, offset: number, length: number, port: number, host: string): void
  close(cb?: Fn): void
  bind(port?: number, addr?: string, cb?: Fn): void
  bind(port?: number, cb?: Fn): void
}

export interface CreateUDPSocket {
  (udpSocketType?: string): UDPSocket
}

export enum SocketEvent {
  CONNECTION = 'connection',
  DISCONNECT = 'disconnect',
  HEARTBEAT = 'heartbeat',
  ERROR = 'error',
  DATA = 'data',
  KICK = 'kick' // kick user
}

enum ResCode {
  OK = 200,
  FAIL = 500,
  OLD_CLIENT = 501
}

export const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10
export const DEFAULT_RECONNECT_DELAY = 3 * 1000

export interface HandshakeBuffer {
  sys: {
    type: string,
    version: string,
    rsa?: {
      rsa_n?: string | number,
      rsa_e?: string | number,
    },
  },
  user: PlainData,
}

export interface RegaxUDPConnectOpts {
  host: string
  port: number
  udpType?: string
  handshakeBuffer: HandshakeBuffer
  creatSocket: CreateUDPSocket
  maxReconnectAttempts?: number
}

export class RegaxUDPSocket extends EventEmitter<SocketEvent> {
  static event = SocketEvent
  readonly event: typeof SocketEvent = SocketEvent
  protected socket?: UDPSocket
  protected heartbeat: Tick = new Tick()
  protected host: string
  protected port: number
  protected reconncetTimer?: NodeJS.Timer
  protected reconnectAttempts: number = 0
  protected reconnectionDelay: number = DEFAULT_RECONNECT_DELAY
  protected handshakeBuffer: HandshakeBuffer
  protected maxReconnectAttempts: number
  protected isClosed = false
  connect(opts: RegaxUDPConnectOpts): this {
    console.log(`[regax-udpsocket] connect to ${opts.host}:${opts.port}` + (this.reconnectAttempts !== 0 ? `: ${this.reconnectAttempts + 1} times` : ''))
    this.host = opts.host
    this.port = opts.port
    this.handshakeBuffer = opts.handshakeBuffer
    this.maxReconnectAttempts = opts.maxReconnectAttempts || DEFAULT_MAX_RECONNECT_ATTEMPTS
    const socket = this.socket = opts.creatSocket(opts.udpType || 'udp4')
    socket.on('message', (data: ByteArray) => {
      const msgs = Package.decode(data)
      if (Array.isArray(msgs)) {
        for (let i = 0; i < msgs.length; i++) {
          this.onMessage(msgs[i])
        }
      } else {
        this.onMessage(msgs)
      }
      // new package arrived, update the heartbeat timeout
      this.heartbeat.refreshNextTickTimeout()
    })
    socket.on('error', (e: Error) => {
      console.error('[regax-udpsocket] socket error: ', e)
      this.emit(SocketEvent.ERROR, RegaxError.create(e))
    })
    // socket.on('close', () => {
    // })
    // Send handshake buffer
    this.tryToConnect()
    return this
  }
  protected tryToConnect(): void {
    const packet = Package.encode(PackageType.HANDSHAKE, strencode(JSON.stringify(this.handshakeBuffer)))
    this.send(packet)
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts ++
      if (this.reconncetTimer) clearTimeout(this.reconncetTimer)
      this.reconncetTimer = setTimeout(() =>  {
        this.tryToConnect()
      }, this.reconnectionDelay)
      this.reconnectionDelay *= 2
    } else {
      this.close()
    }
  }
  send(buffer: ByteArray): this {
    if (this.socket) this.socket.send(buffer, 0, buffer.length, this.port, this.host)
    return this
  }
  close(): void {
    if (this.isClosed) return
    this.isClosed = true
    if (this.socket) {
      this.socket.close()
      this.socket = undefined
    }
    this.reconnectReset()
    this.heartbeat.stop()
    console.info('[regax-udpsocket] socket close.')
    this.emit(SocketEvent.DISCONNECT)
  }
  protected onMessage(msg: PackageDataType): void {
    const { type, body } = msg
    switch (type) {
      case PackageType.HANDSHAKE:
        this.reconnectReset()
        const data = JSON.parse(strdecode(body!))
        if (data.code === ResCode.OLD_CLIENT) {
          this.emit(SocketEvent.ERROR, RegaxError.create('client version not fullfill'))
          return
        }
        if (data.code !== ResCode.OK) {
          this.emit(SocketEvent.ERROR, RegaxError.create(data.message || 'handshake fail', data.code))
          return
        }
        if (data.sys && data.sys.heartbeat) {
          const heartbeatInterval = data.sys.heartbeat   // heartbeat interval
          const heartbeatTimeout = heartbeatInterval * 2        // max heartbeat timeout
          this.heartbeat.setTick(heartbeatInterval, heartbeatTimeout)
        } else {
          this.heartbeat.setTick(0, 0)
        }
        this.send(Package.encode(PackageType.HANDSHAKE_ACK))
        // handshake success
        this.emit(SocketEvent.CONNECTION, data)
        break
      case PackageType.HEARTBEAT:
        this.emit(SocketEvent.HEARTBEAT)
        this.heartbeat.next(() => {
          const obj = Package.encode(PackageType.HEARTBEAT)
          this.send(obj)
        }, () => {
          console.error('[regax-udpsocket] Server heartbeat timeout')
          this.close()
        })
        break
      case PackageType.DATA:
        this.emit(SocketEvent.DATA, body)
        break
      case PackageType.KICK:
        this.emit(SocketEvent.KICK, JSON.parse(strdecode(body!)))
        this.close() // kick from server
        break
    }
  }
  protected reconnectReset(): void {
    this.reconnectionDelay = DEFAULT_RECONNECT_DELAY
    this.reconnectAttempts = 0
    if (this.reconncetTimer) {
      clearTimeout(this.reconncetTimer)
      this.reconncetTimer = undefined
    }
  }
}
