import { EventEmitter } from '@regax/common'
import { Logger } from '@regax/logger'
import { ServerInfo, ServerMap } from '../server/server'

export enum RegistryEvent {
  CONNECTION = 'connection',
  DISCONNECT = 'disconnect',
  CHANGED = 'changed',
  ERROR = 'error'
}

export {
  ServerInfo,
  ServerMap,
}

export const REGISTRY_CHANGE_DELAY = 10

export interface RegistryOpts {
  rootPath?: string
  logger?: Logger
}

export interface Registry extends EventEmitter<RegistryEvent> {
  start(): void
  stop(): void
  isConnected(): boolean,
  register(serverInfo: ServerInfo): Promise<void>
  unRegister(serverId: string): Promise<void>
  getServerInfo(serverId: string): Promise<ServerInfo>
  getAllServers(): Promise<ServerMap>
  subscribe(fn: (servers: ServerMap) => void): () => void
}

// registries
export * from './registries/localRegistry'
export * from './registries/zookeeperRegistry'
export * from './registries/remoteCacheRegistry'
