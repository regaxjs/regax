export * from './regax/regaxLogger'
export * from './regax/regaxLoggerManager'
export * from './logger'
export * from './regax/consoleLogger'
export * from './regax/errorLogger'
export * from './regax/customLogger'

import { ConsoleLogger } from './regax/consoleLogger'
export const defaultLogger = new ConsoleLogger({ level: 'INFO' })
