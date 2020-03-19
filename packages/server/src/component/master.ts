// tslint:disable:no-any
import { Application } from '../application'
import { ApplicationEvent, ApplicationServerInfo, Component, inject, injectable, CONNECTOR_DEFAULT_CLIENT_TYPE, ApplicationOpts, StickyServer } from '../api'
import * as path from 'path'
import { ProcessMsg, ProcessMsgType, ProcessOpts } from '../master/childProcess'
import RPC from './rpc'
import { ChildProcess } from 'child_process'
import { terminate } from '../master/terminate'
import { RegaxError } from '@regax/common'

const childProcess = require('child_process')
const awaitEvent = require('await-event')

interface ServerConfig {
  serverType: string,
  port?: number,
  clientPort?: number, // for connector port
  clientType?: string, // udp/tcp/ws, default ws
  sticky?: boolean, // client socket as sticky
}

export interface WorkerServerInfo extends ApplicationServerInfo {
  pid: number,
}

export interface MasterOpts {
  servers: ServerConfig[],
  terminateTimeout?: number,
}

export const DEFAULT_TERMINATE_TIMEOUT = 5000
const processModulePath = path.join(__dirname, '../../lib/master/childProcess')
const toCammandOpts = (opts: any, arr: string[] = []) => Object.keys(opts).reduce((res: any, k: string) => {
  if (opts[k] === undefined) return res
  return res.concat(`--${k}`, opts[k])
}, arr)

@injectable()
export default class MasterComponent implements Component {
  protected opts: MasterOpts
  protected workerInfos: Map<number, WorkerServerInfo> = new Map()
  protected stickyServers: StickyServer[] = []
  protected workers: ChildProcess[] = []
  protected agentProcess: ChildProcess
  protected agentStarted: boolean = false
  protected allReady: boolean = false
  protected workerCount: number = 0
  protected started: boolean = false
  protected stopped: boolean = false
  protected rrIndex: number = 0
  constructor(
    @inject(Application) protected readonly app: Application,
    @inject(RPC) protected readonly rpc: RPC,
  ) {
    this.opts = this.app.getConfig('master') || {}
    this.rpc.rpcRegistry.subscribe(data => this.broadcast({ type: ProcessMsgType.RPC_SERVERS, data }))
  }
  protected async startStickyServersFromMaster(): Promise<void> {
    const servers = this.opts.servers
    const stickyPorts: { [clientType: string]: number} = {}
    for (const i in servers) {
      const serverConfig = servers[i]
      if (serverConfig.sticky) {
        const clientType = serverConfig.clientType || CONNECTOR_DEFAULT_CLIENT_TYPE
        if (!serverConfig.clientPort) {
          throw new Error(`Sticky server "${clientType}" need a client port`)
        }
        if (stickyPorts[clientType] && stickyPorts[clientType] !== serverConfig.clientPort) {
          throw new Error(`Sticky server "${clientType}" must start with a same client port, but get ${stickyPorts[clientType]} <-> ${serverConfig.clientPort}`)
        }
        stickyPorts[clientType] = serverConfig.clientPort
      }
    }
    const stickyServerRegistries = this.app.getConfig<ApplicationOpts['stickyServerRegistries']>('stickyServerRegistries') || {}
    for (const clientType in stickyPorts) {
      if (!stickyServerRegistries[clientType]) {
        throw new Error(`Sticky server "${clientType}" is undefined.`)
      }
      const server: StickyServer = new stickyServerRegistries[clientType](stickyPorts[clientType], this.app)
      this.stickyServers.push(server)
      await server.start()
      this.app.coreLogger.info('[regax-master] Sticky server "%s" listening on port: %s', clientType, stickyPorts[clientType])
    }
  }
  async onStart(): Promise<void> {
    if (this.started) return Promise.resolve()
    this.started = true
    this.forkServers()
    this.app.onReady(() => {
      // wait to ready
      this.startStickyServersFromMaster()
    })
    return awaitEvent(this.app, ApplicationEvent.READY)
  }
  async onStop(): Promise<void> {
    if (!this.started || this.stopped) return
    this.stopped = true
    await Promise.all(this.stickyServers.map(server => server.stop()))
    const terminateTimeout = this.opts.terminateTimeout || DEFAULT_TERMINATE_TIMEOUT
    for (let i = 0, len = this.workers.length; i < len; i ++) {
      await terminate(this.workers[i], terminateTimeout)
    }
    await terminate(this.agentProcess, terminateTimeout)
  }
  protected forkServers(): void {
    const servers = this.opts.servers
    // fork agent
    this.forkAgent()
    // fork workers
    for (const i in servers) {
      const serverConfig = servers[i]
      this.forkWorker(this.getWorkerOpts(serverConfig))
    }
  }
  protected forkAgent(): any {
    const options: ProcessOpts = {
      directory: this.app.baseDir,
      env: this.app.env,
      type: 'agent',
      configs: JSON.stringify(this.app.customConfigs)
    }
    const cmdOpts = toCammandOpts(options, ['start'])
    const child = childProcess.fork(processModulePath, cmdOpts, {
      detached: false,
      stdio: 'inherit',
    })
    child.on('message', (msg: ProcessMsg) => {
      const { type } = msg
      if (type === ProcessMsgType.PROCESS_STARTED) {
        this.agentStarted = true
        this.tryToReady()
      }
    })
    child.on('exit', (code: number) => {
      if (code) {
        this.app.coreLogger.error('[regax-master] agent process %s exit with error, error code: %s', child.pid, code)
      } else {
        this.app.coreLogger.info('[regax-master] agent process %s exit with code: %s', child.pid, code)
      }
    })
    child.on('error', (error: RegaxError) => {
      // if (error.code === 'ERR_IPC_CHANNEL_CLOSED') {
      // }
      this.app.coreLogger.error('[regax-master] agent process error: ', error)
    })
    this.agentProcess = child
  }
  protected forkWorker(options: ProcessOpts): void {
    const cmdOpts = toCammandOpts(options, ['start'])
    const child = childProcess.fork(processModulePath, cmdOpts, {
      detached: false,
      stdio: 'inherit',
    })
    child.on('message', (msg: ProcessMsg) => {
      const { type, data } = msg
      if (type === ProcessMsgType.PROCESS_STARTED) {
        data.pid = child.pid
        data.sticky = options.sticky
        data.clientType = options.clientType
        data.clientPort = options.clientPort
        // register the worker server
        this.workerInfos.set(child.pid, data)
        this.rpc.rpcRegistry.register(data)
          .catch((e: Error) => this.app.coreLogger.error('[regax-master] worker process register error: ', e))
          .then(() => {
            this.tryToReady()
          })
      }
    })
    child.on('exit', (code: number) => {
      if (code) {
        this.app.coreLogger.error('[regax-master] worker process %s exit with error, error code: %s', child.pid, code)
      } else {
        this.app.coreLogger.info('[regax-master] worker process %s exit with code: %s', child.pid, code)
      }
      if (this.stopped) return
      this.restartWorker(child)
        .catch(e => {
          this.app.coreLogger.error(`[regax-master] worker ${child.pid} restart error: `, e)
        })
    })
    child.on('error', (error: RegaxError) => {
      // if (error.code === 'ERR_IPC_CHANNEL_CLOSED') {
      // }
      this.app.coreLogger.error('[regax-master] worker process error: ', error)
    })

    this.workers.push(child)
    this.workerCount ++
  }
  tryToReady(): void {
    if (!this.allReady && this.agentStarted && this.workerInfos.size === this.workerCount) {
      // broadcast to all workers
      this.app.coreLogger.info('[regax-master] all process is ready')
      this.allReady = true
      this.broadcast({ type: ProcessMsgType.APP_READY })
      this.app.emit(ApplicationEvent.READY)
    }
  }
  broadcast(msg: ProcessMsg): void {
    if (this.stopped) return
    this.workers.forEach(worker => worker.send(msg))
  }
  async killWorker(pid: number): Promise<void> {
    if (this.workerInfos.get(pid)) {
      await terminate(pid, this.opts.terminateTimeout || DEFAULT_TERMINATE_TIMEOUT)
    }
  }
  async restartWorker(child: ChildProcess): Promise<void> {
    const pid = child.pid
    const workerInfo = this.workerInfos.get(pid)
    if (!workerInfo) return
    this.workerInfos.delete(pid)
    this.workers = this.workers.filter(w => w !== child)
    // this.rpc.rpcRegistry.unRegister(workerInfo.serverId)
    //  .catch((e: Error) => this.app.coreLogger.error('[regax-master] worker process unRegister error: ', e))
    await this.killWorker(pid)
    this.forkWorker(this.getWorkerOpts(workerInfo))
  }
  getWorkerOpts(workerInfo: ServerConfig): ProcessOpts {
    return {
      directory: this.app.baseDir,
      port: workerInfo.port,
      // clientPort: workerInfo.clientPort,
      isWorker: true,
      env: this.app.env,
      type: workerInfo.serverType,
      sticky: workerInfo.sticky,
      clientPort: workerInfo.clientPort,
      clientType: workerInfo.clientType,
      configs: JSON.stringify(this.app.customConfigs)
    }
  }
  getStickyWorkers(clientType: string): ChildProcess[] {
    return this.workers.filter(w => {
      const data = this.workerInfos.get(w.pid)
      return data && data.sticky && (data.clientType || CONNECTOR_DEFAULT_CLIENT_TYPE) === clientType
    })
  }
  roundRobinWorker(clientType: string): any {
    const stickyWorkers = this.getStickyWorkers(clientType)
    const len = stickyWorkers.length
    const worker = stickyWorkers[this.rrIndex % len]
    if (++this.rrIndex === Number.MAX_VALUE) {
      this.rrIndex = 0
    }
    return worker
  }
}
