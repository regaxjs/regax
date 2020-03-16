import { ApplicationOpts } from '../api'

export default function configLocal(): ApplicationOpts {
  return {
    logger: {
      coreLogger: {
        consoleLevel: 'INFO',
      },
    }
  }
}
