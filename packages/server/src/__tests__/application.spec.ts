// tslint:disable:no-any
import * as assert from 'assert'
import * as path from 'path'
import { Application, ApplicationEnv } from '../'
import { ChannelService } from '../service/channelService'
import { SessionService } from '../service/sessionService'
import { ConnectionService } from '../service/connectionService'

const temp = path.join(__dirname, './template')
describe('application', () => {
  it('start app', async () => {
    const app = new Application(
      temp,
      'connector'
    )
    await app.start()
    assert.ok(app.serverId)
    assert.ok(app.service.channel instanceof ChannelService)
    assert.ok(app.service.session instanceof SessionService)
    assert.ok(app.service.connection instanceof ConnectionService)
    assert.ok(app.getConfig('testConfig'))
    assert.ok(app.get('app'))
    assert.ok(app.get('connector'))
    assert.ok(app.get('router'))
    assert.ok(app.get('rpc'))
    await app.stop()
  })
  it('app env', ( ) => {
    let app: Application
    const check = (env: ApplicationEnv | undefined, targetEnv: string) => {
      app = new Application(
        temp,
        'connector',
        {},
        env,
      )
      assert.ok(app.env, targetEnv)
    }
    const origin = process.env.NODE_ENV
    process.env.NODE_ENV = undefined
    check(undefined, ApplicationEnv.local)
    process.env.NODE_ENV = 'development'
    check(undefined, ApplicationEnv.local)
    assert.ok(app!.isLocal)
    process.env.NODE_ENV = 'production'
    check(undefined, ApplicationEnv.prod)
    assert.ok(!app!.isLocal)
    process.env.NODE_ENV = 'unittest'
    check(undefined, ApplicationEnv.unittest)
    process.env.NODE_ENV = 'test'
    check(undefined, ApplicationEnv.test)
    check(ApplicationEnv.prod, ApplicationEnv.prod)
    process.env.NODE_ENV = origin
  })
  it('serverType', () => {
    let app: Application
    app = new Application(temp)
    assert.ok(app.isMasterServer)
    assert.ok(!app.isAgentServer)
    assert.ok(!app.isFrontendServer)
    assert.ok(!app.isBackendServer)
    app = new Application(temp, 'connector')
    assert.ok(!app.isMasterServer)
    assert.ok(!app.isAgentServer)
    assert.ok(app.isFrontendServer)
    assert.ok(!app.isBackendServer)
    app = new Application(temp, 'gate')
    assert.ok(!app.isMasterServer)
    assert.ok(!app.isAgentServer)
    assert.ok(app.isFrontendServer)
    assert.ok(!app.isBackendServer)
    app = new Application(temp, 'agent')
    assert.ok(!app.isMasterServer)
    assert.ok(app.isAgentServer)
    assert.ok(!app.isFrontendServer)
    assert.ok(!app.isBackendServer)
    app = new Application(temp, 'other')
    assert.ok(!app.isMasterServer)
    assert.ok(!app.isAgentServer)
    assert.ok(!app.isFrontendServer)
    assert.ok(app.isBackendServer)
  })
  it('custom logger', () => {
    const app = new Application(temp)
    app.setConfig({
      customLogger: {
        logger1: {
          file: 'logger1.log',
          consoleLevel: 'NONE',
        }
      }
    })
    assert.ok(app.getLogger('logger1').info)
  })
  it('start with multi servers', async () => {
    const ports = [8041, 8042, 8043, 8044, 8045]
    const servers = await Promise.all(ports.map(async port => {
      const app = new Application(
        path.join(__dirname, './template'),
        'connector'
      )
      app.setConfig({
        connector: {
          port, // TODO port 如果相同会触发失败, 需要补充测试用例
        },
      })
      await app.start()
      return app
    }))
    await Promise.all(servers.map(s => s.stop()))
  })
})
