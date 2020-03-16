// tslint:disable:no-any
import * as uuid from 'node-uuid'
import { Logger } from '@regax/logger'

export class Tracer {
  constructor(
    protected readonly logger: Logger,
    readonly source: any,
    readonly remote: any,
    readonly msg: any,
    readonly id: string = uuid.v1(),
    public seq: number = 1
  ) {
  }
  getLogger(role: string, method: string, desc: string): any {
    return {
      traceId: this.id,
      seq: this.seq++,
      role: role,
      source: this.source,
      remote: this.remote,
      method,
      msg: this.msg,
      timestamp: Date.now(),
      description: desc
    }
  }
  info(role: string, method: string, desc: string): void {
    this.logger.info(JSON.stringify(this.getLogger(role, method, desc)))
  }
  debug(role: string, method: string, desc: string): void {
    this.logger.debug(JSON.stringify(this.getLogger(role, method, desc)))
  }
  error(role: string, method: string, desc: string): void {
    this.logger.error(JSON.stringify(this.getLogger(role, method, desc)))
  }
}
