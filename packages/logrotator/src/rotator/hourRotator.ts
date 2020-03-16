const path = require('path')
const moment = require('moment')
const debug = require('debug')('regax-logrotator:hour_rotator')
import { Rotator, RotateFileMap } from './rotator'
const fs = require('mz/fs')

// rotate log by hour
// rename from foo.log to foo.log.YYYY-MM-DD-HH
export class HourRotator extends Rotator {
  async getRotateFiles(): Promise<RotateFileMap> {
    const files: RotateFileMap = new Map()
    const logDir = this.loggerOpts.dir
    const filesRotateByHour = this.filesRotateByHour

    for (let logPath of filesRotateByHour) {
      // support relative path
      if (!path.isAbsolute(logPath)) logPath = path.join(logDir, logPath)
      const exists = await fs.exists(logPath)
      if (!exists) {
        continue
      }
      this.setFile(logPath, files)
    }

    return files
  }

  get hourDelimiter(): string {
    return this.opts.hourDelimiter!
  }

  protected setFile(srcPath: string, files: RotateFileMap): void {
    if (!files.has(srcPath)) {
      const targetPath = srcPath + moment().subtract(1, 'hours').format(`.YYYY-MM-DD${this.hourDelimiter}HH`)
      debug('set file %s => %s', srcPath, targetPath)
      files.set(srcPath, { srcPath, targetPath })
    }
  }
}
