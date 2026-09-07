/**
 * node:sqlite 模块类型声明（Node.js 22+ 内置，@types/node 暂未包含）
 */
declare module 'node:sqlite' {
  export interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  export class StatementSync {
    run(...params: any[]): RunResult;
    get(...params: any[]): any;
    all(...params: any[]): any[];
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    transaction(fn: (...args: any[]) => any): (...args: any[]) => any;
    close(): void;
  }
}
