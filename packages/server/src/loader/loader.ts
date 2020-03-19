// tslint:disable:no-any
import { Timing } from './timing'
import { Application, PluginOpts } from '../api'

export interface Loader {
  preload?(): void
  load?(): void
}

export type LoadUnitType = 'plugin' | 'framework' | 'app'
export interface LoaderUnit {
  path: string,
  type: LoadUnitType
  name: string,
  useAppDirMode: boolean,
}

const loaderClasses = [
  require('./loaders/plugin').default,
  require('./loaders/config').default,
  require('./loaders/component').default,
]

export interface LoaderOpts {
  plugins?: {
    [pluginName: string]: PluginOpts
  }
  [others: string]: any
}

export class LoaderManager {
  timing = new Timing()
  protected loaderUnits: LoaderUnit[] = []
  protected loaderUnitsCache: LoaderUnit[]
  public pluginMap: Map<string, PluginOpts> = new Map()
  protected loaders: Loader[] = []
  readonly opts: LoaderOpts
  constructor(
    protected app: Application,
  ) {
    loaderClasses.forEach(LoaderCls => this.loaders.push(new LoaderCls(this, app)))
    this.opts = this.app.getConfig('loader') || {}
  }
  preload(): void {
    this.loaders.forEach(loader => {
      if (loader.preload) loader.preload()
    })
  }
  load(): void {
    this.loaders.forEach(loader => {
      try {
        if (loader.load) loader.load()
      } catch (e) {
        this.app.coreLogger.error('[regax-loader] exec loader %s with error: %s', loader.constructor.name, e.message)
        throw e
      }
    })
    // this.app.coreLogger.info('[regax-loader] [%s] exec loader : %j', this.app.serverType, this.timing.toJSON())
  }
  addLoaderUnit(path: string, type: LoadUnitType, useAppDirMode = true, name: string): void {
    this.loaderUnits.push({ path, type, useAppDirMode, name })
  }
  getLoaderUnits(): LoaderUnit[] {
    if (this.loaderUnitsCache) return this.loaderUnitsCache
    this.loaderUnitsCache = this.loaderUnits.filter(unit => {
      if (unit.type === 'plugin' && this.pluginMap.get(unit.name) && !this.pluginMap.get(unit.name)!.enable) return false
      return true
    })
    this.loaderUnits.length = 0
    return this.loaderUnitsCache
  }
}
