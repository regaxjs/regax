// tslint:disable:no-any
import { ServerInfo } from '@regax/rpc'
import { RegaxLoggerManagerOpts, RegaxLoggerOpts } from '@regax/logger'
import { RPCOpts } from '../component/rpc'
import { ConnectorOpts } from '../component/connector'
import { RouterOpts } from '../component/router'
import { SessionOpts } from '../component/session'
import { MasterOpts } from '../component/master'
import { AgentOpts } from '../component/agent'
import { ComponentOpts } from './component'
import { Connector, StickyServer } from './connector'
import { UDPConnectorOpts } from '../connector/udpConnector'
import { WebSocketConnectorOpts } from '../connector/wsConnector'
import { LoaderOpts } from '../loader/loader'
import { Application } from '../application'
import { FilterCreator, FilterConfig } from './filter'
import { ObjectOf } from '@regax/common'

export enum ApplicationEnv {
  local = 'local',
  prod = 'prod',
  test = 'test',
  unittest = 'unittest'
}

export interface ApplicationOpts {
  app?: {
    serverVersion?: string, // Application Server version
  }
  router?: RouterOpts,
  connector?: ConnectorOpts,
  connectorRegistries?: { [clientType: string]: { new(app: Application): Connector } }
  udpConnector?: UDPConnectorOpts
  wsConnector?: WebSocketConnectorOpts
  stickyServerRegistries?: { [clientType: string]: { new(port: number, app: Application): StickyServer } }
  session?: SessionOpts,
  filters?: ObjectOf<FilterCreator>,
  filterConfigs?: ObjectOf<FilterConfig>
  rpc?: RPCOpts,
  master?: MasterOpts
  agent?: AgentOpts
  loader?: LoaderOpts, // only use when app preload
  logrotator?: {
    filesRotateByHour?: string[], // for rotate_by_hour
    filesRotateBySize?: string[], // for rotate_by_size
    hourDelimiter?: string, // default '-'
    maxFileSize?: number,
    maxFiles?: number,
    rotateDuration?: number,
    maxDays?: number, // for clean_log
  },
  logger?: RegaxLoggerManagerOpts & {
    disableConsoleAfterReady?: boolean
    allowDebugAtProd?: boolean
    coreLogger?: RegaxLoggerOpts // custom config of coreLogger
  }
  customLogger?: {
    [loggerName: string]: RegaxLoggerOpts,
  }
  component?: ComponentOpts
  [componentName: string]: any
}

export interface ApplicationServerInfo extends ServerInfo {
  clientPort?: number,
  clientType?: string, // udp or ws or other customs, default ws
  sticky?: boolean,
}

export enum ApplicationEvent {
  BIND_SESSION = 'bind_session',
  UNBIND_SESSION = 'unbind_session',
  CLOSE_SESSION = 'close_session',
  STARTED = 'started',
  STOPPED = 'stopped',
  READY = 'ready', // all servers started
}
