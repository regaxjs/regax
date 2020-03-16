// tslint:disable:no-any
import { RouteData } from './router'
import { Application } from '../application'
import { Session } from './session'

export interface FilterContext extends RouteData {
  args: any[],
  res?: any, // router response
  error?: Error,
  traceId?: string,
  session: Session,
}

export interface Filter {
  (ctx: FilterContext, next: (error?: string | Error) => Promise<void>): Promise<void>
}

export interface FilterConfig {
  [key: string]: any
}
export interface FilterCreator {
  (app: Application, filterConfig: FilterConfig): Filter,
}
