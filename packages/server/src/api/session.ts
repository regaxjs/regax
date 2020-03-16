import { ObjectOf, PlainData, EventListener } from '@regax/common'

export enum SessionEvent {
  BIND = 'bind',
  UNBIND = 'unbind',
  CLOSED = 'closed'
}

export interface SessionFields {
  id: number | string, // session id
  frontendId: string,
  uid?: number | string
  values: ObjectOf<PlainData>,
}

export const EXPORTED_SESSION_FIELDS = ['id', 'frontendId', 'uid', 'values']

export interface Session {
  readonly event: typeof SessionEvent
  readonly frontendId: string
  readonly id: string | number
  uid?: number | string
  bind(uid: number | string): Promise<void>
  unbind(uid: number | string): Promise<void>
  push(...keys: string[]): Promise<void>
  pushAll(...keys: string[]): Promise<void>
  toJSON(): SessionFields
  get(key: string): PlainData
  remove(key: string): void
  set(key: string | object, value?: PlainData): void
  on(event: SessionEvent, fn: EventListener): () => void
  once(event: SessionEvent, fn: EventListener): () => void
  off(event: SessionEvent, fn: EventListener): void
  send(route: string, msg: PlainData): Promise<void>
  close(reason?: string): Promise<void>
}
