// tslint:disable:no-any
import { Application, ApplicationEnv, ApplicationEvent } from '../api'
import { gracefulExit } from './gracefulExit'
import { WorkerRegistry } from './workerRegistry'
import { RegaxError } from '@regax/common'
const program = require('commander')
const DEFAULT_DIR = process.cwd()
const DEFAULT_ENV = ApplicationEnv.local

export interface ProcessOpts {
  env?: string,
  directory?: string,
  type?: string,
  port?: number,
  isWorker?: boolean,
  sticky?: boolean,
  configs?: string,
  clientPort?: number,
  clientType?: string,
}

export enum ProcessMsgType {
  APP_READY = 'regax:app-ready',
  PROCESS_STARTED = 'regax:process-started',
  RPC_SERVERS = 'regax:rpc-servers',
}

export interface ProcessMsg {
  type: ProcessMsgType,
  data?: any,
}

let app: Application
let workerRegistry: WorkerRegistry

program.command('start')
  .description('start the application')
  .option('-p, --port <rpc-port>', 'rpc port')
  .option('-e, --env <env>', 'the used environment', DEFAULT_ENV)
  .option('-d, --directory <directory>', 'the code directory', DEFAULT_DIR)
  .option('-t, --type <server-type>', 'start server type')
  .option('--sticky', 'sticky mode')
  .option('--clientPort <client-port>', 'client port for socket')
  .option('--clientType <client-type>', 'client port for socket')
  .option('--configs <application-configs>', 'application json configs')
  .option('--isWorker', 'mark as worker process, only for child_process')
  .action((opts: ProcessOpts) => {
    const configs = opts.configs ? JSON.parse(opts.configs) : {}
    app = new Application(opts.directory, opts.type, configs, opts.env as ApplicationEnv)
    gracefulExit(app)
    if (opts.port) {
      app.setConfig('rpc', { port: Number(opts.port) })
    }
    if (opts.clientPort) {
      app.setConfig('connector', { port: Number(opts.clientPort) })
    }
    if (opts.isWorker) {
      workerRegistry = new WorkerRegistry({ logger: app.coreLogger })
      app.setConfig({
        rpc: { registry: workerRegistry }
      })
    }
    if (opts.clientType) {
      app.setConfig({
        connector: { clientType: opts.clientType }
      })
    }
    if (opts.sticky) {
      app.setConfig({
        connector: { sticky: true, port: Number(opts.clientPort), clientType: opts.clientType }
      })
    }
    startApplication()
  })

function startApplication(): void {
  app.start().then(() => {
    listenProcessMessage()
    app.service.messenger.send(ProcessMsgType.PROCESS_STARTED, app.getServerInfo())
  }).catch((e: Error) => {
    try {
      app.coreLogger.error(e)
    } catch {
      console.error(e)
    }
    // Use SIGTERM kill process, ensure trigger the gracefulExit
    process.exitCode = 1
    process.kill(process.pid)
  })
}

function listenProcessMessage(): void {
  const messenger = app.service.messenger
  messenger.onMessage(ProcessMsgType.APP_READY, (data: any) => {
    app.emit(ApplicationEvent.READY, data)
  })
  messenger.onMessage(ProcessMsgType.RPC_SERVERS, (data: any) => {
    // update from master rpc registry
    workerRegistry.updateServerMap(data)
  })
}
process.on('unhandledRejection', (err: Error) => {
  // err maybe an object, try to copy the name, message and stack to the new error instance
  /* istanbul ignore else */
  err = RegaxError.create(err)
  /* istanbul ignore else */
  if (err.name === 'Error') {
    err.name = 'unhandledRejectionError'
  }
  if (app) app.coreLogger.error(err)
  else { console.error(err)}
})
program.parse(process.argv)
