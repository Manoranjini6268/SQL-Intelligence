declare module 'node-sql-parser' {
  export interface Option {
    database?: string;
    type?: string;
  }

  export class Parser {
    astify(sql: string, options?: Option): unknown;
    sqlify(ast: unknown, options?: Option): string;
    tableList(sql: string, options?: Option): string[];
    columnList(sql: string, options?: Option): string[];
    parse(sql: string, options?: Option): { ast: unknown };
  }
}
