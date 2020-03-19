// tslint:disable:no-any

const assert = require('assert')
const utils = require('egg-logger/lib/utils')
import { ErrorLogger } from './errorLogger'
import { RegaxLogger, RegaxLoggerOpts } from './regaxLogger'
import { CustomLogger } from './customLogger'
import { LoggerLevel, Logger } from '../logger'

const defaults = {
  env: 'default',
  type: '',
  dir: '',
  encoding: 'utf8',
  level: 'INFO',
  consoleLevel: 'NONE',
  outputJSON: false,
  buffer: true,
  appLogName: '',
  coreLogName: '',
  agentLogName: '',
  errorLogName: '',
  concentrateError: 'duplicate',
}

export interface RegaxLoggerManagerOpts extends RegaxLoggerOpts {
  env?: string, // app runtime env string, detail please see `app.config.env`
  type?: string, // current process server type, `agent` or `master` or other server type
  dir?: string, // log file dir
  level?: LoggerLevel // file log level, default INFO
  encoding?: string // log string encoding, default utf8
  consoleLevel?: LoggerLevel // console log level, default NONE
  outputJSON?: boolean // send JSON log or not, default false
  buffer?: boolean // use FileBufferTransport or not, default true
  appLogName?: string, // app file logger name
  coreLogName?: string, // core file logger name
  agentLogName?: string, // agent file logger name
  errorLogName?: string, // common error logger name
  eol?: string // end of line chair
  customLogger?: {
    [loggeName: string]: RegaxLoggerOpts,
  },
  coreLogger?: RegaxLoggerOpts, // core logger config
  concentrateError?: 'duplicate' | 'redirect' | 'ignore' // whether write error logger to common-error.log, `duplicate` / `redirect` / `ignore`, default duplicate
}
/**
 * Logger Manager, accord config to create multi loggers.
 */

export class RegaxLoggerManager extends Map<string, Logger> {
  errorLogger: ErrorLogger
  coreLogger: RegaxLogger
  logger: RegaxLogger
  protected opts: RegaxLoggerManagerOpts
  constructor(opts: RegaxLoggerManagerOpts) {
    super()

    const loggerConfig = this.opts = utils.assign({}, defaults, opts)
    const customLoggerConfig = opts.customLogger

    assert(loggerConfig.type, 'should pass config.logger.type')
    assert(loggerConfig.dir, 'should pass config.logger.dir')
    assert(loggerConfig.appLogName, 'should pass config.logger.appLogName')
    assert(loggerConfig.coreLogName, 'should pass config.logger.coreLogName')
    assert(loggerConfig.agentLogName, 'should pass config.logger.agentLogName')
    assert(loggerConfig.errorLogName, 'should pass config.logger.errorLogName')

    const errorLogger = new ErrorLogger(utils.assign({}, loggerConfig, {
      file: loggerConfig.errorLogName,
    }))
    this.set('errorLogger', errorLogger)

    if (loggerConfig.type === 'agent') {
      const logger = new RegaxLogger(utils.assign({}, loggerConfig, {
        file: loggerConfig.agentLogName,
      }))
      this.set('logger', logger)

      const coreLogger = new RegaxLogger(utils.assign({}, loggerConfig, loggerConfig.coreLogger, {
        file: loggerConfig.agentLogName,
      }))
      this.set('coreLogger', coreLogger)
    } else {
      const logger = new RegaxLogger(utils.assign({}, loggerConfig, {
        file: loggerConfig.appLogName,
      }))
      this.set('logger', logger)

      const coreLogger = new RegaxLogger(utils.assign({}, loggerConfig, loggerConfig.coreLogger, {
        file: loggerConfig.coreLogName,
      }))
      this.set('coreLogger', coreLogger)
    }

    for (const name in customLoggerConfig) {
      const logger = new CustomLogger(utils.assign({}, loggerConfig, customLoggerConfig[name]))
      this.set(name, logger)
    }
  }

  /**
   * Disable console logger
   */
  disableConsole(): void {
    for (const logger of this.values()) {
      logger.disable('console')
    }
  }

  reload(): void {
    for (const logger of this.values()) {
      logger.reload()
    }
  }

  /**
   * Add a logger
   * @param {String} name - logger name
   * @param {Logger} logger - Logger instance
   */
  set(name: string, logger: Logger): this {
    if (this.has(name)) {
      return this
    }

    // redirect ERROR log to errorLogger, except errorLogger itself
    if (name !== 'errorLogger') {
      switch (this.opts.concentrateError) {
        case 'duplicate':
          logger.duplicate('ERROR', this.errorLogger, { excludes: [ 'console' ] })
          break
        case 'redirect':
          logger.redirect('ERROR', this.errorLogger)
          break
        case 'ignore':
          break
        default:
          break
      }
    }
    (this as any)[name] = logger
    return super.set(name, logger)
  }
}
