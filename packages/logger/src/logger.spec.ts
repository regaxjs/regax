import { Logger, ConsoleLogger, RegaxLogger } from './index'
import * as path from 'path'
describe('logger', () => {
  it('create', () => {
    const a = new Logger({})
    a.info('info output')
  })
  it ('consoleLogger', () => {
    const a = new ConsoleLogger({
      level: 'INFO'
    })
    a.info('info output')
    a.warn('warn output')
    a.error('erro putput ')
  })
  it ('regaxLogger', () => {
    const a = new RegaxLogger({
      file: path.join(__dirname, 'test.log'),
      level: 'INFO'
    })
    a.info('info output')
    a.warn('warn output')
    a.error('erro putput ')
    a.close()
  })
})
