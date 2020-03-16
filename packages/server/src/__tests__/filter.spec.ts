// tslint:disable:no-any
import { TimeoutFilter, ApplicationOpts } from '../'
import { createTestApp } from './testUtil'

// const assert = require('assert')

describe('filter', () => {
  it('add filters', async () => {
    const configs: ApplicationOpts = {
      filters: {
        timeout: TimeoutFilter
      },
      filterConfigs: {
        timeout: {
          maxSize: 10,
        }
      }
    }
    const app = createTestApp('connector')
    app.setConfig(configs)
    await app.start()
    // app.get('router').localRouter
    await app.stop()
  })
})
