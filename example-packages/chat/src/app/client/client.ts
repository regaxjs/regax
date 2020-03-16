// tslint:disable:no-any
import * as ws from 'ws'
import { Client } from '@regax/client-websocket'

export async function client(): Promise<void> {
  const c1 = new Client({ url: 'ws://127.0.0.1:8089', reconnect: true, WebSocket: ws })
  const c2 = new Client({ url: 'ws://127.0.0.1:8089', reconnect: true, WebSocket: ws })
  await c1.connect()
  await c2.connect()
  // 监听房间变化
  c1.on('onChat', (d: any) => {
    console.log('>>>> client1 get message: ', d)
  })
  c2.on('onChat', (d: any) => {
    console.log('>>>> client2 get message: ', d)
  })
  // c1进入房间1
  await c1.request('connector.user.enter', { rid: 'room1', username: 'client1' })
  console.log('client1 enter the room')
  await c2.request('connector.user.enter', { rid: 'room1', username: 'client2' })
  console.log('client2 enter the room')
  // 发送消息
  c1.request('chat.chat.send', { target: '*', content: 'hello world' })
  console.log('client1 send message to all: hello world')
  c2.request('chat.chat.send', { target: '*', content: 'hello world' })
  console.log('client2 send message to all: hello world')
  c2.request('chat.chat.send', { target: 'client1', content: 'hi, client1' })
  console.log('client2 send message to client1: hi, client1')
}
