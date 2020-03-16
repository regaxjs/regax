import { ApplicationOpts } from '../api'

export default function config(): ApplicationOpts {
  return {
    logger: {
      consoleLevel: 'WARN',
      buffer: false,
    }
  }
}
