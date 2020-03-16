// tslint:disable:no-any

export type MaybePromise<T> = T | Promise<T> | PromiseLike<T>

export type MaybeArray<T> = T | T[]

export type Deferred<T> = {
  [P in keyof T]: Promise<T[P]>
}

export type Mutable<T> = { -readonly [P in keyof T]: T[P] }

export interface PlainObject { [key: string]: PlainObject | PlainData | undefined }

export type PlainData = string | number | boolean | ObjectOf<any> | any[]

export interface ObjectOf<T> { [key: string]: T }

export type Fn<T = any, arg1 = any, arg2 = any, arg3 = any, args = any> = (arg1?: arg1, arg2?: arg1, arg3?: arg3, ...args: args[]) => T
