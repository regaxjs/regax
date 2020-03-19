// tslint:disable:no-any
import { ApplicationOpts, ApplicationEnv } from '../api/application'
import { Application } from '../application'
import { RegaxLoggerManager } from '@regax/logger'

export function createLoggerManager(app: Application): RegaxLoggerManager {
  const loggerConfig = app.getConfig<ApplicationOpts['logger']>('logger') || {}
  const customLogger = app.getConfig<ApplicationOpts['customLogger']>('customLogger') || {}
  loggerConfig.type = app.serverType

  if (app.env === ApplicationEnv.prod && loggerConfig.level === 'DEBUG' && !loggerConfig.allowDebugAtProd) {
    loggerConfig.level = 'INFO'
  }

  const loggers = new RegaxLoggerManager(Object.assign({}, loggerConfig, { customLogger }))

  // won't print to console after started, except for local and unittest
  app.onReady(() => {
    if (loggerConfig.disableConsoleAfterReady) {
      loggers.disableConsole()
    }
  })
  // loggers.coreLogger.info('[regax-logger] init all loggers with options: %j', loggerConfig)

  return loggers
}
