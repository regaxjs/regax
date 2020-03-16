import { Filter, Application } from '@regax/server'
const utility = require('utility')

export default function Filter(app: Application): Filter {
  const traceLogger = app.getLogger('traceLogger')
  return async (ctx, next) => {
    const startTime = Date.now()
    await next()
    traceLogger.write(`${utility.logDate('.')},${ctx.traceId},${ctx.routeType},${ctx.route},${ctx.error ? 'N' : 'Y'},${Date.now() - startTime}ms,${ctx.session.uid}`)
  }
}
