// tslint:disable:no-any
import { EventEmitter, PromiseDelegate } from '@regax/common'
import * as net from 'net'
import { Command, commands } from './commands'
import { Application, Connector, ConnectorEvent } from '../api'
import { ConnectorOpts } from '../component/connector'
import { UDPSocket } from './udpSocket'
import { Socket } from 'dgram'
import { STICKY_SERVER } from './udpStickyServer'

const dgram = require('dgram')

export const DEFAULT_UDP_HEARTBEAT_TIME = 20 * 1000
export const DEFAULT_UDP_HEARTBEAT_TIMEOUT = 100 * 1000
export const DEFAULT_UDP_TYPE = 'udp4'

interface Addr {
  address: string,
  port: number,
}
const genKey = (addr: Addr) => addr.address + ':' + addr.port

let genId = 1

export interface UDPConnectorOpts {
  udpType?: string // default udp4
  heartbeatInterval?: number // udp connector heartbeat, ms
  heartbeatTimeout?: number // udp connector heartbeat timeout, ms
}

export class UDPConnector extends EventEmitter<ConnectorEvent> implements Connector {
  server: Socket
  protected clients: { [clientKey: string]: UDPSocket } = {}
  protected commands: Command[]
  protected opts: ConnectorOpts & UDPConnectorOpts
  constructor(
    protected readonly app: Application,
  ) {
    super()
    const connectorOpts = this.app.getConfig<ConnectorOpts>('connector') || {}
    const defaultOpts: UDPConnectorOpts = {
      udpType: DEFAULT_UDP_TYPE,
      heartbeatInterval: connectorOpts.heartbeatInterval || DEFAULT_UDP_HEARTBEAT_TIME, // UDP heartbeat should be opened
      heartbeatTimeout: connectorOpts.heartbeatTimeout || DEFAULT_UDP_HEARTBEAT_TIMEOUT,
    }
    this.opts = Object.assign({},
      connectorOpts,
      defaultOpts,
      this.app.getConfig<UDPConnectorOpts>('udpConnector') || {}
    )
  }
  async start(): Promise<number> {
    const p = new PromiseDelegate<number>()
    this.commands = commands.map(Cmd => (new Cmd(this.opts) as Command))
    if (this.opts.sticky) {
      this.onStickyStart()
      p.resolve(this.opts.port)
    } else {
      this.server = dgram.createSocket(this.opts.udpType)
      this.server.once('listening', () => {
        const addr = this.server.address() as net.AddressInfo
        if (!addr) throw new Error(`[regax-connector] Regax UDP Connector server (${this.app.serverType}) started error.`)
        this.app.coreLogger.info(`[regax-connector] Regax UDP Connector server (%s) started on ${addr.address}:${addr.port}`, this.app.serverType)
        p.resolve(addr.port)
      })
      this.server.on('message', this.onServerMessage.bind(this))
      this.server.bind(this.opts.port)
    }
    return p.promise
  }
  protected onServerMessage(message: any, addr: Addr): void {
    this.onConnection(addr)
    const clientKey = genKey(addr)
    const socket = this.clients[clientKey]
    if (socket) {
      socket.onMessage(message)
    }
  }
  async stop(): Promise<void> {
    if (this.server) this.server.close()
    // close all clients
    Object.keys(this.clients).forEach((k: string) => {
      this.clients[k].close()
    })
  }
  protected onStickyStart(): void {
    this.app.service.messenger.onMessage(STICKY_SERVER, server => {
      this.server = server
      this.server.on('message', this.onServerMessage.bind(this))
    })
  }
  protected onConnection(addr: Addr): void {
    const clientKey = genKey(addr)
    if (!this.clients[clientKey]) {
      const socket = new UDPSocket(genId++, this.server, { host: addr.address, port: addr.port }, this.app.logger)
      this.clients[clientKey] = socket
      this.commands.forEach(cmd => {
        if (cmd.start) cmd.start(socket)
        if (cmd.handle) socket.on(cmd.event, msg => cmd.handle!(socket, msg))
      })
      socket.once(socket.event.DISCONNECT, () => {
        process.nextTick(() => {
          if (this.clients[clientKey] && this.clients[clientKey].closed) {
            delete this.clients[clientKey]
          }
        })
      })
      this.emit(ConnectorEvent.CONNECTION, socket)
    }
  }
}
