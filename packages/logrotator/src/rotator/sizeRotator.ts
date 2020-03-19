const path = require('path')
const debug = require('debug')('regax-logrotator:size_rotator')
import { Rotator, RotateFileMap } from './rotator'
const fs = require('mz/fs')

// rotate log by size, if the size of file over maxFileSize,
// it will rename from foo.log to foo.log.1
// if foo.log.1 exists, foo.log.1 will rename to foo.log.2
export class SizeRotator extends Rotator {

  async getRotateFiles(): Promise<RotateFileMap> {
    const files: RotateFileMap = new Map()
    const logDir = this.loggerOpts.dir
    const filesRotateBySize = this.filesRotateBySize
    const maxFileSize = this.opts.maxFileSize!
    const maxFiles = this.opts.maxFiles!
    for (let logPath of filesRotateBySize) {
      // support relative path
      if (!path.isAbsolute(logPath)) logPath = path.join(logDir, logPath)

      const exists = await fs.exists(logPath)
      if (!exists) {
        continue
      }
      try {
        const stat = await fs.stat(logPath)
        if (stat.size >= maxFileSize) {
          this.logger.info(`[regax-logrotator] file ${logPath} reach the maximum file size, current size: ${stat.size}, max size: ${maxFileSize}`)
          // delete max log file if exists, otherwise will throw when rename
          const maxFileName = `${logPath}.${maxFiles}`
          const maxExists = await fs.exists(maxFileName)
          if (maxExists) {
            await fs.unlink(maxFileName)
          }
          this.setFile(logPath, files)
        }
      } catch (err) {
        err.message = '[regax-logrotator] ' + err.message
        this.logger.error(err)
      }
    }
    return files
  }

  setFile(logPath: string, files: RotateFileMap): void {
    const maxFiles = this.opts.maxFiles!
    if (files.has(logPath)) {
      return
    }
    // foo.log.2 -> foo.log.3
    // foo.log.1 -> foo.log.2
    for (let i = maxFiles - 1; i >= 1; i--) {
      const srcPath = `${logPath}.${i}`
      const targetPath = `${logPath}.${i + 1}`
      debug('set file %s => %s', srcPath, targetPath)
      files.set(srcPath, { srcPath, targetPath })
    }
    // foo.log -> foo.log.1
    debug('set file %s => %s', logPath, `${logPath}.1`)
    files.set(logPath, { srcPath: logPath, targetPath: `${logPath}.1` })
  }

}
