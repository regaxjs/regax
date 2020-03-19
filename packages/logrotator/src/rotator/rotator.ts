// fork from https://github.com/eggjs/egg-logrotator#readme

import { Application, ApplicationOpts } from '@regax/server'
import { Logger } from '@regax/logger'
import { LogrotatorOpts } from '../component/logrotator'
const fs = require('mz/fs')

export type RotateFileMap = Map<string, { srcPath: string, targetPath: string }>

export abstract class Rotator {
  protected logger: Logger
  protected opts: LogrotatorOpts
  protected loggerOpts: ApplicationOpts['logger'] & {}
  protected filesRotateBySize: string[]
  protected filesRotateByHour: string[]
  constructor(
    protected readonly app: Application
  ) {
    this.logger = app.coreLogger
    this.opts = app.getConfig('logrotator')
    this.loggerOpts = this.app.getConfig('logger')
    this.filesRotateBySize = this.opts.filesRotateBySize || []
    this.filesRotateByHour = this.opts.filesRotateByHour || []
  }
  abstract getRotateFiles(): Promise<RotateFileMap>
  async rotate(): Promise<void> {
    const files = await this.getRotateFiles()
    const rotatedFile = []
    for (const file of files.values()) {
      try {
        await renameOrDelete(file.srcPath, file.targetPath)
        rotatedFile.push(`${file.srcPath} -> ${file.targetPath}`)
      } catch (err) {
        err.message = `[regax-logrotator] rename ${file.srcPath}, found exception: ` + err.message
        this.logger.error(err)
      }
    }

    if (rotatedFile.length) {
      // tell every one to reload logger
      this.logger.info('[regax-logrotator] broadcast log-reload')
      // TODO
      // this.app.messenger.sendToApp('log-reload')
      // this.app.messenger.sendToAgent('log-reload')
    }

    this.logger.info('[regax-logrotator] rotate files success by %s, files %j',
      this.constructor.name, rotatedFile)
  }
}

// rename from srcPath to targetPath, for example foo.log.1 > foo.log.2
async function renameOrDelete(srcPath: string, targetPath: string): Promise<void> {
  if (srcPath === targetPath) {
    return
  }
  const srcExists = await fs.exists(srcPath)
  if (!srcExists) {
    return
  }
  const targetExists = await fs.exists(targetPath)
  // if target file exists, then throw
  // because the target file always be renamed first.
  if (targetExists) {
    throw new Error(`targetFile ${targetPath} exists!!!`)
  }
  await fs.rename(srcPath, targetPath)
}
