import { Component, inject, injectable, Application } from '@regax/server'

export interface LogrotatorOpts {
  filesRotateByHour?: string[], // for rotate_by_hour
  filesRotateBySize?: string[], // for rotate_by_size
  hourDelimiter?: string, // default '-'
  maxFileSize?: number,
  maxFiles?: number,
  rotateDuration?: number,
  maxDays?: number, // for clean_log
}

@injectable()
export default class LogrotatorComponent implements Component {
  protected opts: LogrotatorOpts
  constructor(
    @inject(Application) protected readonly app: Application,
  ) {
    this.opts = this.app.getConfig('logrotator')
  }
  onStart(): void {
    // console.log('>>>>>>>>>logrotator: ', this.app.serverType)
  }
}
