// tslint:disable:no-any
import { Socket } from 'dgram'
import { RegaxUDPSocket } from './udpSocket'
import { delay } from '@regax/common'
import { Package, PackageType, strencode } from '@regax/protocol'
const dgram = require('dgram')
const assert = require('assert')

const PORT = 33333
const HOST = '127.0.0.1'

function send(server: any, type: PackageType, msg: any, remote: any = server.lastRemote): void {
  if (server.stopped) return
  const data = Package.encode(type, strencode(JSON.stringify(msg)))
  server.send(data, remote.port, remote.address)
}
function createServer(onConnection?: any, onData?: any): Socket  {
  const server = dgram.createSocket('udp4')

  server.on('close', () => server.stopped = true)
  server.on('listening',  () => {
    // const address = server.address()
    // console.log('UDP Server listening on ' + address.address + ':' + address.port)
  })

  server.on('message', async (message: any, remote: any) => {
    server.lastRemote = remote
    const msg: any = Package.decode(message)
    const { type } = msg
    switch (type) {
      case PackageType.HANDSHAKE:
        send(server, PackageType.HANDSHAKE, { code: 200, sys: { heartbeat: 1000 }}, remote)
        break
      case PackageType.HANDSHAKE_ACK:
        if (onConnection) onConnection()
        await delay(10)
        send(server, PackageType.HEARTBEAT, {}, remote)
        break
      case PackageType.HEARTBEAT:
        await delay(10)
        console.log('send heartbeat from server')
        send(server, PackageType.HEARTBEAT, {}, remote)
        break
      case PackageType.DATA:
        if (onData) onData(msg.body)
        break
    }
    // console.log(remote.address + ':' + remote.port + ' - ' + message)
  })
  server.bind(PORT, HOST)
  return server
}

function createClient(onConnection?: any): RegaxUDPSocket {
  const client = new RegaxUDPSocket()
  client.connect({ host: HOST, port: PORT, handshakeBuffer: handshakeMock, creatSocket: (type: string) => dgram.createSocket(type) })
  client.on(client.event.CONNECTION, () => {
    if (onConnection) onConnection()
  })
  return client
}
const handshakeMock = {
  sys: {
    type: '',
    version: '',
  },
  user: {}
}
describe('udpSocket', () => {
  let server: Socket
  let client: RegaxUDPSocket
  beforeEach(() => {
  })
  afterEach(() => {
    if (server) server.close()
    if (client) client.close()
    // @ts-ignore
    server = undefined
    // @ts-ignore
    client = undefined
  })
  it('should hanshake success when connecting', (done: any) => {
    let clientConnection = false
    server = createServer(() => {
      assert(clientConnection)
      done()
    })
    client = createClient(() => clientConnection = true)
  })
  it('should try again if hanshake was failed', (done: any) => {
    client = createClient(() => {
      done()
    })
    delay(100).then(() => {
      server = createServer()
    })
  })
  it('should start heartbeat if connected', (done: any) => {
    let heartbeatTimes = 0
    client = createClient()
    server = createServer()
    client.on(client.event.HEARTBEAT, () => {
      heartbeatTimes++
      if (heartbeatTimes === 3) done()
    })
  })
  it('should kick user success from server', (done: any) => {
    client = createClient()
    server = createServer(() => {
      send(server, PackageType.KICK, { reason: '' })
    })
    client.on(client.event.DISCONNECT, () => {
      done()
    })
  })
  it('should close once if emitting close duplicately', (done: any) => {
    client = createClient()
    client.on(client.event.DISCONNECT, () => {
      done()
    })
    client.close()
    client.close()
  })
  it ('should close before connecting next time', () => {
  })
  it('should send data success from server to client', () => {
  })
})
