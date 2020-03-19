import { ObjectOf, PlainData, EventEmitter, EventListener, pick, each } from '@regax/common'
import { Socket, SocketEvent } from '../api'
import { SessionEvent, SessionFields, Session, Application, EXPORTED_SESSION_FIELDS } from '../api'
import Connector from '../component/connector'
import { SessionOpts } from '../component/session'

const debug = require('debug')('regax:session')

export enum SessionState {
  INITED,
  CLOSED
}

/**
 * Session maintains the relationship between client connection and user information.
 * There is a session associated with each client connection. And it should bind to a
 * user id after the client passes the identification.
 *
 * Session is created in frontend server and should not be accessed in handler.
 * There is a proxy class called BackendSession in backend servers and FrontendSession
 * in frontend servers.
 */
export class InternalSession extends EventEmitter<SessionEvent> {
  static event = SessionEvent
  public uid?: number | string
  protected values: ObjectOf<PlainData> = {}
  protected state: SessionState = SessionState.INITED
  readonly event = SessionEvent

  constructor(
    public readonly id: number | string, // session id
    public readonly frontendId: string,
    protected readonly socket: Socket,
    protected readonly sessionService: SessionService,
  ) {
    super()
  }

  toFrontendSession(): FrontendSession {
    return new FrontendSession(this.id, this.frontendId, this, this.sessionService)
  }

  /**
   * Bind the session with the the uid.
   * @param uid - user id
   */
  bind(uid: number | string): void {
    this.uid = uid
    this.emit(SessionEvent.BIND, uid)
  }

  /**
   * Unbind the session with the the uid.
   * @param uid - user id
   */
  unbind(uid: number | string): void {
    this.uid = undefined
    this.emit(SessionEvent.UNBIND, uid)
  }

  /**
   * Set values (one or many) for the session.
   */
  set(key: string | object, value?: PlainData): void {
    if (typeof key === 'object' && key !== null) {
      this.values = { ...key }
    } else {
      this.values[key] = value!
    }
  }

  /**
   * Remove value from the session.
   */
  remove(key: string): void {
    delete this.values[key]
  }

  /**
   * Get value from the session.
   *
   * @param key - session key
   * @return value associated with session key
   */
  get(key: string): PlainData {
    return this.values[key]
  }

  /**
   * Send message to the session.
   *
   * @param  msg - final message sent to client
   */
  send(msg: PlainData | Buffer): void {
    if (this.state === SessionState.CLOSED) {
      return
    }
    this.socket.send(msg)
  }

  /**
   * Send message to the session in batch.
   *
   * @param  msgs - list of message
   */
  sendBatch(msgs: Buffer[]): void {
    if (this.state === SessionState.CLOSED) {
      return
    }
    this.socket.sendBatch(msgs)
  }

  /**
   * Closed callback for the session which would disconnect client in next tick.
   */
  close(reason?: string): void {
    debug('[%s] session is closed with session id: %s', this.frontendId, this.id)
    if (this.state === SessionState.CLOSED) {
      return
    }
    this.state = SessionState.CLOSED
    this.sessionService.remove(this.id)
    // TODO frontend session
    this.emit(SessionEvent.CLOSED, this, reason)
    this.socket.emit(SocketEvent.KICK, reason) // kick user
    process.nextTick(() => this.socket.close())
  }

  get closed(): boolean {
    return this.state === SessionState.CLOSED
  }
}

/**
 * Session service maintains the internal session for each client connection.
 *
 * Session service is created by session loader and is only
 * <b>available</b> in frontend servers. You can access the service by
 * `app.service.session` or `app.service.session` in frontend servers.
 */
export class SessionService {
  protected singleSession = false
  protected sessions: { [key: string]: InternalSession } = {} // sid => sesssion
  protected uidMap: { [key: string]: InternalSession[] } = {} // uid -> sessions
  constructor(
    protected app: Application,
    opts: SessionOpts,
  ) {
    if (opts.singleSession) {
      this.singleSession = true
    }
  }

  /**
   * Create and return internal session.
   *
   * @param sid - uniqe id for the internal session
   * @param frontendId - frontend server in which the internal session is created
   * @param socket - the underlying socket would be held by the internal session
   */
  create(sid: number | string, frontendId: string, socket: Socket): InternalSession {
    const session = new InternalSession(sid, frontendId, socket, this)
    this.sessions[session.id] = session
    return session
  }

  /**
   * Bind a session with the user id.
   */
  bind(sid: number | string, uid: string | number): void | Error {
    const session = this.sessions[sid]
    if (!session) {
      return new Error(`session does not exist, sid: ${sid}`)
    }
    if (session.uid) {
      if (session.uid === uid) {
        return
      }
      return new Error(`session has aleady bind with ${session.uid}`)
    }
    let sessions = this.uidMap[uid]
    if (this.singleSession && sessions) {
      return new Error(`singleSession is enabled, and session has already bind with uid ${uid}`)
    }
    if (!sessions) {
      sessions = this.uidMap[uid] = []
    }
    for (let i = 0, l = sessions.length; i < l; i++) {
      if (sessions[i].id === session.id) {
        return
      }
    }
    sessions.push(session)
    session.bind(uid)
  }

  /**
   * Unbind a session with the user id.
   */
  unbind(sid: number | string, uid: string | number): void | Error {
    const session = this.sessions[sid]
    if (!session) {
      return new Error(`session does not exist, sid: ${sid}`)
    }
    if (!session.uid || session.uid !== uid) {
      return new Error('session has not bind with ' + session.uid)
    }
    const sessions = this.uidMap[uid]
    if (sessions) {
      for (let i = 0, l = sessions.length; i < l; i++) {
        const sess = sessions[i]
        if (sess.id === sid) {
          sessions.splice(i, 1)
          break
        }
      }

      if (sessions.length === 0) {
        delete this.uidMap[uid]
      }
    }
    session.unbind(uid)
  }

  get(sid: number | string): InternalSession | undefined {
    return this.sessions[sid]
  }

  /**
   * Get sessions by userId.
   * @param uid - User id associated with the session
   * @return list of session binded with the uid
   */
  getByUid(uid: string | number): InternalSession[] | undefined {
    return this.uidMap[uid]
  }

  remove(sid: number | string): void {
    const session = this.sessions[sid]
    if (session) {
      const uid = session.uid
      delete this.sessions[session.id]
      if (uid === undefined) {
        return
      }
      const sessions = this.uidMap[uid]
      if (!sessions) {
        return
      }

      for (let i = 0, l = sessions.length; i < l; i++) {
        if (sessions[i].id === sid) {
          sessions.splice(i, 1)
          if (sessions.length === 0) {
            delete this.uidMap[uid]
          }
          break
        }
      }
    }
  }

  /**
   * Import the key/value into session.
   */
  import(sid: number | string, settings: ObjectOf<PlainData>): void | Error {
    const session = this.sessions[sid]
    if (!session) {
      return new Error(`session does not exist, sid: ${sid}`)
    }
    each(settings, (val, k) => session.set(k, val))
  }

  /**
   * Import new value for the existed session.
   */
  importAll(sid: number | string, settings: ObjectOf<PlainData>): void | Error {
    const session = this.sessions[sid]
    if (!session) {
      return new Error(`session does not exist, sid: ${sid}`)
    }
    session.set(settings)
  }

  /**
   * Kick all the session offline under the user id.
   */
  kickByUid(uid: string | number, reason?: string): void {
    const sessions = this.getByUid(uid)
    if (sessions) {
      // notify client
      sessions.forEach(session => {
        session.close(reason)
      })
    }
  }

  /**
   * Kick a user offline by session id.
   */
  kickBySessionId(sid: number | string, reason?: string): void {
    const session = this.get(sid)
    if (session) {
      session.close(reason)
    }
  }

  sendMessage(sid: number | string, route: string, msg: PlainData): boolean {
    const session = this.get(sid)

    if (!session) {
      debug('Fail to send message for non-existing session, sid: ' + sid + ' msg: ' + msg)
      return false
    }
    this.app.get<Connector>('connector').send([session], 0, route, { data: msg })
    return true
  }

  sendMessageByUid(uid: string | number, route: string, msg: PlainData): boolean {
    const sessions = this.getByUid(uid)

    if (!sessions) {
      debug('fail to send message by uid for non-existing session. uid: %j', uid)
      return false
    }

    this.app.get<Connector>('connector').send(sessions, 0, route, { data: msg })
    return true
  }

  forEachSession(cb: (session: InternalSession) => void): void {
    for (const sid in this.sessions) {
      cb(this.sessions[sid])
    }
  }

  forEachBindedSession(cb: (session: InternalSession) => void): void {
    for (const uid in this.uidMap) {
      const sessions = this.uidMap[uid]
      if (!sessions) {
        for (let i = 0, l = sessions!.length; i < l; i++) {
          cb(sessions[i])
        }
      }
    }
  }

  getSessionsCount(): number {
    return Object.keys(this.sessions).length
  }
}

export class FrontendSession implements Session {
  readonly event = SessionEvent
  constructor(
    public readonly id: number | string, // session id
    public readonly frontendId: string,
    protected internalSession: InternalSession,
    protected readonly sessionService: SessionService,
  ) {
  }

  get uid(): string | number | undefined {
    return this.internalSession.uid
  }
  async bind(uid: number | string): Promise<void> {
    this.sessionService.bind(this.id, uid)
  }

  async unbind(uid: number | string): Promise<void> {
    this.sessionService.unbind(this.id, uid)
  }

  async push(...keys: string[]): Promise<void> {
    // frontendSession ignore push
  }

  async pushAll(): Promise<void> {
    // frontendSession ignore push all
  }

  on(event: SessionEvent, fn: EventListener): () => void {
    return this.internalSession.on(event, fn)
  }

  once(event: SessionEvent, fn: EventListener): () => void {
    return this.internalSession.once(event, fn)
  }

  off(event: SessionEvent, fn: EventListener): void {
    this.internalSession.off(event, fn)
  }

  /**
   * Export the key/values for serialization.
   */
  toJSON(): SessionFields {
    return pick(this.internalSession, EXPORTED_SESSION_FIELDS)
  }

  set(key: string | object, value?: PlainData): void {
    this.internalSession.set(key, value)
  }

  remove(key: string): void {
    this.internalSession.remove(key)
  }

  get(key: string): PlainData {
    return this.internalSession.get(key)
  }
  async send(route: string, msg: PlainData): Promise<void> {
    this.sessionService.sendMessage(this.id, route, msg)
  }
  async close(reason?: string): Promise<void> {
    this.sessionService.kickBySessionId(this.id, reason)
  }
}
