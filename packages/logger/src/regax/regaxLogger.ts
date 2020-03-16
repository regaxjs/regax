// tslint:disable:no-any

const path = require('path')
const utils = require('egg-logger/lib/utils')
import { Logger, LoggerLevel, LoggerMetaData, FileTransport, FileBufferTransport, ConsoleTransport } from '../logger'

const wrapFormatterWithType = (formatter: any, logger: any) => (meta: LoggerMetaData) => formatter({ ...meta, message: logger.options.type ? `[${logger.options.type === '*' ? 'worker' : logger.options.type}] ${meta.message}` : meta.message })

export interface RegaxLoggerOpts {
  dir?: string, // log base dir
  type?: string,
  file?: string // log file, support relative path
  encoding?: string // log string encoding, default utf8
  level?: LoggerLevel // file log level, default INFO
  consoleLevel?: LoggerLevel // console log level, default NONE
  formatter?: (meta: LoggerMetaData) => string // log format function
  jsonFile?: string // json log file
  outputJSON?: boolean // send JSON log or not
  buffer?: boolean // use FileBufferTransport or not
  flushInterval?: number // interval fro flush to file, default 1000
  contextFormatter?: (meta: LoggerMetaData) => string // format function for context logger
  eol?: string // end of line char
}

export class RegaxLogger extends Logger<RegaxLoggerOpts> {
  constructor(options: RegaxLoggerOpts) {
    super(options)
    if (!path.isAbsolute(this.options.file)) this.options.file = path.join(this.options.dir, this.options.file)

    if (this.options.outputJSON === true && this.options.file) {
      this.options.jsonFile = this.options.file.replace(/\.log$/, '.json.log')
    }

    const RegaxFileTransport = this.options.buffer === true ? FileBufferTransport : FileTransport

    const fileTransport = new RegaxFileTransport({
      file: this.options.file!,
      level: this.options.level,
      encoding: this.options.encoding,
      formatter: this.options.formatter,
      contextFormatter: this.options.contextFormatter,
      // @ts-ignore
      flushInterval: this.options.flushInterval,
      eol: this.options.eol,
    })
    this.set('file', fileTransport)

    if (this.options.jsonFile) {
      const jsonFileTransport = new RegaxFileTransport({
        file: this.options.jsonFile!,
        level: this.options.level,
        encoding: this.options.encoding,
        // @ts-ignore
        flushInterval: this.options.flushInterval,
        json: true,
        eol: this.options.eol,
      })
      this.set('jsonFile', jsonFileTransport)
    }

    const consoleTransport = new ConsoleTransport({
      level: this.options.consoleLevel,
      formatter: wrapFormatterWithType(utils.consoleFormatter, this),
      contextFormatter: this.options.contextFormatter,
      eol: this.options.eol,
    })
    this.set('console', consoleTransport)
  }
  get level(): LoggerLevel {
    return this.options.level!
  }
  set level(level: LoggerLevel) {
    this.options.level = level
    for (const transport of this.values()) {
      if (transport instanceof ConsoleTransport) continue
      transport.level = level
    }
  }

  get consoleLevel(): LoggerLevel {
    return this.options.consoleLevel!
  }
  set consoleLevel(level: LoggerLevel) {
    this.options.consoleLevel = level
    for (const transport of this.values()) {
      if (transport instanceof ConsoleTransport) {
        transport.level = level
      }
    }
  }

  get defaults(): RegaxLoggerOpts {
    return {
      dir: '',
      file: '',
      encoding: 'utf8',
      level: 'INFO',
      consoleLevel: 'NONE',
      formatter: wrapFormatterWithType(utils.defaultFormatter, this),
      buffer: true,
      outputJSON: false,
      jsonFile: '',
    }
  }
}
