// tslint:disable:no-any
import * as expect from 'expect'
import { expectThrow, TestLogger } from './testUtil'
import { createServer, Server, createClient } from '../index'

describe('#client', () => {
  let server: Server
  let logger: TestLogger
  beforeEach(async () => {
    logger = new TestLogger({})
    server = createServer({
      port: 3333,
      // rpcDebugLog: true,
      services: {
        async plus(a, b): Promise<any> {
          return a + b
        },
      }
    })
    await server.start()
  })
  afterEach(() => {
    server.stop()
  })
  describe('#create', () => {
    it('should be ok for creating client with an empty opts', async () => {
      const client = createClient()
      expect(client).toBeDefined()
      await client.start()
      client.stop(true)
    })
  })

  describe('#status', () => {
    it('should warn if start twice', async () => {
      const client = createClient({ logger, rpcDebugLog: true })
      await client.start()
      await client.start()
      expect(logger.match('has started', 'warn')).toEqual(1)
    })

    it('should ignore the later operation if stop twice', async () => {
      const client = createClient({ logger, rpcDebugLog: true })
      client.stop()
      client.stop()
      expect(logger.match('not running', 'warn'))
    })

    it('should throw an error if try to do rpc invoke when the client not start', async () => {
      const client = createClient({ logger, rpcDebugLog: true })
      await expectThrow(() => client.rpcInvoke('server1', 'service1'), 'not running')
    })

    it('should throw an error if try to do rpc invoke after the client stop', async () => {
      const client = createClient({ logger, rpcDebugLog: true })
      await client.start()
      expect(await client.rpcInvoke(server.serverId, 'plus', [1, 1])).toEqual(2)
      client.stop()
      await expectThrow(() => client.rpcInvoke(server.serverId, 'plus', [1, 1]), 'not running')
    })
  })

})
