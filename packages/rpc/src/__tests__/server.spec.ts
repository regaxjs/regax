// tslint:disable:no-any
import * as expect from 'expect'
import { createServer, Server, createClient, Client, LocalRegistry } from '../index'
import { TestLogger, expectThrow } from './testUtil'
import { delay } from '@regax/common'
const INVOKE_TIMEOUT = 200

describe('# server', () => {
  describe('# server create', () => {
    it('should generate an port automatically if no port is provided', async () => {
      const server = createServer({ services: {} })
      await server.start()
      expect(server.serverInfo).toBeDefined()
      const server2 = createServer({ services: {}, ...server.serverInfo, autoport: false })
      await expectThrow(() => server2.start(), 'already in use') // port in use
      server.stop()
      await server2.start()
      server2.stop()
    })
    it('should sync to registry when server is created', async () => {
      const server = createServer({ services: {} })
      const registry = new LocalRegistry({ })
      registry.start()
      await server.start()
      let serverMap = await registry.getAllServers()
      expect(serverMap[server.serverId]).toEqual(server.serverInfo)
      server.stop()
      serverMap = await registry.getAllServers()
      expect(serverMap[server.serverId]).toEqual(undefined)
      registry.stop()
    })
  })
  describe('# server rpc invoke', () => {
    let server: Server
    let client: Client
    beforeEach(async () => {
      server = createServer({
        // rpcDebugLog: true,
        services: {
          async plus(a, b): Promise<any> {
            return a + b
          },
          async invokeError(): Promise<any> {
            throw new Error('invoke error message')
          },
          async busy(): Promise<any> {
            return delay(500)
          }
        }
      })
      client = createClient({
        invokeTimeout: INVOKE_TIMEOUT
        // rpcDebugLog: true,
      })
      await server.start()
      await client.start()
    })
    afterEach(async () => {
      server.stop()
      client.stop(true)
    })
    it('should return a value when invoke rpc service', async () => {
      const res = await client.rpcInvoke(server.serverId, 'plus', [1, 2])
      expect(res).toEqual(3)
    })
    it ('should throw an error invoke rpc when the service invoked with error', async () => {
      await expectThrow(() => client.rpcInvoke(server.serverId, 'invokeError'), 'invoke error message')
    })
    it('should throw an error when the service is undefined', async () => {
      await expectThrow(() => client.rpcInvoke('unknownServer', 'call1'), 'fail to find remote server')
      await expectThrow(() => client.rpcInvoke(server.serverId, 'unknownService'), 'no such service')
    })
    it ('should invoke timeout when the server is busy', async () => {
      await expectThrow(() => client.rpcInvoke(server.serverId, 'busy'), `timeout ${INVOKE_TIMEOUT}`)
    })
    it('should invoke pending when the client is connecting', async () => {
      const logger = new TestLogger({})
      const client2 = createClient({
        invokeTimeout: INVOKE_TIMEOUT,
        logger,
        rpcDebugLog: true,
      })
      await client2.start()
      const call = () => client2.rpcInvoke(server.serverId, 'plus', [1, 2])
      expect(await Promise.all(Array(5).fill(call).map(fn => fn())))
        .toEqual(Array(5).fill(3))
      // console.log(logger.msgs)
      expect(logger.match('addToPending')).toEqual(4)
      client2.stop(true)
    })
  })
})
