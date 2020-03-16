import * as assert from 'assert'
import * as Protocol from './protocol'
import { PackageType, MessageType, Package, Message } from './protocol'
import { PackageDataType } from './protocol'

describe('protocol', () => {
  describe('String encode and decode', () => {
    it('should be ok to encode and decode Chinese string', () =>  {
      const str = '你好, abc~~~'
      const buf = Protocol.strencode(str)
      assert.ok(buf)
      assert.equal(str, Protocol.strdecode(buf))
    })
  })
  describe('Package encode and decode', () =>  {
    it('should keep the same data after encoding and decoding', () =>  {
      const msg = 'hello world~'
      const buf = Package.encode(PackageType.DATA, Protocol.strencode(msg))
      assert.ok(buf)
      const res = Package.decode(buf) as PackageDataType
      assert.ok(res)
      assert.equal(res.type, PackageType.DATA)
      assert.ok(res.body)
      assert.equal(msg, Protocol.strdecode(res.body as Buffer))
    })

    it('should ok when encoding and decoding package without body', () =>  {
      const buf = Package.encode(PackageType.HANDSHAKE)
      assert.ok(buf)
      const res = Package.decode(buf) as PackageDataType
      assert.ok(res)
      assert.equal(res.type, PackageType.HANDSHAKE)
      assert.ok(!res.body)
    })
  })
  describe('Message encode and decode', () =>  {
    it('should be ok for encoding and decoding request', () =>  {
      const id = 128
      const compress = 0
      const route = 'connector.entryHandler.entry'
      const msg = 'hello world~'
      const buf = Message.encode(id, MessageType.REQUEST, compress, route, Protocol.strencode(msg))
      assert.ok(buf)
      const res = Message.decode(buf)
      assert.ok(res)
      assert.equal(id, res.id)
      assert.equal(res.type, MessageType.REQUEST)
      assert.equal(compress, res.compressRoute)
      assert.equal(route, res.route)
      assert.ok(res.body)
      assert.equal(msg, Protocol.strdecode(res.body))
    })

    it('should be ok for encoding and decoding empty route', () => {
      const id = 256
      const compress = 0
      const route = ''
      const msg = 'hello world~'
      const buf = Message.encode(id, MessageType.REQUEST, compress, route, Protocol.strencode(msg))
      assert.ok(buf)
      const res = Message.decode(buf)
      assert.ok(res)
      assert.equal(id, res.id)
      assert.equal(res.type, MessageType.REQUEST)
      assert.equal(compress, res.compressRoute)
      assert.equal(route, res.route)
      assert.ok(res.body)
      assert.equal(msg, Protocol.strdecode(res.body))
    })

    it('should be ok for encoding and decoding undefined route', () => {
      const n = Math.floor(10000 * Math.random())
      const id = 128 * n
      const compress = 0
      const route = undefined
      const msg = 'hello world~'
      const buf = Message.encode(id, MessageType.REQUEST, compress, route, Protocol.strencode(msg))
      assert.ok(buf)
      const res = Message.decode(buf)
      assert.ok(res)
      assert.equal(id, res.id)
      assert.equal(res.type, MessageType.REQUEST)
      assert.equal(compress, res.compressRoute)
      assert.equal(res.route, '')
      assert.ok(res.body)
      assert.equal(msg, Protocol.strdecode(res.body))
    })

    it('should be ok for encoding and decoding compress route', () => {
      const id = 256
      const compress = 1
      const route = 3
      const msg = 'hello world~'
      const buf = Message.encode(id, MessageType.REQUEST, compress, route, Protocol.strencode(msg))
      assert.ok(buf)
      const res = Message.decode(buf)
      assert.ok(res)
      assert.equal(id, res.id)
      assert.equal(res.type, MessageType.REQUEST)
      assert.equal(compress, res.compressRoute)
      assert.equal(route, res.route)
      assert.ok(res.body)
      assert.equal(msg, Protocol.strdecode(res.body))
    })

    it('should be ok for encoding and decoding mutil-bytes id', () => {
      const id = Math.pow(2, 30)
      const compress = 1
      const route = 3
      const msg = 'hello world~'
      const buf = Message.encode(id, MessageType.REQUEST, compress, route, Protocol.strencode(msg))
      assert.ok(buf)
      const res = Message.decode(buf)
      assert.ok(res)
      assert.equal(id, res.id)
      assert.equal(res.type, MessageType.REQUEST)
      assert.equal(compress, res.compressRoute)
      assert.equal(route, res.route)
      assert.ok(res.body)
      assert.equal(msg, Protocol.strdecode(res.body))
    })

    it('should be ok for encoding and decoding notify', () => {
      const compress = 0
      const route = 'connector.entryHandler.entry'
      const msg = 'hello world~'
      const buf = Message.encode(0, MessageType.NOTIFY, compress,
        route, Protocol.strencode(msg))
      assert.ok(buf)
      const res = Message.decode(buf)
      assert.ok(res)
      assert.equal(res.id, 0) // empty id
      assert.equal(res.type, MessageType.NOTIFY)
      assert.equal(compress, res.compressRoute)
      assert.equal(route, res.route)
      assert.ok(res.body)
      assert.equal(msg, Protocol.strdecode(res.body))
    })

    it('should be ok for encoding and decoding response', () => {
      const id = 1
      const compress = 0
      const msg = 'hello world~'
      const buf = Message.encode(id, MessageType.RESPONSE, compress, undefined, Protocol.strencode(msg))
      assert.ok(buf)
      const res = Message.decode(buf)
      assert.ok(res)
      assert.equal(res.id, id)
      assert.equal(res.type, MessageType.RESPONSE)
      assert.equal(compress, res.compressRoute)
      assert.ok(res.route === undefined)
      assert.ok(res.body)
      assert.equal(msg, Protocol.strdecode(res.body))
    })

    it('should be ok for encoding and decoding push', () => {
      const compress = 0
      const route = 'connector.entryHandler.entry'
      const msg = 'hello world~'
      const buf = Message.encode(0, MessageType.PUSH, compress, route, Protocol.strencode(msg))
      assert.ok(buf)
      const res = Message.decode(buf)
      assert.ok(res)
      assert.equal(res.id, 0) // empty id
      assert.equal(res.type, MessageType.PUSH)
      assert.equal(compress, res.compressRoute)
      assert.equal(route, res.route)
      assert.ok(res.body)
      assert.equal(msg, Protocol.strdecode(res.body))
    })
  })
})
