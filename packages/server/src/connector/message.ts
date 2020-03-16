import { Message, MessageType, MessageDataType } from '@regax/protocol'
import { PlainData } from '@regax/common'
import {ByteArray} from '@regax/protocol'

export interface MessageDataDecodeType {
  id?: number,
  route: string,
  body: PlainData
}

export {
  MessageDataType,
}

export function defaultMessageEncode(reqId: number, route: number | string, data?: PlainData): ByteArray | undefined {
  if (reqId) {
    // response
    if (!reqId || !route || !data) return
    return Message.encode(reqId, MessageType.RESPONSE, 0, undefined, encodeBody(data))
  } else {
    // push
    if (!route || !data) return
    return Message.encode(0, MessageType.PUSH, 0, route, encodeBody(data))
  }
}

export function defaultMessageDecode(data: MessageDataType): MessageDataDecodeType {
  const msg = Message.decode(data.body)
  let body = {}
  try {
    body = JSON.parse(msg.body.toString('utf8'))
  } catch (e) {
    body = {}
  }
  return { id: msg.id, route: msg.route as string, body }
}

function encodeBody(msgBody: PlainData): Buffer {
  // TODO encode use protobuf
  return Buffer.from(JSON.stringify(msgBody), 'utf8')
}
