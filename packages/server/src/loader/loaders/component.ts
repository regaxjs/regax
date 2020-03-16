// tslint:disable:no-any
import { Loader, LoaderManager, LoaderUnit } from '../loader'
import * as path from 'path'
import { each } from '@regax/common'
import { Application, ComponentOpts } from '../../api'
import { tryToRequire } from '../../util/fs'
const debug = require('debug')('regax-core:loader:component')

export default class ComponentLoader implements Loader {
  protected componentConfigs: ComponentOpts<{ name: string, path: string }> = {}
  constructor(
    protected loader: LoaderManager,
    protected app: Application
  ) {
  }
  protected tryToLoadConfig(unit: LoaderUnit, configName: string): boolean {
    const configPath = path.join(unit.path, configName)
    let config = tryToRequire(configPath)
    if (typeof config === 'function') {
      config = config(this.app)
    }
    // normalize the component config
    if (config && config.component) {
      each(config.component, (compNames, serverType) => {
        const compConfigs = this.componentConfigs[serverType] || (this.componentConfigs[serverType] = [])
        compNames.forEach((name: string) => {
          compConfigs.push({
            name,
            path: path.join(unit.path, unit.useAppDirMode ? 'app/component' : 'component', name),
          })
        })
      })
      return true
    }
    return false
  }
  loadComponents(): void {
    const compConfig = this.componentConfigs
    let compKeys: { name: string, path: string}[] = compConfig.all || []
    if (compConfig.frontend && this.app.isFrontendServer) {
      compKeys = compKeys.concat(compConfig.frontend)
    }
    if (compConfig.backend && this.app.isBackendServer) {
      compKeys = compKeys.concat(compConfig.backend)
    }
    if (compConfig[this.app.serverType]) {
      compKeys = compKeys.concat(compConfig[this.app.serverType]!)
    }
    const compsMap = compKeys.reduce((res: { [compName: string]: any }, comp: { name: string, path: string }) => {
      if (!res[comp.name]) {
        res[comp.name] = require(comp.path)
      }
      return res
    }, {})
    this.app.addComponents(compsMap)
    debug('components(%s) %s loaded.', compKeys.length, compKeys.map(c => c.name))
  }
  load(): void {
    this.loader.timing.start('Load component')
    this.loader.getLoaderUnits().forEach((unit: LoaderUnit) => {
      const loaded = this.tryToLoadConfig(unit, 'config/config.' + this.app.env)
      if (!loaded) this.tryToLoadConfig(unit, 'config/config.default')
    })
    this.loadComponents()
    this.loader.timing.end('Load component')
  }
}
