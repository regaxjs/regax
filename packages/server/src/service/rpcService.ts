// tslint:disable:no-any
import { Session, RouteType, Application } from '../api'
import { ServerServices } from '@regax/rpc'
import { ChannelRemote } from '../remote/frontend/channelRemote'
import { SessionRemote } from '../remote/frontend/sessionRemote'
import Router from '../component/router'
import { createProxy } from '../util/proxy'
import RPC from '../component/rpc'

interface RemoteServices {
  channel: ChannelRemote,
  session: SessionRemote,
}

export class RPCService {
  constructor(
    protected app: Application
  ) {
  }
  invoke(route: string, session: Session, args: any[], traceId?: string): Promise<any> {
    return this.app.get<Router>('router').invoke(route, RouteType.RPC, session, args, traceId)
  }
  remote(serverId: string): RemoteServices {
    const proxy = this.app.get<RPC>('rpc').invokeProxy(serverId)
    return {
      channel: createProxy<ChannelRemote>((method: string) => (...args: any[]) => proxy.channelRemote(method, args)),
      session: createProxy<SessionRemote>((method: string) => (...args: any[]) => proxy.sessionRemote(method, args)),
    }
  }
  invokeServer(serverId: string, serviceName: string, ...args: any[]): Promise<any> {
    return this.app.get<RPC>('rpc').rpcInvoke(serverId, serviceName, args)
  }
  extendServices(services: ServerServices): void {
    this.app.get<RPC>('rpc').extendServices(services)
  }
}
