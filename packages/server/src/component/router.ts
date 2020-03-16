// tslint:disable:no-any
import { ObjectOf, PlainObject, PromiseDelegate, reduce, RegaxError, ErrorCode } from '@regax/common'
import { inject, Component, injectable } from '../api/component'
import { Application, Filter, FilterContext, Session, Controller, ControllerBuiltInKey, ApplicationOpts } from '../api'
import { Router, RouteType, RouteData, ServerRoute, RPC } from '../api'
import { FrontendSession } from '../service/sessionService'
import { Routes } from '@regax/rpc'
import * as path from 'path'
import { readFiles } from '../util/readFiles'
import { parseRoute } from '../util/routeUtil'
import { compose, ComposeDispatcher } from '../util/compose'
import * as fs from 'fs'
import RPCComp from './rpc'

interface RouteMap {
  [route: string]: string
}

export interface RouterOpts {
}

@injectable()
export default class RouterComponent implements Component {
  protected routeMap: RouteMap = {}
  protected serverRoutes: { [serverType: string]: ServerRoute } = {}
  protected rpcRouter: Router
  protected filters: Filter[] = []
  protected filterDispach?: ComposeDispatcher<FilterContext>
  protected filterOpts: ObjectOf<PlainObject> = {}
  localRouter: LocalRouter
  constructor(
    @inject(Application) protected readonly app: Application,
  ) {
  }
  onLoad(): void {
    this.loadRouteMap()
    this.loadServerRoutes()
    this.localRouter = new LocalRouter(this.app, this.routeMap)
    this.rpcRouter = this.createRPCRouter()
    const filters = this.app.getConfig<ApplicationOpts['filters']>('filters')
    const filterConfigs = this.app.getConfig<ApplicationOpts['filterConfigs']>('filterConfigs')
    if (filterConfigs) {
      this.filterOpts = { ...this.filterOpts, ...filterConfigs }
    }
    if (filters) {
      const filterList = reduce<Filter[]>(filters,
      (res, createFilter, filterName: string) => res.concat(createFilter(this.app, this.filterOpts[filterName] || {})), [])
      this.filters = filterList.concat(this.filters)
    }
    if (this.filters.length > 0) {
      this.filterDispach = compose<FilterContext>(this.filters)
    }
  }
  protected loadRouteMap(): void {
    readFiles(this.app.getFilePath('app/filter'), (filterPath: string, filterName) => {
      this.loadCustomFilter(filterPath, filterName)
    })
    readFiles(this.app.getFilePath('app/server'), (serverPath: string, serverType) => {
      readFiles(path.join(serverPath, RouteType.CONTROLLER), (routePath, routeName) => this.loadRouteDetail(RouteType.CONTROLLER, routePath, routeName, serverType))
      readFiles(path.join(serverPath, RouteType.RPC), (routePath, routeName) => this.loadRouteDetail(RouteType.RPC, routePath, routeName, serverType))
      readFiles(path.join(serverPath, 'filter'), (filterPath, filterName) => this.loadCustomFilter(filterPath, filterName, serverType))
    }, n => path.extname(n) === '')
  }
  protected loadServerRoutes(): void {
    const filePath = this.app.getFilePath('config/router')
    if (fs.existsSync(`${filePath}.js`) || fs.existsSync(`${filePath}.ts`)) {
      try {
        this.serverRoutes = require(filePath).default || require(filePath)
      } catch (e) {
        this.app.coreLogger.error(e)
        throw new Error(`Route config "${filePath}" loading error.`)
      }
    }
  }
  protected loadCustomFilter(filterPath: string, filterName: string, serverType?: string): void {
    try {
      let createFilter = require(filterPath)
      if (createFilter.default) createFilter = createFilter.default
      if (typeof createFilter !== 'function') throw new Error(`Route filter "${filterName}" must be a function!`)
      const filter: Filter = createFilter(this.app, this.filterOpts[filterName] || {})
      // global filter
      if (!serverType) {
        this.filters.push(filter)
        return
      }
      this.filters.push((ctx, next) => {
        if (ctx.serverType !== serverType) return next()
        return filter(ctx, next)
      })
    } catch (e) {
      this.app.coreLogger.error(e)
      throw new Error(`Route filter "${filterName}" loading error.`)
    }
  }
  protected loadRouteDetail(routeType: RouteType, routePath: string, routeName: string, serverType: string): void {
    try {
      this.routeMap[`${routeType}.${serverType}.${routeName}`] = routePath
    } catch (e) {
      this.app.coreLogger.error(e)
      throw new Error(`Route ${routeType}.${serverType}.${routeName} loading error.`)
    }
  }
  invoke(route: string, routeType: RouteType, session: Session, args: any[], traceId?: string): Promise<any> {
    const routeData = this.getRouteData(route, routeType)
    const ctx: FilterContext = Object.assign(routeData, { args, session, traceId })
    if (!this.filterDispach) return (this.rpcRouter as any)[routeType](routeData, session, args)
    return this.filterDispach(ctx, async () => {
      try {
        const res = await (this.rpcRouter as any)[routeType](routeData, session, args, traceId)
        ctx.res = res
        return res
      } catch (e) {
        ctx.error = e
        throw e
      }
    }).then(() => ctx.res)
  }
  getRouteData(route: string, routeType: RouteType, ignoreCheck?: boolean): RouteData {
    const routeData = parseRoute(route)
    if (ignoreCheck) return { ...routeData!, routeType }
    if (!routeData || !this.routeMap[`${routeType}.${routeData.serverType}.${routeData.name}`]) {
      throw new Error(`route "${route}" not found`)
    }
    if (routeData.serverType === RouteType.CONTROLLER && ControllerBuiltInKey.includes(routeData.method)) {
      throw new Error(`route "${route}" not found`)
    }
    return { ...routeData, routeType }
  }
  protected createRPCRouter(): Router {
    const serverRoutes = this.serverRoutes
    const self = this
    return {
      controller(route: RouteData, session: Session, args: any[], traceId: string): Promise<any> {
        const rpc: RPCComp = self.app.get<RPCComp>('rpc')
        if (route.isFrontend) {
          return self.localRouter.controller(route, session, args, traceId)
        }
        const routeMatch = serverRoutes[route.serverType] || defaultServerRoute
        const servers = rpc.getServersByType(route.serverType)
        let serverId: string
        try {
          serverId = routeMatch(servers, session, args[0], route, self.app)
        } catch (e) {
          throw RegaxError.create(e, ErrorCode.CONTROLLER_FAIL)
        }
        return rpc.invokeProxy(serverId).routeRemote(
          route.route,
          route.routeType,
          session.toJSON(),
          args,
          traceId,
          )
      },
      rpc(route: RouteData, session: Session, args: any[], traceId: string): Promise<any> {
        const rpc: RPCComp = self.app.get<RPCComp>('rpc')
        const routeMatch = serverRoutes[route.serverType] || defaultServerRoute
        const servers = rpc.getServersByType(route.serverType)
        let serverId: string
        try {
          serverId = routeMatch(servers, session, args[0], route, self.app)
        } catch (e) {
          throw RegaxError.create(e, ErrorCode.RPC_FAIL)
        }
        return rpc.invokeProxy(serverId).routeRemote(
          route.route,
          route.routeType,
          session.toJSON(),
          args,
          traceId,
        )
      },
    }
  }
}

export class LocalRouter implements Router {
  constructor(
    readonly app: Application,
    readonly routeMap: RouteMap
  ) {
  }
  getRoute(route: RouteData): any {
    return this.routeMap[`${route.routeType}.${route.serverType}.${route.name}`]
  }
  async controller(route: RouteData, session: Session, args: any[], traceId: string): Promise<any> {
    let Module: typeof Controller
    try {
      Module = require(this.getRoute(route))
      if (Module && (Module as any).default) Module = (Module as any).default
    } catch (e) {
      this.app.coreLogger.error(e)
      throw new Error(`Route "${route.serverType}.${route.name}" loading error`)
    }
    const promise = new PromiseDelegate<any>()
    const controller = new Module(this.app, session, promise, session instanceof FrontendSession, traceId)
    const propertyNames = Object.getOwnPropertyNames(Module.prototype)
    if (!propertyNames.includes(route.method) || typeof (controller as any)[route.method] !== 'function') {
      throw new Error(`Route "${route.route}" not found`)
    }
    const result = await (controller as any)[route.method](...args)
    if (!controller.isFinish()) controller.success(result)
    return promise.promise
  }
  async rpc(route: RouteData, session: Session, args: any[], traceId: string): Promise<any> {
    let Module: typeof RPC
    try {
      Module = require(this.getRoute(route))
      if (Module && (Module as any).default) Module = (Module as any).default
    } catch (e) {
      this.app.coreLogger.error(e)
      throw new Error(`Route "${route.serverType}.${route.name}" loading error`)
    }
    const rpcModule = new Module(this.app, session, session instanceof FrontendSession, traceId)
    const propertyNames = Object.getOwnPropertyNames(Module.prototype)
    if (!propertyNames.includes(route.method) || typeof (rpcModule as any)[route.method] !== 'function') {
      throw new Error(`Route "${route.route}" not found`)
    }
    return (rpcModule as any)[route.method](...args)
  }
}

function defaultServerRoute(servers: string[], session: Session, msg: any, routeData: RouteData, app: Application): string {
  if (servers.length === 1) {
    return servers[0]
  }
  // default use Round-Robin algorithm
  return Routes.rr(servers, routeData, '', app)
}
