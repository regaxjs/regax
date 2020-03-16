// tslint:disable:no-any
import * as path from 'path'
const childProcess = require('child_process')
import { RegaxIPC } from './common/ipc'
import { createServer, ServerInfo } from '@regax/rpc'
import { createProxy } from '@regax/server/lib/util/proxy'

const toCammandOpts = (opts: any, arr: string[] = []) => Object.keys(opts).reduce((res: any, k: string) => {
  if (opts[k] === undefined) return res
  return res.concat(`--${k}`, opts[k])
}, arr)

async function createAgentRPCServer(agent: any, services: any): Promise<ServerInfo> {
  const server = createServer({
    serverType: 'egg-agent',
    services,
    logger: agent.logger,
    port: agent.config.regax.agentRPCPort,
  })
  await server.start()
  agent.logger.info('[egg-regax] egg-agent rpc server started on port: ' + server.serverInfo.port)
  return server.serverInfo
}

export function createAgent(agent: any): void {
  const ipc = new RegaxIPC(agent.messenger, 'agent')

  agent.messenger.once('egg-ready', async () => {
    const regaxBin = path.join(agent.baseDir, './node_modules/@regax/server/bin/regax')
    ipc.ready()
    // Create agent rpc server
    const __eggAgentServerInfo = await createAgentRPCServer(agent, createProxy((service: string) => (data: any) => ipc.invoke(service, data)))
    const options = {
      directory: path.join(agent.baseDir, './app/regax'),
      env: agent.config.env,
      type: 'master',
      configs: JSON.stringify({
        loader: {
          plugins: {
            egg: { enable: true, path: path.join(__dirname, '..') },
            logrotator: false, // use chair logroator instead
          },
        },
        __loggerDir: agent.config.logger.dir,
        __eggConfig: agent.config,
        __eggAgentServerInfo,
      }),
    }
    const cmdOpts = toCammandOpts(options, ['start'])
    childProcess.fork(regaxBin, cmdOpts, {
      detached: false,
      stdio: 'inherit',
    })
  })
}
