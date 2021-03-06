// tslint:disable:no-any
// Fork from: https://github.com/phosphorjs/phosphor/blob/master/packages/coreutils/src/promise.ts
/**
 * A class which wraps a promise into a delegate object.
 *
 * #### Notes
 * This class is useful when the logic to resolve or reject a promise
 * cannot be defined at the point where the promise is created.
 */
export
class PromiseDelegate<T> {
  /**
   * Construct a new promise delegate.
   */
  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this._resolve = resolve
      this._reject = reject
    })
  }

  /**
   * The promise wrapped by the delegate.
   */
  readonly promise: Promise<T>

  /**
   * Resolve the wrapped promise with the given value.
   *
   * @param value - The value to use for resolving the promise.
   */
  resolve(value?: T | PromiseLike<T>): void {
    const resolve = this._resolve
    resolve(value)
  }

  /**
   * Reject the wrapped promise with the given value.
   *
   * @reason - The reason for rejecting the promise.
   */
  reject(reason?: any): void {
    const reject = this._reject
    reject(reason)
  }

  private _resolve: (value?: T | PromiseLike<T>) => void
  private _reject: (reason?: any) => void
}
