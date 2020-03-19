// tslint:disable:no-any
const utils = require('egg-logger/lib/utils')
import { LoggerLevel, levels } from '../logger'
import { RegaxLogger, RegaxLoggerOpts } from './regaxLogger'

/**
 * Error Logger, only print `ERROR` level log.
 * level and consoleLevel should >= `ERROR` level.
 */
export class ErrorLogger extends RegaxLogger {
  constructor(options: RegaxLoggerOpts) {
    options = options || {}
    options.level = getDefaultLevel(options.level) as any
    options.consoleLevel = getDefaultLevel(options.consoleLevel) as any
    super(options)
  }
}

function getDefaultLevel(l?: LoggerLevel): number {
  const level = utils.normalizeLevel(l) as number

  if (level === undefined) {
    return levels.ERROR
  }

  return level > levels.ERROR ? level : levels.ERROR
}
