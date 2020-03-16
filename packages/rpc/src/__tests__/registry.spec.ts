// tslint:disable:no-any
import { LocalRegistry, ZookeeperRegistry, RemoteCacheRegistry, Registry } from '../'
import * as expect from 'expect'
import { expectThrow } from './testUtil'
import { delay } from '@regax/common'

function baseRegistryTest(desc: string, RegistryClass: any, opts: any = {}): void {
  describe(desc, () => {
    let zk: Registry
    let zk2: Registry
    beforeEach(() => {
      zk = new RegistryClass({
        rootPath: '/regax-rpc-test',
        ...opts,
      })
      zk2 = new RegistryClass({
        rootPath: '/regax-rpc-test',
        ...opts,
      })
      zk.start()
      zk2.start()
    })
    afterEach(() => {
      zk.stop()
      zk2.stop()
    })
    it('server registry', async () => {
      let info = {
        host: 'localhost',
        serverType: 'any',
        serverId: 'server1',
        port: 3333
      }
      await zk.register(info)
      expect(await zk.getAllServers()).toEqual({ [info.serverId]: info })
      expect(await zk.getServerInfo('server1')).toEqual(info)
      info = Object.assign(info, { serverType: 'any2' })
      await zk.register(info)
      expect(await zk.getAllServers()).toEqual({ [info.serverId]: info })
      expect(await zk2.getAllServers()).toEqual({ [info.serverId]: info })
      expect(await zk.getServerInfo('server1')).toEqual(info)
      expect(await zk2.getServerInfo('server1')).toEqual(info)
      zk.stop()
      await delay(20)
      // session disconnect
      expect(await zk2.getAllServers()).toEqual({})
      await expectThrow(() => zk.getAllServers(), 'CONNECTION_LOSS')
    })
    it('server subscribe and unsubscribe', async () => {
      let serverList1: any
      let serverList2: any
      let c1 = 0
      let c2 = 0
      function fn1(serverList: any): void {
        c1++
        serverList1 = serverList
      }
      function fn2(serverList: any): void {
        c2++
        serverList2 = serverList
      }
      const unSub1 = zk.subscribe(fn1)
      zk2.subscribe(fn2)
      await zk.register({ host: 'localhost', serverType: '1', serverId: 'server1', port: 3333 })
      await zk2.register({ host: 'localhost', serverType: '2', serverId: 'server2', port: 4444 })
      await zk.register({ host: 'localhost', serverType: '2', serverId: 'server2', port: 5555 })
      await zk.unRegister('server1')
      await delay(100)
      expect(serverList1).toEqual({ server2: { host: 'localhost', serverType: '2', serverId: 'server2', port: 5555 }})
      expect(serverList2).toEqual({ server2: { host: 'localhost', serverType: '2', serverId: 'server2', port: 5555 }})
      expect(c1).toEqual(1)
      expect(c2).toEqual(1)
      unSub1()
      await zk2.register({ host: 'localhost', serverType: '2', serverId: 'server3', port: 4444 })
      await delay(100)
      expect(serverList1).toEqual({ server2: { host: 'localhost', serverType: '2', serverId: 'server2', port: 5555 }}) // no changed
      expect(serverList2).toEqual({
        server2: { host: 'localhost', serverType: '2', serverId: 'server2', port: 5555 },
        server3: { host: 'localhost', serverType: '2', serverId: 'server3', port: 4444 }
      })
      expect(c1).toEqual(1)
      expect(c2).toEqual(2)
    })
  })
}

describe('# Registry', () => {
  baseRegistryTest('# ZookeeperRegistry', ZookeeperRegistry, { username: 'regax', password: 'regax' })
  baseRegistryTest('# LocalRegistry', LocalRegistry, { changeDelay: 10 })
  baseRegistryTest('# RemoteCacheRegistry', RemoteCacheRegistry, { syncInterval: 10 })
})
