// tslint:disable:no-any

import * as path from 'path'
import * as ws from 'ws'
import { Application, ApplicationOpts, ConnectionStatisticsInfo } from '../../index'
import { Client } from '@regax/client-websocket'
import * as expect from 'expect'
import { expectThrow } from '../testUtil'
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
describe('service.connection', () => {
  let servers: Application[]
  let c1: Client
  let c2: Client
  function getConnInfo(serverIndex: number): ConnectionStatisticsInfo {
    return servers[serverIndex].service.connection.getStatisticsInfo()
  }
  beforeEach(async () => {
    servers = await Promise.all(serverConfigs.map(async (c: ApplicationOpts) => {
      const app = new Application(path.join(__dirname, '../template'), c.serverType)
      app.setConfig(c)
      await app.start()
      return app
    }))
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
  it('should save to connection staticsticsInfo when client connected', async () => {
    expect(getConnInfo(0).totalConnCount).toEqual(0)
    expect(getConnInfo(1).totalConnCount).toEqual(1)
    expect(getConnInfo(2).totalConnCount).toEqual(1)
    expect(getConnInfo(3).totalConnCount).toEqual(0)
    c1.disconnect()
    c2.disconnect()
    await delay(10)
    expect(getConnInfo(1).totalConnCount).toEqual(0)
    expect(getConnInfo(2).totalConnCount).toEqual(0)
  })
  it('should auto disconnect when the maximum connections reached', async () => {
    const c3 = new Client({ url: `ws://${host}:8092`, reconnect: false, WebSocket: ws })
    const c4 = new Client({ url: `ws://${host}:8092`, reconnect: false, WebSocket: ws })
    const c5 = new Client({ url: `ws://${host}:8092`, reconnect: false, WebSocket: ws })
    await c3.connect()
    expect(getConnInfo(1).totalConnCount).toEqual(2)
    expectThrow(() => c4.connect(), 'Connection refused')
    expect(getConnInfo(1).totalConnCount).toEqual(2)
    c3.disconnect()
    await delay(10)
    expect(getConnInfo(1).totalConnCount).toEqual(1)
    c4.disconnect()
    await c5.connect()
    expect(getConnInfo(1).totalConnCount).toEqual(2)
    c5.disconnect()
  })
  it('should save the loginInfo when client connected', async () => {
    expect(getConnInfo(0).loginedCount).toEqual(0)
    expect(getConnInfo(1).loginedCount).toEqual(0)
    expect(getConnInfo(2).loginedCount).toEqual(0)
    expect(getConnInfo(3).loginedCount).toEqual(0)
    const c1Success = await c1.request('connector.user.enter', { rid: 'room1', username: 'client1'})
    const c2Success = await c2.request('connector.user.enter', { rid: 'room1', username: 'client2'})
    expect(c1Success).toBe(true)
    expect(c2Success).toBe(true)
    expect(getConnInfo(0).loginedCount).toEqual(0)
    expect(getConnInfo(1).loginedCount).toEqual(1)
    expect(getConnInfo(2).loginedCount).toEqual(1)
    expect(getConnInfo(3).loginedCount).toEqual(0)
    expect(getConnInfo(1).loginedList[0].uid).toEqual('client1*room1')
    await c1.request('connector.user.enter', { rid: 'room1', username: 'client1_1'})
    expect(getConnInfo(1).loginedCount).toEqual(1)
    expect(getConnInfo(1).loginedList[0].uid).toEqual('client1_1*room1')
    c1.disconnect()
    await delay(10)
    expect(getConnInfo(1).loginedCount).toEqual(0)
  })
})
