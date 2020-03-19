// tslint:disable:no-any
import { Application } from '../application'
import { Service } from '../service'
import { createRPCProxy, RPCProxy } from './rpc'
import { createProxy } from '../util/proxy'
import { PromiseDelegate, RegaxError, ErrorCode } from '@regax/common'
import { Session } from './session'
const util = require('util')

export interface Context {
  session: Session,
  traceId: string,
  [key: string]: any
}

export function getAppService(service: Service, isFrontend: boolean): Service {
  service = { ...service }
  if (isFrontend) {
    service.backendSession = createProxy(() => {
      throw new Error('Frontend server cannot use backendSession service.')
    })
  } else {
    service.session = createProxy(() => {
      throw new Error('Backend server cannot use frontendSession service.')
    })
  }
  return service
}

export class Controller {
  protected readonly ctx: Context
  protected readonly app: Application
  protected readonly service: Service
  protected readonly rpc: RPCProxy
  private promiseDelegate?: PromiseDelegate<any>
  constructor(app: Application, session: Session, promiseDelegate: PromiseDelegate<any>, isFrontend: boolean, traceId: string) {
    this.ctx = Object.assign({}, app.appContext, { session, traceId })
    this.app = app
    this.service = getAppService(app.service, isFrontend)
    this.rpc = createRPCProxy(this.app, session, traceId)
    this.promiseDelegate = promiseDelegate
  }
  fail(error: string | Error, ...args: any): void {
    if (typeof error === 'string' && args.length) {
      error = util.format(error, ...args)
    }
    const promiseDelegate = this.promiseDelegate
    if (promiseDelegate) {
      this.promiseDelegate = undefined
      promiseDelegate.reject(RegaxError.create(error, ErrorCode.CONTROLLER_FAIL))
    }
  }
  success(data: any): void {
    const promiseDelegate = this.promiseDelegate
    if (promiseDelegate) {
      this.promiseDelegate = undefined
      promiseDelegate.resolve(data)
    }
  }
  isFinish(): boolean {
    return !this.promiseDelegate
  }
}

// Cannot be called by client
export const ControllerBuiltInKey = Object.getOwnPropertyNames(Controller.prototype)
