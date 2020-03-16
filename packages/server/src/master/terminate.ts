// tslint:disable:no-any

// fork from egg-cluster/lib/utils/terminate
const awaitEvent = require('await-event')
const pstree = require('ps-tree')
import { delay } from '@regax/common'

export async function terminate(subProcess: any, timeout: number): Promise<void> {
  const pid = subProcess.process ? subProcess.process.pid : subProcess.pid
  const childPids = await getChildPids(pid)
  await Promise.all([
    killProcess(subProcess, timeout),
    killChildren(childPids, timeout),
  ])
}

// kill process, if SIGTERM not work, try SIGKILL
async function killProcess(subProcess: any, timeout: number): Promise<void> {
  subProcess.kill('SIGTERM')
  await Promise.race([
    awaitEvent(subProcess, 'exit'),
    delay(timeout),
  ])
  if (subProcess.killed) return
  // SIGKILL: http://man7.org/linux/man-pages/man7/signal.7.html
  // worker: https://github.com/nodejs/node/blob/master/lib/internal/cluster/worker.js#L22
  // subProcess.kill is wrapped to subProcess.destroy, it will wait to disconnected.
  (subProcess.process || subProcess).kill('SIGKILL')
}

// kill all children processes, if SIGTERM not work, try SIGKILL
async function killChildren(children: number[], timeout: number): Promise<void> {
  if (!children.length) return
  kill(children, 'SIGTERM')

  const start = Date.now()
  // if timeout is 1000, it will check twice.
  const checkInterval = 400
  let unterminated: number[] = []

  while (Date.now() - start < timeout - checkInterval) {
    await delay(checkInterval)
    unterminated = getUnterminatedProcesses(children)
    if (!unterminated.length) return
  }
  kill(unterminated, 'SIGKILL')
}

async function getChildPids(pid: number): Promise<number[]> {
  return new Promise(resolve => {
    pstree(pid, (err: Error, children: any[]) => {
      // if get children error, just ignore it
      if (err) children = []
      resolve(children.map(child => parseInt(child.PID, 10)))
    })
  })
}

function kill(pids: number[], signal: string): void {
  for (const pid of pids) {
    try {
      process.kill(pid, signal)
    } catch (_) {
      // ignore
    }
  }
}

function getUnterminatedProcesses(pids: number[]): number[] {
  return pids.filter(pid => {
    try {
      // success means it's still alive
      process.kill(pid, 0)
      return true
    } catch (err) {
      // error means it's dead
      return false
    }
  })
}
