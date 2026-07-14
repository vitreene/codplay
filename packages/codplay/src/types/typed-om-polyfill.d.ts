/**
 * `typed-om-polyfill` ships a broken package-level type declaration (its
 * bundled `build/index.d.ts` only contains `declare module "index" { ... }`,
 * which never matches the `typed-om-polyfill` import specifier — TS reports
 * the file as "not a module"). This shim declares only the surface actually
 * used in this package; the runtime JS (`build/index.js`) is unaffected and
 * works as published.
 */
declare module 'typed-om-polyfill' {
  export class CSSStyleValue {
    static parse(property: string, cssText: string): CSSStyleValue
  }

  export class CSSUnitValue extends CSSStyleValue {
    readonly value: number
    readonly unit: string
  }
}
