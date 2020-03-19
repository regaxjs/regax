import { Application } from '../api'

export function gracefulExit(app: Application): void {
  let closed = false
  function onSignal(signal: string): void {
    if (closed) return
    closed = true
    // app.coreLogger.info('[regax-gracefulExit] %s receive signal %s, closing', app.serverId, signal)
    app.stop().then(() => {
      // app.coreLogger.info('[regax-gracefulExit] %s close done, exiting with code: 0', app.serverId)
      process.exit(0)
    }).catch((e: Error) => {
      app.coreLogger.error('[regax-gracefulExit] %s close with error: ', app.serverId, e)
      process.exit(1)
    })
  }
  function onExit(code: number): void {
    closed = true
    const level = code === 0 ? 'info' : 'error'
    app.coreLogger[level]('[regax-gracefulExit] %s process exit with code: %s', app.serverId, code)
  }
// https://nodejs.org/api/process.html#process_signal_events
// https://en.wikipedia.org/wiki/Unix_signal
// kill(2) Ctrl-C
  process.once('SIGINT', onSignal.bind(undefined, 'SIGINT'))
// kill(3) Ctrl-\
  process.once('SIGQUIT', onSignal.bind(undefined, 'SIGQUIT'))
// kill(15) default
  process.once('SIGTERM', onSignal.bind(undefined, 'SIGTERM'))
  process.once('exit', onExit)
}
