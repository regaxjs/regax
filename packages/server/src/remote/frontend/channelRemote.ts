import { Application } from '../../api'
import { InternalSession } from '../../component/session'
import Connector from '../../component/connector'
import { PlainData } from '@regax/common'
import { Remote } from '../index'

export class ChannelRemote implements Remote<ChannelRemote> {
  constructor(
    protected app: Application,
  ) {
  }
  async pushMessage(route: string, msg: PlainData, uids: (string | number)[]): Promise<void> {
    if (!msg) {
      this.app.logger.error('Can not send empty message! route : %j, compressed msg : %j',
        route, msg)
      return
    }
    const connector = this.app.get<Connector>('connector')
    const sessionService = this.app.service.session
    const ss: InternalSession[] = []
    for (let i = 0, l = uids.length; i < l; i++) {
      const sessions = sessionService.getByUid(uids[i])
      if (sessions) {
        for (let j = 0, k = sessions.length; j < k; j++) {
          ss.push(sessions[j])
        }
      }
    }
    connector.send(ss, 0, route, { data: msg })
  }
  async broadcast(route: string, msg: PlainData, binded: boolean = true): Promise<void> {
    const connector = this.app.get<Connector>('connector')
    const sessionService = this.app.service.session
    const getSessions = () => {
      const sessions: InternalSession[] = []
      if (binded) {
        sessionService.forEachBindedSession(session => sessions.push(session))
      } else {
        sessionService.forEachSession(session => sessions.push(session))
      }
      return sessions
    }
    connector.send(getSessions(), 0, route, { data: msg })
  }
}
