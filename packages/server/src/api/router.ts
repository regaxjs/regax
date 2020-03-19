// tslint:disable:no-any
import { Application } from '../application'
import { Routes } from '@regax/rpc'
import { Session } from './session'

export interface RouteData {
  route: string,
  routeType: RouteType,
  serverType: string,
  name: string,
  method: string,
  isFrontend: boolean,
  isBackend: boolean,
}

export enum RouteType {
  CONTROLLER = 'controller', // client request
  RPC = 'rpc', // rpc invoke
}

export interface Router {
  controller(route: RouteData, session: Session, args: any[], traceId: string): Promise<any>
  rpc(route: RouteData, session: Session, args: any[], traceId: string): Promise<any>
}

export interface ServerRoute {
  (servers: string[], session: Session, msg: any, routeData: RouteData, app: Application): string
}

export {
  Routes
}
