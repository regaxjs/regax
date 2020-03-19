// tslint:disable:no-any
import { LoggerLevel } from 'egg-logger'
import { Logger as EggLogger } from 'egg-logger'

export * from 'egg-logger'

export interface LoggerMetaData {
  date: number,
  level: LoggerLevel,
  pid: number,
  message: string,
}

export interface LoggerOpts {
  level?: LoggerLevel
  encoding?: string
  consoleLevel?: LoggerLevel
  allowDebugAtProd?: boolean
}

export class Logger<T extends LoggerOpts = LoggerOpts> extends EggLogger<T> {
  protected options: T
}
