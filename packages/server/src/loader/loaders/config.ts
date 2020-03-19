// tslint:disable:no-any
import * as path from 'path'
import { tryToRequire } from '../../util/fs'
import { Application } from '../../api'
import { Loader, LoaderUnit, LoaderManager } from '../loader'

export default class ConfigLoader implements Loader {
  constructor(
    protected loader: LoaderManager,
    protected app: Application
  ) {
  }
  protected tryToLoadConfig(unit: LoaderUnit, configName: string): void {
    const configPath = path.join(unit.path, configName)
    let config = tryToRequire(configPath)
    if (typeof config === 'function') {
      config = config(this.app)
    }
    this.app.setConfig(config || {})
  }
  preload(): void {
    this.loader.timing.start('Load config')
    this.loader.getLoaderUnits().forEach((unit: LoaderUnit) => {
      this.tryToLoadConfig(unit, 'config/config.default')
    })
    this.loader.getLoaderUnits().forEach((unit: LoaderUnit) => {
      this.tryToLoadConfig(unit, 'config/config.' + this.app.env)
    })
    this.loader.timing.end('Load config')
  }
}
