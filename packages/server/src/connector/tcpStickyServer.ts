// tslint:disable:no-any
import * as net from 'net'
import { PromiseDelegate } from '@regax/common'
import Master from '../component/master'
import { StickyServer, Application } from '../api'

export const STICKY_CONNECTION = 'regax:sticky-connection'

export class TCPStickyServer implements StickyServer {
  protected server: net.Server
  protected master: Master
  constructor(protected port: number, app: Application) {
    this.master = app.get('master')
  }
  protected onConnection(connection: any): void {
    // default use round-robin to select worker
    const worker = this.master.roundRobinWorker('ws')
    worker.send(STICKY_CONNECTION, connection)
  }
  start(): Promise<void> {
    const p = new PromiseDelegate<void>()
    this.server = net.createServer({
      pauseOnConnect: true,
    }, (connection: any) => {
      // We received a connection and need to pass it to the appropriate
      // worker. Get the worker for this connection's source IP and pass
      // it the connection.

      /* istanbul ignore next */
      if (!connection.remoteAddress) {
        // This will happen when a client sends an RST(which is set to 1) right
        // after the three-way handshake to the server.
        // Read https://en.wikipedia.org/wiki/TCP_reset_attack for more details.
        connection.destroy()
      } else {
        this.onConnection(connection)
      }
    })
    this.server.listen(this.port, () => {
      p.resolve()
    })
    return p.promise
  }
  async stop(): Promise<void> {
    if (this.server) this.server.close()
  }
}
