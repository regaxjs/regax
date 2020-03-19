// tslint:disable:no-any
import { RegaxLoggerManager } from '@regax/logger'

export function walkLoggerFile(loggers: RegaxLoggerManager): string[] {
  const files = []
  for (const key in loggers) {
    if (!loggers.hasOwnProperty(key)) {
      continue
    }
    const registeredLogger = (loggers as any)[key]
    for (const transport of registeredLogger.values()) {
      const file = transport.options.file
      if (file) {
        files.push(file)
      }
    }
  }
  return files
}
