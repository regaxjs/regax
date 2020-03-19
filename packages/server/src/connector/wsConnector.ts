// tslint:disable:no-any
import { EventEmitter, PromiseDelegate } from '@regax/common'
import * as WebSocket from 'ws'
import * as http from 'http'
import * as net from 'net'
import { WSSocket } from './wsSocket'
import { commands, Command } from './commands'
import { Application, Connector, SocketEvent, ConnectorEvent } from '../api'
import { ConnectorOpts } from '../component/connector'

const address = require('address').ip()

let genId = 1

export interface WebSocketConnectorOpts {
  httpServer?: http.Server,
}
import { STICKY_CONNECTION } from './tcpStickyServer'

export class WSConnector extends EventEmitter<ConnectorEvent> implements Connector {
  server: http.Server
  protected wss: WebSocket.Server
  protected commands: Command[]
  constructor(
    protected readonly app: Application
  ) {
    super()
  }
  async start(): Promise<number> {
    let server: http.Server
    const p = new PromiseDelegate<number>()
    const opts = Object.assign(
      this.app.getConfig<ConnectorOpts>('connector') || {},
    this.app.getConfig<WebSocketConnectorOpts>('wsConnector') || {},
      )
    this.commands = commands.map(Cmd => (new Cmd(opts) as Command))
    if (!opts.httpServer) {
      server = http.createServer()
      server.on('request', (req, res) => {
        res.writeHead(200)
        res.end('regax server')
      })
    } else {
      server = opts.httpServer
    }
    this.server = server
    this.wss = new WebSocket.Server({ server: this.server })
    this.wss.on('connection', (s: WebSocket) => {
      // @ts-ignore origin socket
      const _socket = s._socket
      const socket = new WSSocket(genId++, s, { host: _socket.remoteAddress, port: _socket.remotePort }, this.app.coreLogger)
      this.commands.forEach(cmd => {
        if (cmd.start) cmd.start(socket)
        if (cmd.handle) socket.on(cmd.event, msg => cmd.handle!(socket, msg))
      })
      socket.on(SocketEvent.DISCONNECT, () => {
        this.emit(ConnectorEvent.DISCONNECT, socket)
      })
      this.emit(ConnectorEvent.CONNECTION, socket)
    })
    if (opts.sticky) {
      this.onStickyStart()
      p.resolve(opts.port)
      return p.promise
    }
    if (!opts.port) {
      const addr = this.server.address() as net.AddressInfo
      if (!addr) throw new Error(`Regax Websocket connector server (${this.app.serverType}) was started without port.`)
      this.app.coreLogger.info(`[regax-connector] Regax Websocket connector server (%s) was started on ${address}:${addr.port}`, this.app.serverType)
      p.resolve(addr.port)
      return p.promise
    }
    server.listen(opts.port)
    server.once('listening', () => {
      const addr = this.server.address() as net.AddressInfo
      if (!addr) throw new Error(`[regax-connector] Regax Websocket connector server (${this.app.serverType}) was started with error.`)
      this.app.coreLogger.info(`[regax-connector] Websocket connector server (%s) was started on ${address}:${addr.port}`, this.app.serverType)
      p.resolve(addr.port)
    })
    server.once('error', (e: Error) => {
      this.app.coreLogger.error('[regax-connector] Regax Websocket connector (%s) Server was started with error: ', this.app.serverType, e)
      p.reject(e)
    })
    return p.promise
  }
  protected onStickyStart(): void {
    this.app.service.messenger.onMessage(STICKY_CONNECTION, (connection: any) => {
      // Emulate a connection event on the server by emitting the
      // event with the connection the master sent us.
      this.server.emit('connection', connection)
      connection.resume()
    })
  }
  async stop(): Promise<void> {
    if (this.wss) this.wss.close()
    if (this.server) this.server.close()
  }
}
