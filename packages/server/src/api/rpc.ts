// tslint:disable:no-any
import { Application } from '../application'
import { Service } from '../service'
import { Session } from './session'
import { createProxy } from '../util/proxy'
import { Context, getAppService } from './controller'

export function createRPCProxy(app: Application, session: Session, traceId: string): RPCProxy {
  return createProxy((serverType: string, rpcName: string, method: string) => {
    return (...args: any[]) => {
      return app.service.rpc.invoke(`${serverType}.${rpcName}.${method}`, session, args, traceId)
    }
  }, 3)
}

export interface RPCProxy {
  [serverType: string]: {
    [rpcName: string]: {
      [method: string]: (...args: any[]) => Promise<any>
    }
  }
}

export class RPC {
  protected readonly ctx: Context
  protected readonly service: Service
  protected readonly rpc: RPCProxy
  constructor(
    protected readonly app: Application,
    session: Session,
    isFrontend: boolean,
    traceId: string,
  ) {
    this.service = getAppService(app.service, isFrontend)
    this.rpc = createRPCProxy(this.app, session, traceId)
    this.ctx = Object.assign({}, app.appContext, { session, traceId })
  }
}
