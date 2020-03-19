// tslint:disable:no-any
import { Controller } from '../../../../../'

export default class EntryController extends Controller {
  /**
   * New client entry chat server.
   *
   * @param  {Object}  msg  request message
   */
  async enter(msg: { rid: string, username: string }): Promise<boolean> {
    const rid = msg.rid // room id
    const uid = msg.username + '*' + rid
    const { session } = this.ctx
    // rebind
    if (session.uid) {
      await session.unbind(session.uid)
    }
    await session.bind(uid)
    session.set('rid', rid)
    await session.push('rid') // 同步数据
    session.on(session.event.CLOSED, () => {
      // TODO
    })
    return this.rpc.chat.room.add(rid, uid, this.app.serverId)
  }
}
