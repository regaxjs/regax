import * as path from 'path'
import * as fs from 'fs'
import { each } from '@regax/common'
import { Loader, LoaderManager } from '../loader'
import { Application, PluginOpts } from '../../api'
import { tryToRequire } from '../../util/fs'

// TODO plugin recursive dependencies check
export default class PluginLoader implements Loader {
  protected pluginList: PluginOpts[] = []
  public pluginMap: Map<string, PluginOpts>
  constructor(
    protected loader: LoaderManager,
    protected app: Application
  ) {
    this.pluginMap = this.loader.pluginMap
  }
  preload(): void {
    this.loader.timing.start('plugin preload')
    this.readPluginConfig(this.app.frameworkPath) // 1. load framework plugins
    this.addPluginLoaderUnits() // 2. register the framework plugins to loader units
    this.loader.addLoaderUnit(this.app.frameworkPath, 'framework', false, 'framework') // 3. add the framework path to loader units
    each(this.loader.opts.plugins || {}, (opts, name) => this.addPlugin(name, opts)) // 4. load app plugins from opts
    this.readPluginConfig(this.app.baseDir) // 5. load app plugins from basedir
    this.addPluginLoaderUnits() // 6. register the app plugins to loader units
    this.loader.addLoaderUnit(this.app.baseDir, 'app', this.app.useAppDirMode, 'app') // 7. register the app path to loader units
    this.loader.timing.end('plugin preload')
  }
  protected addPluginLoaderUnits(): void {
    this.pluginList.forEach(p => {
      if (p.enable) {
        let useAppDirMode = false
        try {
          if (fs.statSync(path.join(p.path!, 'app')).isDirectory()) useAppDirMode = true
        } catch (e) { /* ignore */ }
        this.loader.addLoaderUnit(p.path!, 'plugin', useAppDirMode, p.name!)
      }
    })
    this.pluginList.length = 0
  }
  protected addPlugin(name: string, pluginOpts: PluginOpts): void {
    const env = this.app.env
    let enable = pluginOpts.enable
    // plugin is disabled
    if (pluginOpts.env && enable && !pluginOpts.env.includes(env)) {
      enable = false
    }
    if (!enable && this.pluginMap.has(name)) {
      this.pluginMap.get(name)!.enable = false
      return
    }
    if (this.pluginMap.has(name)) {
      throw new Error(`Plugin "${name}" has added before: `)
    }
    if (!pluginOpts.package && !pluginOpts.path) {
      throw new Error(`Plugin "${name}" required "package" or "path" opts.`)
    }
    const pkgPath = require.resolve(path.join(pluginOpts.path || pluginOpts.package!, 'package.json'))
    // TODO check the dependencies
    // Read the package.json of plugin
    const pkg = require(pkgPath)
    const pluginPath = path.join(pkgPath, '../', pkg.regaxPlugin && pkg.regaxPlugin.dir ? pkg.regaxPlugin.dir : 'lib')
    this.pluginMap.set(name, {  ...pluginOpts, name, path: pluginPath })
    this.readPluginConfig(pluginPath)
    this.pluginList.push(this.pluginMap.get(name)!)
  }
  protected readPluginConfig(pluginDir: string): void {
    const config = tryToRequire(path.join(pluginDir, 'config/plugin'))
    if (config) {
      for (const name in config) {
        if (config.hasOwnProperty(name)) {
          const pluginOpts: PluginOpts = config[name]
          if (typeof pluginOpts === 'boolean') {
            if (this.pluginMap.has(name)) {
              this.pluginMap.get(name)!.enable = pluginOpts as boolean
            }
          } else {
            this.addPlugin(name, pluginOpts)
          }
        }
      }
    }
  }
}
