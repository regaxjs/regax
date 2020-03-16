import { Controller } from '@regax/server'

export default class EntryController extends Controller {
  /**
   * New client entry chat server.
   */
  async enter(msg: { rid: number, username: string }): Promise<void> {
    const rid = msg.rid // room id
    const uid = msg.username + '*' + rid
    const { session } = this.ctx
    // bind to uid
    session.bind(uid)
    session.set('rid', rid)
    session.push('rid')
    session.on(session.event.CLOSED, () => {
      console.log('>>>>>>>>>> session closed')
    })
    await this.rpc.chat.room.add(uid, this.app.serverId, rid)
  }
}
