// tslint:disable:no-any
const crc = require('crc')

export interface Route {
  (servers: string[], msg: RouteMsgData, searchSeed?: string, client?: any): string
}
export interface RouteMsgData {
  serverType: string,
  serviceName?: string,
  args?: any[]
}

/**
 * Calculate route info and return an appropriate server id.
 */
export function defRoute(servers: string[], msg: RouteMsgData, searchSeed?: string): string {
  const index = Math.abs(crc.crc32(searchSeed || Math.random().toString())) % servers.length
  return servers[index]
}

/**
 * Random algorithm for calculating server id.
 */
export function rdRoute(servers: string[]): string {
  const index = Math.floor(Math.random() * servers.length)
  return servers[index]
}

/**
 * Round-Robin algorithm for calculating server id.
 */
export function rrRoute(servers: string[], msg: RouteMsgData, searchSeed?: string, client?: any): string {
  if (!client._rrParam) {
    client._rrParam = {}
  }
  let index
  if (client._rrParam[msg.serverType]) {
    index = client._rrParam[msg.serverType]
  } else {
    index = 0
  }
  const serverId = servers[index % servers.length]
  if (index++ === Number.MAX_VALUE) {
    index = 0
  }
  client._rrParam[msg.serverType] = index
  return serverId
}

const Routes: { [routeType: string]: Route } = {
  df: defRoute,
  rr: rrRoute,
  rd: rdRoute,
}

export {
  Routes
}
