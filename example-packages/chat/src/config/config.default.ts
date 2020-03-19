import { ApplicationOpts } from '@regax/server'
import * as uuid from 'node-uuid'

export default function configDefault(): ApplicationOpts {
  return {
    component: {
      all: ['my']
    },
    connector: {
      createTraceId: () => uuid.v1().replace(/-/g, ''),
    },
    customLogger: {
      traceLogger: {
        file: 'trace-digest.log',
        consoleLevel: 'NONE',
      },
    },
    master: {
      servers: [
        { serverType: 'connector', sticky: true, clientPort: 8089 },
        { serverType: 'connector', sticky: true, clientPort: 8089 },
        { serverType: 'chat' },
        { serverType: 'chat' },
      ],
    }
  }
}
