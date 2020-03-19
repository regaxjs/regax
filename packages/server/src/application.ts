// tslint:disable:no-any

import 'reflect-metadata'
import { each, EventEmitter } from '@regax/common'
import { Logger, RegaxLoggerManager } from '@regax/logger'
import { Container } from 'inversify'
import * as path from 'path'
import * as fs from 'fs'
import { ServerMap } from '@regax/rpc'
import { Service } from './service'
import { Component } from './api/component'
import { ApplicationEnv, ApplicationEvent, ApplicationOpts, ApplicationServerInfo } from './api/application'
import { LoaderManager } from './loader'
import { createLoggerManager } from './util/logger'
import { printLogo } from './util/logo'

const toPromise = (res: any) => Promise.all(Object.keys(res).map(key => Promise.resolve(res[key])))
const LOGGERS = Symbol('RegaxApplication#loggers')
const SERVICES = Symbol('RegaxApplication#services')

function getDefaultEnv(): ApplicationEnv {
  const env = process.env.NODE_ENV
  if (!env || env === 'development') return ApplicationEnv.local
  if (env === 'production') return ApplicationEnv.prod
  return env as ApplicationEnv
}

export class Application extends EventEmitter<ApplicationEvent> {
  static event = ApplicationEvent
  public readonly event = ApplicationEvent
  public readonly frameworkPath = __dirname
  public readonly loader: LoaderManager
  public appContext: any = {}
  public useAppDirMode = false
  protected components?: Component[]
  protected componentInfos: Map<Component | string, any> = new Map()
  protected isStarted = false
  protected isLoaded = false
  protected isLoading = false
  protected serverInfo: ApplicationServerInfo
  protected container = new Container()
  protected opts: ApplicationOpts & { app: {} } = { app: {} }
  protected [LOGGERS]: RegaxLoggerManager
  protected [SERVICES]: Service

  constructor(
    readonly baseDir = process.cwd(),
    readonly serverType: string = 'master',
    readonly customConfigs: ApplicationOpts = {},
    readonly env: ApplicationEnv = getDefaultEnv(),
  ) {
    super()
    if (this.baseDir.endsWith('/')) this.baseDir = this.baseDir.slice(0, -1)
    try {
      if (fs.statSync(path.join(this.baseDir, 'app')).isDirectory()) this.useAppDirMode = true
    } catch (e) { /* ignore */ }
    this.container.bind(Application).toConstantValue(this)
    this.container.bind('app').toConstantValue(this)
    this.setConfig(customConfigs)
    this.loader = new LoaderManager(this)
    this.loader.preload()
    this.once(ApplicationEvent.STARTED, () => this.isMasterServer && env !== ApplicationEnv.unittest && printLogo())
  }
  get logger(): Logger {
    return this.loggers.logger
  }
  get coreLogger(): Logger {
    return this.loggers.coreLogger
  }
  getLogger(name: string): Logger {
    return (this.loggers as any)[name] as Logger
  }
  get isLocal(): boolean {
    return this.env === ApplicationEnv.local
  }
  /**
   * current serverId
   */
  get serverId(): string {
    if (!this.serverInfo || !this.serverInfo.serverId) {
      if (this.serverType === 'agent') return this.serverType
      this.coreLogger.warn('[regax-application] Regax remote server does not started.')
      return this.serverType
    }
    return this.serverInfo.serverId
  }
  get serverVersion(): string | undefined {
    return this.opts.app.serverVersion
  }
  get isFrontendServer(): boolean {
    const serverType = this.serverType
    return serverType === 'connector' || serverType === 'gate'
  }
  get isBackendServer(): boolean {
    const serverType = this.serverType
    return !this.isFrontendServer && serverType !== 'master' && serverType !== 'agent'
  }
  get isMasterServer(): boolean {
    return this.serverType === 'master'
  }
  get isAgentServer(): boolean {
    return this.serverType === 'agent'
  }
  setServerInfo(serverInfo?: ApplicationServerInfo, clientPort?: number): void {
    if (serverInfo) {
      this.serverInfo = serverInfo
    }
    if (clientPort) {
      this.serverInfo.clientPort = clientPort
    }
  }
  getAllServers(): Promise<ServerMap> {
    return this.get<any>('rpc').rpcRegistry.getAllServers()
  }
  getServerInfo(): ApplicationServerInfo {
    return this.serverInfo
  }
  load(): void {
    if (this.isLoaded || this.isLoading) return
    this.isLoading = true
    this.loader.load()
    this.runComponentLifeCycle('onLoad')
    this.isLoading = false
    this.isLoaded = true
  }
  getFilePath(name: string): string {
    if (!this.useAppDirMode && name.startsWith('app/')) {
      return path.join(this.baseDir, name.replace('app/', ''))
    }
    return path.join(this.baseDir, name)
  }
  get loggers(): RegaxLoggerManager {
    if (!this[LOGGERS]) {
      this[LOGGERS] = createLoggerManager(this)
    }
    return this[LOGGERS]
  }
  get service(): Service {
    if (!this.isStarted) {
      throw new Error('[regax-application] Application.service cannot be used before app started.')
    }
    if (!this[SERVICES]) {
      this[SERVICES] = this.runComponentLifeCycle('onServiceRegistry')
    }
    return this[SERVICES]!
  }
  getConfig<T = any>(name: string): T {
    return (this.opts as any)[name]
  }
  setConfig<T>(compId: string | ApplicationOpts, opts?: T): void {
    if (this.isStarted) {
      throw new Error('[regax-application] Cannot setConfig when app started.')
    }
    if (typeof compId === 'string') {
      if (typeof opts === 'object') {
        const compConfig = (this.opts as any)[compId] || ((this.opts as any)[compId] = {})
        Object.assign(compConfig, opts)
      } else {
        this.opts[compId] = opts
      }
    } else {
      Object.keys(compId as ApplicationOpts).forEach(key => this.setConfig(key, (compId as any)[key]))
    }
  }
  get<T>(compId: string): T {
    return this.container.get(compId)
  }
  getServersByType(serverType: string): string[] {
    return this.get<any>('rpc').getServersByType(serverType)
  }
  set(compId: any, value: any): void {
    if (!this.isLoading) {
      throw new Error('[regax-application] "app.set" must be called when app is loading.')
    }
    this.container.bind(compId).toConstantValue(value)
  }
  start(): Promise<void> {
    if (!this.isLoaded) this.load()
    if (this.isStarted) return Promise.resolve()
    this.isStarted = true
    return this.runComponentLifeCycle('onStart', true)
      .then(() => this.emit(ApplicationEvent.STARTED))
      .catch((e: Error) => {
        this.coreLogger.error('[regax-application] regax application started with error: ', e)
        throw e
      })
  }
  stop(): Promise<void> {
    if (!this.isStarted) return Promise.resolve()
    return this.runComponentLifeCycle('onStop', true)
      .then(() => this.emit(ApplicationEvent.STOPPED))
      .catch((e: Error) => {
        this.coreLogger.error('[regax-application] regax application stopped with error: ', e)
        throw e
      })
  }
  addComponents(componentModules: { [componentName: string]: any }): void {
    if (this.isLoaded || this.isStarted) {
      throw new Error('[regax-application] Cannot add components when app started.')
    }
    if (!this.isLoading) {
      throw new Error('[regax-application] "app.addComponents" must be called when app is loading.')
    }
    const container = this.container
    each(componentModules, (component: any, componentName: string) => {
      component = component.default ? component.default : component
      let info = this.componentInfos.get(componentName)
      if (!info)   {
        info = { name: componentName, identifier: component }
        this.componentInfos.set(component, info)
        this.componentInfos.set(componentName, info)
        try {
          container.bind(component).toSelf().inSingletonScope() // bind component
          container.bind<Component>(Component).toService(component) // registry lifecycle
          container.bind(componentName).toService(component) // component alias
        } catch (e) {
          this.coreLogger.error('[regax-application] component "%s" binding error: ', componentName, e)
          throw e
        }
      } else {
        // container.rebind(info.identifier).to(component).inSingletonScope()
        this.coreLogger.error(`[regax-application] component "${componentName}" is added before`)
        throw new Error(`[regax-application] component "${componentName}" is added before`)
      }
    })
  }

  protected runComponentLifeCycle(key: keyof Component, asPromise: boolean = false): any {
    try {
      const components = this.components || (this.components = this.container.getAll(Component))
      const res: any = {}
      components.forEach((component: Component) => {
        const cons = component.constructor as any
        if (component[key]) {
          const componentName = this.componentInfos.get(cons).name
          const data = component[key]!(this.getConfig(componentName) || {})
          if (data) {
            res[componentName] =  data
          }
        }
      })
      return asPromise ? toPromise(res) : res
    } catch (e) {
      this.coreLogger.error('[regax-application] runing component life cycle "%s" with error: %s', key, e.stack)
      throw e
    }
  }
  onReady(fn: () => void): void {
    this.once(ApplicationEvent.READY, fn)
  }
  extendContext(data: any): void {
    Object.assign(this.appContext, data)
  }
}
