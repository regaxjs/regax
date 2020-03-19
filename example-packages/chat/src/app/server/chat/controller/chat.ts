// tslint:disable:no-any
import { Controller } from '@regax/server'

export default class ChatController extends Controller {
  /**
   * Send messages to users
   * @param msg
   */
  send(msg: any): void {
    const { session } = this.ctx
    const rid = session.get('rid') // room id
    const username = (session.uid as string).split('*')[0]
    const param = {
      msg: msg.content,
      from: username,
      target: msg.target
    }
    const channel = this.service.channel.getChannel(rid as string, true)!
    if (msg.target === '*') {
      // the target is all users
      channel.pushMessage('onChat', param)
    } else {
      // the target is specific user
      const tuid = msg.target + '*' + rid
      const data = channel.getValueByUid(tuid) // serverId
      if (!data) {
        this.fail('User %s is not in the room %s', msg.target, rid)
        return
      }
      const uids = [{
        uid: tuid,
        sid: data.sid,
      }]
      channel.pushMessageByUids('onChat', param, uids)
    }
  }
}
