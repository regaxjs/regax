// tslint:disable:no-any
import { EventEmitter, PlainData, Tick, RegaxError } from '@regax/common'
import { ByteArray, Package, PackageType, strdecode, strencode, PackageDataType } from '@regax/protocol'

export enum SocketEvent {
  CONNECTION = 'connection',
  RECONNECT = 'reconnect',
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
export const DEFAULT_RECONNECT_DELAY = 5 * 1000

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

export interface WebSocket {
  binaryType: string;
  onclose: ((ev: any) => any) | null;
  onerror: ((ev: any) => any) | null;
  onmessage: ((ev: any) => any) | null;
  onopen: ((ev: any) => any) | null;
  close(code?: number, reason?: string): void;
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
}
export interface WebSocketClass {
  prototype: WebSocket;
  new(url: string, protocols?: string | string[]): WebSocket;
}

export interface RegaxWebSocketConnectOpts {
  reconnect?: boolean,
  maxReconnectAttempts?: number,
  handshakeBuffer: HandshakeBuffer,
  WebSocket?: WebSocketClass
}

export class RegaxWebSocket extends EventEmitter<SocketEvent> {
  static event = SocketEvent
  private socket?: WebSocket
  private reconnect: boolean
  private reconncetTimer: NodeJS.Timer
  private reconnectAttempts: number = 0
  private reconnectionDelay: number = DEFAULT_RECONNECT_DELAY
  private maxReconnectAttempts: number
  private handshakeBuffer: HandshakeBuffer
  private heartbeat: Tick = new Tick()
  protected isClosed = false
  readonly event: typeof SocketEvent = SocketEvent
  connect(url: string, opts: RegaxWebSocketConnectOpts ): this {
    if (this.socket) this.close()
    this.reconnect = opts.reconnect || false
    this.handshakeBuffer = opts.handshakeBuffer
    this.maxReconnectAttempts = opts.maxReconnectAttempts || DEFAULT_MAX_RECONNECT_ATTEMPTS
    const socket = this.socket = opts.WebSocket ? new opts.WebSocket(url) : new WebSocket(url)
    socket.binaryType = 'arraybuffer'
    socket.onopen = () => {
      if (this.reconnect) {
        this.emit(SocketEvent.RECONNECT)
      }
      this.reconnectReset()
      // send handshake buffer when connected
      const packet = Package.encode(PackageType.HANDSHAKE, strencode(JSON.stringify(this.handshakeBuffer)))
      this.send(packet)
    }
    socket.onmessage = (event: any) => {
      const msgs = Package.decode(event.data)
      if (Array.isArray(msgs)) {
        for (let i = 0; i < msgs.length; i++) {
          this.onMessage(msgs[i])
        }
      } else {
        this.onMessage(msgs)
      }
      // new package arrived, update the heartbeat timeout
      this.heartbeat.refreshNextTickTimeout()
    }
    socket.onerror = (event: any) => {
      console.error('[regax-websocket] socket error: ', event && event.error || '')
      this.emit(SocketEvent.ERROR, RegaxError.create(event && event.error ? event.error : 'socket error', 'SOCKET_ERROR'), event)
    }
    socket.onclose = (event: any) => {
      console.info('[regax-websocket] socket close: ', event && event.error || '')
      this.tryToReconnectIfFailed(url, opts)
    }
    console.log(`[regax-websocket] connect to ${url}` + (this.reconnectAttempts !== 0 ? `: ${this.reconnectAttempts + 1} times` : ''))
    return this
  }
  protected tryToReconnectIfFailed(url: string, opts: RegaxWebSocketConnectOpts): void {
    if (this.reconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts ++
      if (this.reconncetTimer) clearTimeout(this.reconncetTimer)
      this.reconncetTimer = setTimeout(() =>  {
        this.connect(url, opts)
      }, this.reconnectionDelay)
      this.reconnectionDelay *= 2
    } else {
      this.reconnectReset()
      this.emit(SocketEvent.DISCONNECT)
    }
  }
  send(buffer: ByteArray): this {
    if (this.socket) this.socket.send(buffer.buffer)
    return this
  }
  close(): void {
    if (this.isClosed) return
    this.isClosed = true
    if (this.socket) {
      if (this.socket.close) this.socket.close()
      this.socket = undefined
    }
    this.reconnectReset()
    this.heartbeat.stop()
  }
  protected onMessage(msg: PackageDataType): void {
    const { type, body } = msg
    switch (type) {
      case PackageType.HANDSHAKE:
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
          console.error('server heartbeat timeout')
          this.close()
        })
        break
      case PackageType.DATA:
        this.emit(SocketEvent.DATA, body)
        break
      case PackageType.KICK:
        this.emit(SocketEvent.KICK, JSON.parse(strdecode(body!)))
        break
    }
  }
  protected reconnectReset(): void {
    this.reconnect = false
    this.reconnectionDelay = DEFAULT_RECONNECT_DELAY
    this.reconnectAttempts = 0
    clearTimeout(this.reconncetTimer)
  }
}
