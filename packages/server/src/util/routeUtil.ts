interface RouteData {
  route: string,
  serverType: string,
  method: string,
  name: string,
  isFrontend: boolean,
  isBackend: boolean,
}

// like 'connector.entry.enter'
export function parseRoute(route: string): RouteData | undefined {
  if (!route) return
  const ts = route.split('.')
  if (ts.length !== 3) {
    return
  }
  const isFrontend = ts[0] === 'connector' || ts[0] === 'gate'
  return {
    route: route,
    serverType: ts[0],
    name: ts[1],
    method: ts[2],
    isFrontend,
    isBackend: !isFrontend,
  }
}
