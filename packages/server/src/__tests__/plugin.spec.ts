// tslint:disable:no-any
import * as path from 'path'
import { Application } from '../application'
import * as expect from 'expect'

const assert = require('assert')

describe('plugin', () => {
  it('start app with plugins', async () => {
    const plugins = {
      plugin1: { enable: true, path: path.join(__dirname, 'plugins/plugin1') }
    }
    const app = new Application(
      path.join(__dirname, '../../lib/__tests__/template'),
      'master',
      { loader: { plugins } },
    )
    await app.start()
    assert(app.get('scheduler')) // bultin plugins
    assert(app.get('plugin1'))
    await app.stop()
  })
  it('disable plugin', async () => {
    const plugins = {
      plugin1: { enable: true, path: path.join(__dirname, 'plugins/plugin1') },
      scheduler: { enable: false }
    }
    const app = new Application(
      path.join(__dirname, '../../lib/__tests__/template'),
      'master',
      { loader: { plugins } },
    )
    await app.start()
    expect(() => app.get('scheduler')).toThrowError('No matching bindings')
    assert(app.get('plugin1'))
    await app.stop()
  })
})
