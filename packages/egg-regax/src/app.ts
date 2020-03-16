// tslint:disable:no-any

import { RegaxIPC } from './common/ipc'

export function createApp(app: any): void {
  app.messenger.once('egg-ready', async () => {
    const ipc = new RegaxIPC(app.messenger, 'worker', {
      eggContext({ args, key }: { args: any[], key: string }): any {
        const eggCtx = app.createAnonymousContext()
        let res
        let lastCtx = eggCtx
        try {
          res = key.split('.').reduce((ctx: any, k: string) => {
            lastCtx = ctx
            return ctx[k]
          }, eggCtx)
        } catch (e) {
          throw new Error('Context ' + key + ' is undefined.')
        }
        if (typeof res === 'function') return res.call(lastCtx, ...args)
        return res
      }
    })
    ipc.ready()
  })
}
