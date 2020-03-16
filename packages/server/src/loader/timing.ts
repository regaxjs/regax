const assert = require('assert')

interface TimingRecord {
  desc: string,
  start: number,
  end?: number,
  duration?: number,
  pid: number,
  index: number,
}
export class Timing {

  protected recordMap: Map<string, TimingRecord> = new Map
  protected recordList: TimingRecord[] = []
  start(desc: string): void {
    if (!desc) return
    if (this.recordMap.has(desc)) this.end(desc)
    const start = Date.now()
    const record = {
      desc,
      start,
      end: undefined,
      duration: undefined,
      pid: process.pid,
      index: this.recordList.length,
    }
    this.recordMap.set(desc, record)
    this.recordList.push(record)
  }

  end(desc: string): void {
    if (!desc) return
    assert(this.recordMap.has(desc), `should run timing.start('${desc}') first`)

    const record = this.recordMap.get(desc)!
    record.end = Date.now()
    record.duration = record.end - record.start
  }

  toJSON(): TimingRecord[] {
    return this.recordList
  }
}
