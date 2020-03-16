import { Application, ApplicationEnv, ApplicationOpts } from '../api'
import { WSConnector } from '../connector/wsConnector'
import { UDPConnector } from '../connector/udpConnector'
import { TCPStickyServer } from '../connector/tcpStickyServer'
import { UDPStickyServer } from '../connector/udpStickyServer'

export default function configDefault(app: Application): ApplicationOpts {
  return {
    component: {
      master: [ 'master', 'rpc'],
      agent: [ 'agent'],
      frontend: [ 'session', 'backendSession', 'channel', 'rpc', 'router', 'connector', 'connection', 'taskManager', 'pushScheduler'],
      backend: [ 'backendSession', 'channel', 'rpc', 'router', 'connection'],
      all: ['messenger'],
    },
    connectorRegistries: {
      ws: WSConnector,
      udp: UDPConnector,
    },
    stickyServerRegistries: {
      ws: TCPStickyServer,
      tcp: TCPStickyServer,
      udp: UDPStickyServer,
    },
    /**
     * logger options
     * @property {String} dir - directory of log files
     * @property {String} encoding - log file encoding, defaults to utf8
     * @property {String} level - default log level, could be: DEBUG, INFO, WARN, ERROR or NONE, defaults to INFO in production
     * @property {String} consoleLevel - log level of stdout, defaults to INFO in local serverEnv, defaults to WARN in unittest, defaults to NONE elsewise
     * @property {Boolean} disableConsoleAfterReady - disable logger console after app ready. defaults to `false` on local and unittest env, others is `true`.
     * @property {Boolean} outputJSON - log as JSON or not, defaults to false
     * @property {Boolean} buffer - if enabled, flush logs to disk at a certain frequency to improve performance, defaults to true
     * @property {String} errorLogName - file name of errorLogger
     * @property {String} coreLogName - file name of coreLogger
     * @property {String} agentLogName - file name of agent worker log
     * @property {Object} coreLogger - custom config of coreLogger
     */
    logger: {
      type: app.serverType,
      env: app.env,
      dir: app.getFilePath('logs'),
      encoding: 'utf8',
      level: 'INFO',
      consoleLevel: 'INFO',
      disableConsoleAfterReady: app.env !== ApplicationEnv.local && app.env !== ApplicationEnv.unittest,
      outputJSON: false,
      buffer: true,
      appLogName: 'regax-app.log',
      agentLogName: 'regax-agent.log',
      coreLogName: 'regax-core.log',
      errorLogName: 'common-error.log',
      coreLogger: {},
      allowDebugAtProd: false,
    },
    /**
     * logrotator options
     * @property {Array} filesRotateByHour - list of files that will be rotated by hour
     * @property {Array} filesRotateBySize - list of files that will be rotated by size
     * @property {Number} maxFileSize - Max file size to judge if any file need rotate
     * @property {Number} maxFiles - pieces rotate by size
     * @property {Number} maxDays - keep max days log files, default is `31`. Set `0` to keep all logs.
     * @property {Number} rotateDuration - time interval to judge if any file need rotate
     * @property {Number} maxDays - keep max days log files
     */
    logrotator: {
      // for rotate_by_hour
      filesRotateByHour: undefined,
      hourDelimiter: '-',
      // for rotate_by_size
      filesRotateBySize: undefined,
      maxFileSize: 50 * 1024 * 1024,
      maxFiles: 10,
      rotateDuration: 60000,
      // for clean_log
      maxDays: 31,
    }
  }
}
