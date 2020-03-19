
const utils = require('egg-logger/lib/utils')
import { LoggerOpts, Logger, ConsoleTransport } from '../logger'

/**
 * Terminal Logger, send log to console.
 */
export class ConsoleLogger extends Logger {
  /**
   * @constructor
   * @param {Object} options
   * - {String} [encoding] - log string encoding, default is 'utf8'
   */
  constructor(options: LoggerOpts) {
    super(options)

    this.set('console', new ConsoleTransport({
      level: this.options.level,
      formatter: utils.consoleFormatter,
    }))
  }

  get defaults(): LoggerOpts {
    return {
      encoding: 'utf8',
      level: process.env.NODE_ENV === 'production' ? 'INFO' : 'WARN',
    }
  }
}
