// tslint:disable:no-any

import { Application, Monitor } from '../index'
import * as expect from 'expect'
import { createTemplateServers, defaultServerConfigs } from './template'
import { delay } from '@regax/common'

describe.skip('component.monitor', () => {
  let servers: Application[]
  let monitor: Monitor
  beforeEach(async () => {
    servers = await createTemplateServers()
    monitor = new Monitor({
      keepalive: 10,
      invokeTimeout: 1000,
    })
    await monitor.start()
  })
  afterEach(async () => {
    await Promise.all(servers.map(s => s.stop()))
    monitor.stop()
  })
  it('api.getAllServers', async () => {
    const data = await monitor.getAllServers()
    expect(Object.keys(data).length).toEqual(defaultServerConfigs.length)
  })
  it('api.checkAllServersAlive', async () => {
    const serverIds = Object.keys(await monitor.getAllServers())
    const unAliveServers = await monitor.checkAllServersAlive()
    expect(unAliveServers).toEqual([])
    await servers[0].stop()
    expect(await monitor.checkAllServersAlive()).toEqual([])
    expect(await monitor.checkAllServersAlive(serverIds)).toEqual([servers[0].serverId])
  })
  it('api.checkServerAlive', async () => {
    expect(await monitor.checkServerAlive('UnknownServerId')).toEqual(false)
    const serverId = servers[0].serverId
    expect(await monitor.checkServerAlive(serverId)).toEqual(true)
    await servers[0].stop()
    expect(await monitor.checkServerAlive(serverId)).toEqual(false)
  })
  it.skip('api.clearDiedServers', async () => {
    const serverIds = Object.keys(await monitor.getAllServers())
    await servers[0].stop()
    expect(await monitor.clearDiedServers(serverIds)).toEqual([servers[0].serverId])
  })
  it.skip('api.stopServer', async () => {
    const serverId = servers[0].serverId
    await monitor.stopServer(serverId, 10)
    await delay(10)
    expect(await monitor.checkServerAlive(serverId)).toEqual(false)
  })
  it.skip('api.restartServer', async () => {
    const serverId = servers[0].serverId
    expect(await monitor.checkServerAlive(serverId)).toEqual(true)
    await monitor.restartServer(serverId, 10)
    await delay(20)
    expect(await monitor.checkServerAlive(serverId)).toEqual(true)
    await monitor.stopServer(serverId, 10)
    await delay(20)
    expect(await monitor.checkServerAlive(serverId)).toEqual(false)
  })
})
