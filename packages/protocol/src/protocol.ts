// Fork from  https://github.com/NetEase/pomelo-protocol to typescript

export type ByteArray = Uint8Array | Buffer
type BooleanNum = number
const ByteArray = (typeof window === 'undefined')  ? Buffer : Uint8Array
const useBuffer = typeof Buffer !== 'undefined' && ByteArray === Buffer
const createByteArrayFromData = useBuffer ? (data: ByteArray) => Buffer.from(data) : (data: ByteArray) => new Uint8Array(data)
const createByteArray = useBuffer ? (size: number) => Buffer.alloc(size) : (size: number) => new Uint8Array(size)

const PKG_HEAD_BYTES = 4
const MSG_FLAG_BYTES = 1
const MSG_ROUTE_CODE_BYTES = 2
// const MSG_ID_MAX_BYTES = 5
const MSG_ROUTE_LEN_BYTES = 1

const MSG_ROUTE_CODE_MAX = 0xffff
const MSG_COMPRESS_ROUTE_MASK = 0x1
const MSG_COMPRESS_GZIP_MASK = 0x1
const MSG_COMPRESS_GZIP_ENCODE_MASK = 1 << 4
const MSG_TYPE_MASK = 0x7

// Package 格式
export enum PackageType {
  HANDSHAKE = 1, // 客户端到服务器的握手请求以及服务器到客户端的握手响应
  HANDSHAKE_ACK = 2, // 客户端到服务器的握手ack
  HEARTBEAT = 3, // 心跳包
  DATA = 4, // 数据包
  KICK = 5, // 服务器主动断开连接通知
}

export interface PackageDataType { type: PackageType, body?: ByteArray }
export interface MessageDataType { id: number, type: MessageType, compressRoute?: BooleanNum, route?: number | string, body: ByteArray, compressGzip?: BooleanNum }
// 消息格式
export enum MessageType {
  REQUEST = 0,
  NOTIFY = 1,
  RESPONSE = 2,
  PUSH = 3,
}

/**
 * client encode
 * id message id;
 * route message route
 * msg message body
 * socketio current support string
 */
export function strencode(str: string): ByteArray {
  if (useBuffer) {
    // encoding defaults to 'utf8'
    return Buffer.from(str)
  } else {
    const byteArray = new Uint8Array(str.length * 3)
    let offset = 0
    for (let i = 0; i < str.length; i++ ) {
      const charCode = str.charCodeAt(i)
      let codes
      if (charCode <= 0x7f) {
        codes = [charCode]
      } else if (charCode <= 0x7ff) {
        codes = [0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f)]
      } else {
        codes = [0xe0 | (charCode >> 12), 0x80 | ((charCode & 0xfc0) >> 6), 0x80 | (charCode & 0x3f)]
      }
      for (let j = 0; j < codes.length; j++) {
        byteArray[offset] = codes[j]
        ++offset
      }
    }
    const _buffer = new Uint8Array(offset)
    copyArray(_buffer, 0, byteArray, 0, offset)
    return _buffer
  }
}

/**
 * client decode
 * msg String data
 * return Message Object
 */
export function strdecode(buffer: ByteArray): string {
  if (useBuffer) {
    // encoding defaults to 'utf8'
    return buffer.toString()
  } else {
    const bytes = createByteArrayFromData(buffer)
    const array = []
    let offset = 0
    let charCode = 0
    const end = bytes.length
    while (offset < end) {
      if (bytes[offset] < 128) {
        charCode = bytes[offset]
        offset += 1
      } else if (bytes[offset] < 224) {
        charCode = ((bytes[offset] & 0x1f) << 6) + (bytes[offset + 1] & 0x3f)
        offset += 2
      } else {
        charCode = ((bytes[offset] & 0x0f) << 12) + ((bytes[offset + 1] & 0x3f) << 6) + (bytes[offset + 2] & 0x3f)
        offset += 3
      }
      array.push(charCode)
    }
    return String.fromCharCode.apply(undefined, array)
  }
}

export const Package = {
  /**
   * Package protocol encode.
   *
   * Pomelo package format:
   * +------+-------------+------------------+
   * | type | body length |       body       |
   * +------+-------------+------------------+
   *
   * Head: 4bytes
   *   0: package type,
   *      1 - handshake,
   *      2 - handshake ack,
   *      3 - heartbeat,
   *      4 - data
   *      5 - kick
   *   1 - 3: big-endian body length
   * Body: body length bytes
   *
   * @param  {Number}    type   package type
   * @param  {ByteArray?} body   body content in bytes
   * @return {ByteArray}        new byte array that contains encode result
   */
  encode(type: PackageType, body?: ByteArray): ByteArray {
    const length = body ? body.length : 0
    const buffer = createByteArray(PKG_HEAD_BYTES + length)
    let index = 0
    buffer[index++] = type & 0xff
    buffer[index++] = (length >> 16) & 0xff
    buffer[index++] = (length >> 8) & 0xff
    buffer[index++] = length & 0xff
    if (body) {
      copyArray(buffer, index, body, 0, length)
    }
    return buffer
  },
  /**
   * Package protocol decode.
   * See encode for package format.
   *
   * @param  {ByteArray} buffer byte array containing package content
   * @return {PackageDataType}    {type: package type, buffer: body byte array}
   */
  decode(buffer: ByteArray): PackageDataType | PackageDataType[] {
    let offset = 0
    const bytes = createByteArrayFromData(buffer)
    let length = 0
    const rs = []
    while (offset < bytes.length) {
      const type: PackageType = bytes[offset++]
      length = ((bytes[offset++]) << 16 | (bytes[offset++]) << 8 | bytes[offset++]) >>> 0
      const body = length ? createByteArray(length) : undefined
      if (body) {
        copyArray(body, 0, bytes, offset, length)
      }
      offset += length
      rs.push({ type, body })
    }
    return rs.length === 1 ? rs[0] : rs
  }
}

export const Message = {
  /**
   * Message protocol encode.
   *
   * @param  {Number} id            message id
   * @param  {MessageType} type          message type
   * @param  {BooleanNum} compressRoute whether compress route
   * @param  {Number|String} route  route code or route string
   * @param  {Buffer} msg           message body bytes
   * @return {Buffer}               encode result
   */
  encode(id: number, type: MessageType, compressRoute: BooleanNum, route: number | string | undefined, msg: ByteArray, compressGzip?: BooleanNum): ByteArray {
    // caculate message max length
    const idBytes = msgHasId(type) ? caculateMsgIdBytes(id) : 0
    let msgLen = MSG_FLAG_BYTES + idBytes

    if (msgHasRoute(type)) {
      if (compressRoute) {
        if (typeof route !== 'number') {
          throw new Error('error flag for number route!')
        }
        msgLen += MSG_ROUTE_CODE_BYTES
      } else {
        msgLen += MSG_ROUTE_LEN_BYTES
        if (route) {
          // @ts-ignore
          route = strencode(route as string)
          if ((route as string).length > 255) {
            throw new Error('route maxlength is overflow')
          }
          msgLen += (route as string).length
        }
      }
    }

    if (msg) {
      msgLen += msg.length
    }

    const buffer = createByteArray(msgLen)
    let offset = 0

    // add flag
    offset = encodeMsgFlag(type, compressRoute, buffer, offset, compressGzip)

    // add message id
    if (msgHasId(type)) {
      offset = encodeMsgId(id, buffer, offset)
    }

    // add route
    if (msgHasRoute(type)) {
      offset = encodeMsgRoute(compressRoute, route as string, buffer, offset)
    }

    // add body
    if (msg) {
      offset = encodeMsgBody(msg, buffer, offset)
    }

    return buffer
  },
  /**
   * Message protocol decode.
   *
   * @param  {ByteArray} buffer message bytes
   * @return {Object}            message object
   */
  decode(buffer: ByteArray): MessageDataType {
    const bytes =  createByteArrayFromData(buffer)
    const bytesLen = bytes.length || bytes.byteLength
    let offset = 0
    let id = 0
    let route

    // parse flag
    const flag = bytes[offset++]
    const compressRoute = flag & MSG_COMPRESS_ROUTE_MASK
    const type = (flag >> 1) & MSG_TYPE_MASK
    const compressGzip = (flag >> 4) & MSG_COMPRESS_GZIP_MASK

    // parse id
    if (msgHasId(type)) {
      let m = 0
      let i = 0
      do {
        // @ts-ignore
        m = parseInt(bytes[offset] as string, 10)
        id += (m & 0x7f) << (7 * i)
        offset++
        i++
      } while (m >= 128)
    }

    // parse route
    if (msgHasRoute(type)) {
      if (compressRoute) {
        route = (bytes[offset++]) << 8 | bytes[offset++]
      } else {
        const routeLen = bytes[offset++]
        if (routeLen) {
          route = createByteArray(routeLen)
          copyArray(route, 0, bytes, offset, routeLen)
          route = strdecode(route)
        } else {
          route = ''
        }
        offset += routeLen
      }
    }

    // parse body
    const bodyLen = bytesLen - offset
    const body = createByteArray(bodyLen)

    copyArray(body, 0, bytes, offset, bodyLen)

    return {
      id,
      type,
      compressRoute,
      compressGzip,
      route,
      body,
    }
  }
}
function copyArray(dest: ByteArray, doffset: number, src: ByteArray, soffset: number, length: number): void {
  if ('function' === typeof (src as Buffer).copy) {
    // Buffer
    (src as Buffer).copy(dest, doffset, soffset, soffset + length)
  } else {
    // Uint8Array
    for (let index = 0; index < length; index++) {
      dest[doffset++] = src[soffset++]
    }
  }
}

function msgHasId(type: MessageType): boolean {
  return type === MessageType.REQUEST || type === MessageType.RESPONSE
}

function msgHasRoute(type: MessageType): boolean {
  return type === MessageType.REQUEST || type === MessageType.NOTIFY ||
    type === MessageType.PUSH
}

function caculateMsgIdBytes(id: number): number {
  let len = 0
  do {
    len += 1
    id >>= 7
  } while (id > 0)
  return len
}

function encodeMsgFlag(type: MessageType, compressRoute: BooleanNum, buffer: ByteArray, offset: number, compressGzip?: BooleanNum): number {
  if (type !== MessageType.REQUEST && type !== MessageType.NOTIFY &&
    type !== MessageType.RESPONSE && type !== MessageType.PUSH) {
    throw new Error('unkonw message type: ' + type)
  }

  buffer[offset] = (type << 1) | (compressRoute ? 1 : 0)

  if (compressGzip) {
    buffer[offset] = buffer[offset] | MSG_COMPRESS_GZIP_ENCODE_MASK
  }

  return offset + MSG_FLAG_BYTES
}

function encodeMsgId(id: number, buffer: ByteArray, offset: number): number {
  do {
    let tmp = id % 128
    const next = Math.floor(id / 128)

    if (next !== 0) {
      tmp = tmp + 128
    }
    buffer[offset++] = tmp

    id = next
  } while (id !== 0)

  return offset
}

function encodeMsgRoute(compressRoute: BooleanNum, route: number | string, buffer: ByteArray, offset: number): number {
  if (compressRoute) {
    if (route > MSG_ROUTE_CODE_MAX) {
      throw new Error('route number is overflow')
    }

    buffer[offset++] = ((route as number) >> 8) & 0xff
    buffer[offset++] = (route as number) & 0xff
  } else {
    if (route) {
      buffer[offset++] = (route as string).length & 0xff
      // @ts-ignore
      copyArray(buffer, offset, route, 0, (route as string).length)
      offset += (route as string).length
    } else {
      buffer[offset++] = 0
    }
  }

  return offset
}

function encodeMsgBody(msg: ByteArray, buffer: ByteArray, offset: number): number {
  copyArray(buffer, offset, msg, 0, msg.length)
  return offset + msg.length
}
