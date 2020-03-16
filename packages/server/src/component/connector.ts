// tslint:disable:no-any
import { InternalSession } from './session'
import TaskManager from './taskManager'
import { MessageDataDecodeType, MessageDataType, defaultMessageDecode, defaultMessageEncode } from '../connector/message'
import {
  Application, inject, Component, injectable, RouteType,
  Socket, Connector, ConnectorEvent, SocketEvent, ApplicationOpts, CONNECTOR_DEFAULT_CLIENT_TYPE
} from '../api'
import RPC from './rpc'
import Router from './router'
import PushScheduler from './pushScheduler'
import { PlainData, ErrorCode, PromiseDelegate, MaybePromise } from '@regax/common'
import { ByteArray } from '@regax/protocol'
const debug = require('debug')('regax:connector')

export type MessageResponse = {
  code?: number | string,
  message?: string,
  data?: PlainData
} & PlainData

function getServerType(route: string): string {
  if (!route) {
    return ''
  }
  const idx = route.indexOf('.')
  if (idx < 0) {
    return ''
  }
  return route.substring(0, idx)
}

export interface ConnectorOpts {
  useDict?: boolean
  useProtobuf?: boolean
  maxConnectionCount?: number
  heartbeatInterval?: number // connector heartbeat, ms
  heartbeatTimeout?: number // connector heartbeat timeout, ms
  checkClient?: (clientType: string, clientVersion: string) => boolean,
  userHandshake?: (data: PlainData) => MaybePromise<any>, // send user info when handshake
  createTraceId?: () => string, // create trace id when requested from client
  port?: number, // socket port
  sticky?: boolean, // use sticky mode
  logError?: boolean // default false
  clientType?: string, // 'udp' or 'ws' or any others, default 'ws'
  encode?: (reqId: number, route: number | string, data?: PlainData) => ByteArray | undefined // customize the message encoding
  decode?: (data: MessageDataType) => MessageDataDecodeType // customize the message decoding
}

@injectable()
export default class ConnectorComponent implements Component {
  protected logError: boolean
  protected createTraceId: () => string
  protected connector: Connector
  protected connectorRegistries: ApplicationOpts['connectorRegistries'] & {} = {}
  protected encode: ConnectorOpts['encode'] & {} = defaultMessageEncode
  protected decode: ConnectorOpts['decode'] & {} = defaultMessageDecode
  constructor(
    @inject(Application) protected readonly app: Application,
    @inject(TaskManager) protected readonly taskManager: TaskManager,
    @inject(Router) protected readonly router: Router,
    @inject(RPC) protected readonly rpc: RPC,
    @inject(PushScheduler) protected readonly pushScheduler: PushScheduler,
  ) {
    const opts = this.app.getConfig<ConnectorOpts>('connector') || {}
    this.connectorRegistries = this.app.getConfig<ApplicationOpts['connectorRegistries']>('connectorRegistries') || {}
    this.logError = !!opts.logError
    if (opts.createTraceId) this.createTraceId = opts.createTraceId
    if (opts.encode) this.encode = opts.encode
    if (opts.decode) this.decode = opts.decode
    this.connector = this.createConnector(opts.clientType || CONNECTOR_DEFAULT_CLIENT_TYPE)
  }
  protected createConnector(connectorType: string): Connector {
    if (!this.connectorRegistries[connectorType]) throw new Error('unknown connector type ' + connectorType)
    const ConnectorRegistry = this.connectorRegistries[connectorType]
    return new ConnectorRegistry(this.app)
  }
  async onStart(): Promise<void> {
    if (!this.app.isFrontendServer) return
    this.connector.on(ConnectorEvent.CONNECTION, (socket: Socket) => {
      debug('[%s] connection from client', this.app.serverId)
      const connection = this.app.service.connection
      const opts = this.app.getConfig<ConnectorOpts>('connector') || {}
      if (connection && opts.maxConnectionCount) {
        if (connection.totalConnCount >= opts.maxConnectionCount) {
          this.app.logger.warn('[regax-connector] the server %s has reached the max connections %s', this.app.serverId, opts.maxConnectionCount)
          socket.close()
          return
        }
        connection.increaseConnectionCount()
      }
      // create session for connection
      const session = this.getSession(socket)
      let closed = false
      socket.once(SocketEvent.DISCONNECT, () => {
        if (closed) {
          return
        }
        closed = true
        if (connection) {
          connection.decreaseConnectionCount(session.uid)
        }
      })

      socket.once(SocketEvent.ERROR, () => {
        if (closed) {
          return
        }
        closed = true
        if (connection) {
          connection.decreaseConnectionCount(session.uid)
        }
      })

      // new message
      socket.on(SocketEvent.DATA, (msg: MessageDataType) => {
        const dmsg = this.decode(msg)
        if (!dmsg) {
          // discard invalid message
          return
        }
        // TODO verifyMessage use rsa crypto
        // if (this.useCrypto) {
        //  const verified = verifyMessage(self, session, dmsg);
        //  if (!verified) {
        //    logger.error('fail to verify the data received from client.');
        //    return
        //  }
        // }

        this.handleMessage(socket, session, dmsg)
      })
    })
    const p = new PromiseDelegate<void>()
    // after the rpc connection
    this.rpc.onReady(async () => {
      try {
        const clientPort = await this.connector.start()
        this.app.setServerInfo(undefined, clientPort)
        p.resolve()
      } catch (e) {
        p.reject(e)
      }
    })
    return p.promise
  }
  protected async handleMessage(socket: Socket, session: InternalSession, msg: MessageDataDecodeType): Promise<void> {
    debug('[%s] handleMessage session id: %s, msg: %j', this.app.serverId, session.id, msg)
    const type = getServerType(msg.route)
    if (!type) {
      this.app.logger.error('[regax-connector] invalid route string. route : %j', msg.route)
      return
    }
    let resp
    let error
    try {
      resp = await this.router.invoke(msg.route, RouteType.CONTROLLER, session.toFrontendSession(), [msg.body], this.createTraceId ? this.createTraceId() : undefined)
    } catch (e) {
      if (this.logError || this.app.isLocal || (e.code !== ErrorCode.CONTROLLER_FAIL && e.code !== ErrorCode.RPC_FAIL)) {
        this.app.logger.error('[regax-connector] invoke route "%j" response error: %j', msg.route, e.stack)
      }
      error = e
    }
    if (resp && !msg.id) {
      this.app.logger.warn('[regax-connector] try to response to a notify: %j', msg.route)
      return
    }
    if (!msg.id && !resp && !error) return
    this.send([session], msg.id!, msg.route, error ? { code: error.code || 500, message: error.message } : { data: resp })
  }
  public getSession(socket: Socket): InternalSession {
    const sid = socket.id
    const app = this.app
    let session = app.service.session.get(sid)
    if (session) {
      return session
    }
    session = app.service.session.create(sid, app.serverId, socket)
    debug('[%s] session is created with session id: %s', app.serverId, sid)
    // bind events for session
    socket.once(SocketEvent.DISCONNECT, session.close.bind(session))
    socket.once(SocketEvent.ERROR, session.close.bind(session))
    session.once(session.event.CLOSED, () => {
      this.taskManager.closeQueue(session!.id, true)
      this.app.emit(Application.event.CLOSE_SESSION, session)
    })
    session.on(session.event.BIND, (uid: string | number) => {
      debug('[%s] session bind with uid: %s', this.app.serverId, uid)
      // update connection statistics if necessary
      if (this.app.service.connection) {
        this.app.service.connection.addLoginedUser(uid, {
          loginTime: Date.now(),
          uid: uid,
          address: socket.remoteAddress.host + ':' + socket.remoteAddress.port
        })
      }
      this.app.emit(Application.event.BIND_SESSION, session)
    })

    session.on(session.event.UNBIND, (uid: string | number) =>  {
      if (this.app.service.connection) {
        this.app.service.connection.removeLoginedUser(uid)
      }
      this.app.emit(Application.event.UNBIND_SESSION, session)
    })

    return session
  }
  send(sessions: InternalSession[], reqId: number, route: number | string, msg: MessageResponse): Error | void {
    if (sessions.length === 0) return
    let data = msg.data
    // not a push
    if (reqId) {
      data = (msg.code && msg.code !== 200) ? { code: msg.code, message: msg.message } : { data: msg.data }
    }
    const emsg = this.encode(reqId, route, data)
    if (!emsg) return new Error('[regax-connector] fail to send message for encode result is empty.')
    this.pushScheduler.schedule(sessions, emsg as Buffer)
  }
  onStop(): void {
    if (!this.app.isFrontendServer) return
    this.connector.stop()
  }
}
