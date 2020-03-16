// tslint:disable:no-any
import * as path from 'path'
import { Application } from '../application'
import { ServerMap } from '@regax/rpc'
import * as ws from 'ws'
import { Client } from '@regax/client-websocket'

const assert = require('assert')

describe('master', () => {
  let serverMap: ServerMap = {}
  const assertCount = (serverType: string, count: number) => assert.ok(Object.keys(serverMap).filter(w => serverMap[w].serverType === serverType).length === count)
  const filter = (serverType: string) => Object.keys(serverMap).filter(k => serverMap[k].serverType === serverType).map(k => serverMap[k])
  beforeEach(() => {
    serverMap = {}
  })
  it('start master app with multi process', async () => {
    const app = new Application(
      path.join(__dirname, '../../lib/__tests__/template'),
      'master',
    )
    app.setConfig({
      master: {
        servers: [
          { serverType: 'gate', clientPort: 3021 },
          { serverType: 'connector', clientPort: 3022 },
          { serverType: 'connector', clientPort: 3023 },
          { serverType: 'chat', port: 3024 },
          { serverType: 'chat', port: 3025 },
        ],
      }
    })
    await app.start()
    serverMap = await app.getAllServers()
    assert.ok(Object.keys(serverMap), 6)
    assertCount('master', 1)
    assertCount('gate', 1)
    assertCount('connector', 2)
    assertCount('chat', 2)
    const c1 = new Client({ url: `ws://127.0.0.1:${3021}`, reconnect: false, WebSocket: ws })
    const c2 = new Client({ url: `ws://127.0.0.1:${3023}`, reconnect: false, WebSocket: ws })
    await c1.connect()
    await c2.connect()
    await c1.request('connector.user.enter', { rid: 'room1', username: 'client1' })
    await c2.request('connector.user.enter', { rid: 'room1', username: 'client2' })
    c1.disconnect()
    c2.disconnect()
    await app.stop()
  })
  it('start master app by sticky mode', async () => {
    const app = new Application(
      path.join(__dirname, '../../lib/__tests__/template'),
      'master',
    )
    const STICKY_PORT = 3001
    app.setConfig({
      master: {
        servers: [
          { serverType: 'gate' },
          { serverType: 'connector', sticky: true, clientPort: STICKY_PORT },
          { serverType: 'connector', sticky: true, clientPort: STICKY_PORT },
          { serverType: 'chat' },
          { serverType: 'chat' },
        ],
      },
    })
    await app.start()
    serverMap = await app.getAllServers()
    assert.ok(Object.keys(serverMap), 6)
    assertCount('master', 1)
    assertCount('gate', 1)
    assertCount('connector', 2)
    assertCount('chat', 2)
    filter('connector').forEach((c: any) => assert.ok(c.clientPort === STICKY_PORT))
    filter('gate').forEach((c: any) => assert.ok(c.clientPort !== STICKY_PORT)) // sticky only support connector server
    const c1 = new Client({ url: `ws://127.0.0.1:${STICKY_PORT}`, reconnect: false, WebSocket: ws })
    const c2 = new Client({ url: `ws://127.0.0.1:${STICKY_PORT}`, reconnect: false, WebSocket: ws })
    await c1.connect()
    await c2.connect()
    await c1.request('connector.user.enter', { rid: 'room1', username: 'client1' })
    await c2.request('connector.user.enter', { rid: 'room1', username: 'client2' })
    c1.disconnect()
    c2.disconnect()
    await app.stop()
  })
})
