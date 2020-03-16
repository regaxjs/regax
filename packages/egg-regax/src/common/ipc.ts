import { Fn, PromiseDelegate, RegaxError } from '@regax/common'

const INVOKE_TIMEOUT = 5000
let _id = 0
export enum RegaxIPCType {
  REQUEST = 'regax_ipc_req',
  RESPONSE = 'regax_ipc_res'
}
// tslint:disable:no-any
export class RegaxIPC {
  protected reqs: { [reqId: string]: PromiseDelegate<any> } = {}
  constructor(
    protected messenger: any,
    protected type: 'agent' | 'worker',
    protected services: { [serviceName: string]: Fn } = {}
  ) {}
  ready(): void {
    this.messenger.on(RegaxIPCType.REQUEST, async ({ action, data, id, pid }: any) => {
      if (this.services[action]) {
        try {
          const res = await this.services[action](data)
          this.messenger.sendTo(pid, RegaxIPCType.RESPONSE, { data: res, id })
        } catch (e) {
          this.messenger.sendTo(pid, RegaxIPCType.RESPONSE, { error: RegaxError.toJSON(e), id })
        }
      } else {
        this.messenger.sendTo(pid, RegaxIPCType.RESPONSE, { error: RegaxError.toJSON(new Error('Unknown action' + action)), id })
      }
    })
    this.messenger.on(RegaxIPCType.RESPONSE, ({ data, error, id }: any) => {
      if (this.reqs[id]) {
        const p = this.reqs[id]
        delete this.reqs[id]
        if (error) {
          p.reject(RegaxError.create(error))
        } else {
          p.resolve(data)
        }
      }
    })
  }
  invoke(action: string, data?: any): Promise<any> {
    const p = new PromiseDelegate<any>()
    const reqId = _id++
    this.reqs[reqId] = p
    setTimeout(() => {
      delete this.reqs[reqId]
      p.reject(new Error(`inovke ${action} timeout`))
    }, INVOKE_TIMEOUT)
    if (this.type === 'agent') {
      this.messenger.sendRandom(RegaxIPCType.REQUEST, { action, data, id: reqId, pid: process.pid })
    } else {
      this.messenger.sendToAgent(RegaxIPCType.REQUEST, { action, data, id: reqId, pid: process.pid })
    }
    return p.promise
  }
}
