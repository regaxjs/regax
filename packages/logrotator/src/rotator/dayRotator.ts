const path = require('path')
const moment = require('moment')
const debug = require('debug')('regax-logrotator:day_rotator')
import { Rotator, RotateFileMap } from './rotator'
import { walkLoggerFile } from '../util'

// rotate log by day
// rename from foo.log to foo.log.YYYY-MM-DD
export class DayRotator extends Rotator {
  async getRotateFiles(): Promise<RotateFileMap> {
    const files: RotateFileMap = new Map()
    const logDir = this.loggerOpts.dir
    const loggerFiles = walkLoggerFile(this.app.loggers)
    loggerFiles.forEach(file => {
      // support relative path
      if (!path.isAbsolute(file)) file = path.join(logDir, file)
      this.setFile(file, files)
    })

    // Should rotate agent log, because schedule is running under app worker,
    // agent log is the only differece between app worker and agent worker.
    // - app worker -> egg-web.log
    // - agent worker -> egg-agent.log
    // TODO
    const agentLogName = this.loggerOpts.agentLogName
    this.setFile(path.join(logDir, agentLogName), files)

    return files
  }

  protected setFile(srcPath: string, files: RotateFileMap): void {
    // don't rotate logPath in filesRotateBySize
    if (this.filesRotateBySize.indexOf(srcPath) > -1) {
      return
    }

    // don't rotate logPath in filesRotateByHour
    if (this.filesRotateByHour.indexOf(srcPath) > -1) {
      return
    }

    if (!files.has(srcPath)) {
      // allow 2 minutes deviation
      const targetPath = srcPath + moment()
        .subtract(23, 'hours')
        .subtract(58, 'minutes')
        .format('.YYYY-MM-DD')
      debug('set file %s => %s', srcPath, targetPath)
      files.set(srcPath, { srcPath, targetPath })
    }
  }
}
