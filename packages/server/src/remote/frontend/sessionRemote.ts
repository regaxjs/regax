import { Application, SessionFields } from '../../api'
import { SessionService } from '../../service/sessionService'
import { Remote } from '../index'
import { PlainData, ObjectOf } from '@regax/common'

export class SessionRemote implements Remote<SessionRemote> {
  constructor(
    protected app: Application,
  ) {
  }
  protected get sessionService(): SessionService {
    return this.app.service.session
  }
  async getBackendSessionBySid(sid: string | number): Promise<SessionFields | undefined> {
    const session = this.sessionService.get(sid)
    if (session) return session.toFrontendSession().toJSON()
  }
  async getBackendSessionsByUid(uid: string | number): Promise<SessionFields[] | undefined> {
    const sessions = this.sessionService.getByUid(uid)
    if (sessions) {
      return sessions.map(session => session.toFrontendSession().toJSON())
    }
  }
  async kickBySessionId(sid: string | number, reason?: string): Promise<void> {
    this.sessionService.kickBySessionId(sid, reason)
  }
  async kickByUid(uid: string | number, reason?: string): Promise<void> {
    this.sessionService.kickByUid(uid, reason)
  }
  async bind(sid: string | number, uid: string | number): Promise<void> {
    this.sessionService.bind(sid, uid)
  }
  async unbind(sid: string | number, uid: string | number): Promise<void> {
    this.sessionService.unbind(sid, uid)
  }
  async push(sid: string | number, values: ObjectOf<PlainData>): Promise<void> {
    this.sessionService.import(sid, values)
  }
  async pushAll(sid: string | number, values: ObjectOf<PlainData>): Promise<void> {
    this.sessionService.importAll(sid, values)
  }
  async sendMessage(sid: string | number, route: string, msg: PlainData): Promise<boolean> {
    return this.sessionService.sendMessage(sid, route, msg)
  }
  async sendMessageByUid(uid: string | number, route: string, msg: PlainData): Promise<boolean> {
    return this.sessionService.sendMessageByUid(uid, route, msg)
  }
}
