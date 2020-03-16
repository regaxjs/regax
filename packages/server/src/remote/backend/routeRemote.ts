// tslint:disable:no-any
import { Application, RouteType, SessionFields, RouteData } from '../../api'
import { Remote } from '../index'
import Router from '../../component/router'

export class RouteRemote implements Remote<RouteRemote> {
  constructor(
    protected app: Application,
  ) {
  }
  routeInvoke(route: string, routeType: RouteType, sessionFields: SessionFields, args: any[], traceId: string): Promise<any> {
    const app = this.app
    const router: Router = app.get<Router>('router')
    const routeData: RouteData = router.getRouteData(route, routeType, true)
    return (router.localRouter as any)[routeData.routeType](routeData, app.service.backendSession.create(sessionFields), args, traceId)
  }
}
