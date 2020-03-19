import { Application } from '../../api'
import * as path from 'path'
import { tryToRequire } from '../../util/fs'
import { Loader, LoaderUnit, LoaderManager } from '../loader'

export default class ContextLoader implements Loader {
  constructor(
    protected loader: LoaderManager,
    protected app: Application
  ) {
  }
  preload(): void {
    this.loader.getLoaderUnits().forEach((unit: LoaderUnit) => {
      let ctx = tryToRequire(path.join(unit.path, unit.useAppDirMode ? 'app/extend/context' : 'extend/context'))
      if (typeof ctx === 'function') {
        ctx = ctx(this.app)
      }
      this.app.extendContext(ctx)
    })
  }
}
