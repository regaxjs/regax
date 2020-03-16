// tslint:disable:no-any

export class RegaxError extends Error {
  code?: string | number
  static create(e: string | Error, code?: string | number): RegaxError {
    let error: RegaxError
    if (typeof e === 'string') {
      error = new RegaxError(e)
    } else {
      error = new RegaxError(e.message)
      error.stack = e.stack
      Object.assign(error, e)
    }
    error.code = code
    return error
  }
  static toJSON(e: Error): { message: string, stack?: string, code?: string | number } {
    return {
      message: e.message,
      stack: e.stack,
      code: (e as any).code
    }
  }
}

export enum ErrorCode {
  CONTROLLER_FAIL = 'CONTROLLER_FAIL',
  RPC_FAIL = 'RPC_FAIL',
  TIMEOUT = 'TIMEOUT',
}
