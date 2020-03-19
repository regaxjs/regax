import * as path from 'path'
import { Application, ApplicationOpts } from '../../index'

export const defaultServerConfigs: ApplicationOpts[] = [
  { serverType: 'gate', connector: { port: 8091 } },
  { serverType: 'connector', connector: { port: 8092 } },
  { serverType: 'connector', connector: { port: 8093 } },
  { serverType: 'chat' },
  { serverType: 'chat' },
  { serverType: 'chat' },
]
export async function createTemplateServers(configs = defaultServerConfigs): Promise<Application[]> {
  const apps: Application[] = []
  for (let i = 0; i < configs.length; i ++) {
    const c = configs[i]
    const app = new Application(path.join(__dirname, '../template'), c.serverType)
    app.setConfig(Object.assign(c, {
      rpc: {
        canInvokeLocal: false
      }
    }))
    await app.start()
    apps.push(app)
  }
  return apps
}
