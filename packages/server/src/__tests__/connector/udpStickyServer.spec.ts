// tslint:disable:no-any
import { Client } from '@regax/client-udpsocket'
import * as expect from 'expect'
import { Application } from '../../'
import { delay } from '@regax/common'
const assert = require('assert')
const dgram = require('dgram')
const path = require('path')

describe.skip('udpStickyServer', () => {
  let client: Client
  let server: Application
  function createClient(): Client {
    return new Client({
      host: '127.0.0.1',
      port: 33333,
      creatSocket: t => dgram.createSocket(t)
    })
  }
  beforeEach(() => {
    client = createClient()
    server = new Application(
      path.join(__dirname, '../../../lib/__tests__/template'),
      'master',
      {
        master: {
          servers: [
            { serverType: 'connector', sticky: true, clientPort: 33333, clientType: 'udp' },
            // { serverType: 'connector', sticky: true, clientPort: 33333, clientType: 'udp' },
            { serverType: 'chat' },
            { serverType: 'chat' }
          ]
        },
        udpConnector: {
          heartbeatInterval: 100,
        }
      }
    )
  })
  afterEach(async () => {
    if (client) client.disconnect()
    if (server ) await server.stop()
  })
  it('should start with heatbeat', async () => {
    let heartbeatTimes = 0
    client.on('heartbeat', () => {
      heartbeatTimes ++
    })
    await server.start()
    await client.connect()
    await delay(500)
    assert(heartbeatTimes > 3)
  })
  it('should send msg success by client', async () => {
    await server.start()
    const c1Room: any = {}
    const c2Room: any = {}
    const c1 = createClient()
    const c2 = createClient()
    c1.on('onChat', (d: any) => {
      c1Room[d.from] = d
    })
    c2.on('onChat', (d: any) => {
      c2Room[d.from] = d
    })
    await c1.connect()
    await c2.connect()
    await c1.request('connector.user.enter', { rid: 'room1', username: 'client1' })
    await c2.request('connector.user.enter', { rid: 'room1', username: 'client2' })
    await c1.request('chat.chat.send', { target: '*', content: 'hello world' })
    await c2.request('chat.chat.send', { target: '*', content: 'hello world' })
    const roomMsgs = {
      client1: { msg: 'hello world', from: 'client1', target: '*' },
      client2: { msg: 'hello world', from: 'client2', target: '*' },
    }
    await delay(10)
    expect(c1Room).toEqual(roomMsgs)
    expect(c2Room).toEqual(roomMsgs)
  })
})
