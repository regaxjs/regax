// tslint:disable:no-any
import { RouteData } from '../../../'
import { BackendSession } from '../../../service/backendSessionService'
import { Routes } from '@regax/rpc'

export function chat(servers: string[], session: BackendSession, msg: any, route: RouteData): string {
  const rid: string = session.get('rid') as string
  if (!rid) throw new Error('miss chat room')
  return Routes.df(servers, route, rid)
}
