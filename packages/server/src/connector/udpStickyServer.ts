// tslint:disable:no-any
import { PromiseDelegate } from '@regax/common'
import { StickyServer, ApplicationOpts, Application } from '../api'
import { DEFAULT_UDP_TYPE } from './udpConnector'
import Master from '../component/master'
import { Socket } from 'dgram'
const dgram  = require('dgram')

export const STICKY_SERVER = 'regax:sticky-server'

export class UDPStickyServer implements StickyServer {
  protected server: Socket
  constructor(
    protected port: number,
    protected app: Application,
  ) {
  }
  start(): Promise<void> {
    const p = new PromiseDelegate<void>()
    const opts = this.app.getConfig<ApplicationOpts['udpConnector'] & {}>('udpConnector') || {}
    const server = this.server = dgram.createSocket(opts.udpType || DEFAULT_UDP_TYPE)
    server.on('listening',  () => {
      this.app.get<Master>('master')
        .getStickyWorkers('udp')
        .forEach(worker => {
          worker.send(STICKY_SERVER, server)
        })
      p.resolve()
    })
    server.bind(this.port)
    return p.promise
  }
  async stop(): Promise<void> {
    this.server.close()
  }
}
