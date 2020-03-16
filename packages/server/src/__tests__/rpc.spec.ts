// tslint:disable:no-any

import * as ws from 'ws'
import * as expect from 'expect'
import { Application, ApplicationOpts } from '../index'
import { Client } from '@regax/client-websocket'
import { createTemplateServers } from './template'
import { delay } from '@regax/common'

const host = require('address').ip()

const serverConfigs: ApplicationOpts[] = [
  { serverType: 'gate', connector: { port: 8091, maxConnectionCount: 2 } },
  { serverType: 'connector', connector: { port: 8092, maxConnectionCount: 2 } },
  { serverType: 'connector', connector: { port: 8093, maxConnectionCount: 2 } },
  { serverType: 'chat' },
  { serverType: 'chat' },
  { serverType: 'chat' },
]
describe('regax rpc invoke', () => {
  let servers: Application[]
  let c1: Client
  let c2: Client
  beforeEach(async () => {
    servers = await createTemplateServers(serverConfigs)
    c1 = new Client({ url: `ws://${host}:8092`, reconnect: false, WebSocket: ws })
    c2 = new Client({ url: `ws://${host}:8093`, reconnect: false, WebSocket: ws })
    await c1.connect()
    await c2.connect()
  })
  afterEach(async () => {
    await Promise.all(servers.map(s => s.stop()))
    c1.disconnect()
    c2.disconnect()
  })
  it('should send msg success by client', async () => {
    const c1Room: any = []
    const c2Room: any = []
    c1.on('onChat', (d: any) => {
      c1Room.push(d)
    })
    c2.on('onChat', (d: any) => {
      c2Room.push(d)
    })
    await c1.request('connector.user.enter', { rid: 'room1', username: 'client1' })
    await c2.request('connector.user.enter', { rid: 'room1', username: 'client2' })
    await c1.request('chat.chat.send', { target: '*', content: 'hello world' })
    await c2.request('chat.chat.send', { target: '*', content: 'hello world' })
    const roomMsgs = [
      { msg: 'hello world', from: 'client1', target: '*' },
      { msg: 'hello world', from: 'client2', target: '*' }
    ]
    await delay(10)
    expect(c1Room).toEqual(roomMsgs)
    expect(c2Room).toEqual(roomMsgs)
  })
})
