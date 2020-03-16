import { Application } from '@regax/server'
import { client } from './app/client/client'

async function server(): Promise<void> {
  const gameServer = new Application(
    __dirname,
  )
  await gameServer.start()
}

async function main(): Promise<void> {
  await server()
  await client()
}

main()
