// tslint:disable:no-any
import { pick, PlainData, ObjectOf, EventListener } from '@regax/common'
import { Application, SessionEvent, Session, SessionFields, EXPORTED_SESSION_FIELDS } from '../api'
import { SessionRemote } from '../remote/frontend/sessionRemote'

export class BackendSession implements Session {
  readonly event = SessionEvent
  public id: number | string
  public frontendId: string
  public uid?: number | string
  public values: ObjectOf<PlainData> = {}
  constructor(
    sessionFields: SessionFields,
    protected readonly sessionService: BackendSessionService,
  ) {
    EXPORTED_SESSION_FIELDS.forEach((key: keyof SessionFields) => {
      if (sessionFields[key] !== undefined) {
        (this as any)[key] = sessionFields[key]
      }
    })
  }
  async bind(uid: string | number): Promise<void> {
    await this.sessionService.bind(this.frontendId, this.id, uid)
    this.uid = uid
  }
  async unbind(uid: string | number): Promise<void> {
    await this.sessionService.unbind(this.frontendId, this.id, uid)
    this.uid = uid
  }
  set(key: string | object, value?: PlainData): void {
    if (typeof key === 'object' && key !== null) {
      this.values = { ...key }
    } else {
      this.values[key] = value!
    }
  }
  get(key: string): PlainData {
    return this.values[key]
  }
  remove(key: string): void {
    delete this.values[key]
  }
  async push(...keys: string[]): Promise<void> {
    return this.sessionService.push(this.frontendId, this.id, pick(this.values, keys))
  }
  async pushAll(): Promise<void> {
    return this.sessionService.pushAll(this.frontendId, this.id, this.values)
  }
  toJSON(): SessionFields {
    return pick(this, EXPORTED_SESSION_FIELDS)
  }
  on(event: SessionEvent, fn: EventListener): () => void {
    throw new Error('BackendSession cannot use on event')
  }

  once(event: SessionEvent, fn: EventListener): () => void {
    throw new Error('BackendSession cannot use once event')
  }

  off(event: SessionEvent, fn: EventListener): void {
    throw new Error('BackendSession cannot use off event')
  }
  async send(route: string, msg: PlainData): Promise<void> {
    await this.sessionService.sendMessage(this.frontendId, this.id, route, msg)
  }
  async close(reason?: string): Promise<void> {
    await this.sessionService.kickBySessionId(this.frontendId, this.id, reason)
  }
}

export class BackendSessionService {
  constructor(
    protected app: Application,
  ) {
  }
  protected getSessionRemote(serverId: string): SessionRemote {
    return this.app.service.rpc.remote(serverId).session
  }
  create(sessionFields: SessionFields): BackendSession {
    return new BackendSession(sessionFields, this)
  }
  async get(frontendId: string, sid: string | number): Promise<BackendSession | void> {
    const sessionFields = await this.getSessionRemote(frontendId).getBackendSessionBySid(sid)
    if (sessionFields) return this.create(sessionFields)
  }
  async getByUid(frontendId: string, uid: string | number): Promise<BackendSession[] | void> {
    const sessions = await this.getSessionRemote(frontendId).getBackendSessionsByUid(uid)
    if (sessions) return sessions.map(s => this.create(s))
  }
  async kickBySessionId(frontendId: string, sid: string | number, reason?: string): Promise<void> {
    await this.getSessionRemote(frontendId).kickBySessionId(sid, reason)
  }
  async kickByUid(frontendId: string, uid: string | number): Promise<void> {
    await this.getSessionRemote(frontendId).kickByUid(uid)
  }
  async bind(frontendId: string, sid: string | number, uid: string | number): Promise<void> {
    await this.getSessionRemote(frontendId).bind(sid, uid)
  }
  async unbind(frontendId: string, sid: string | number, uid: string | number): Promise<void> {
    await this.getSessionRemote(frontendId).unbind(sid, uid)
  }
  async push(frontendId: string, sid: string | number, values: ObjectOf<PlainData>): Promise<void> {
    await this.getSessionRemote(frontendId).push(sid, values)
  }
  async pushAll(frontendId: string, sid: string | number, values: ObjectOf<PlainData>): Promise<void> {
    await this.getSessionRemote(frontendId).pushAll(sid, values)
  }
  async sendMessage(frontendId: string, sid: string | number, route: string, msg: PlainData): Promise<boolean> {
    return this.getSessionRemote(frontendId).sendMessage(sid, route, msg)
  }
  async sendMessageByUid(frontendId: string, uid: string | number, route: string, msg: PlainData): Promise<boolean> {
    return this.getSessionRemote(frontendId).sendMessageByUid(uid, route, msg)
  }
}
