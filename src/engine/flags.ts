// 条件式（FlagExpr、§6.6）の構文解析と評価。eval や Function は使わない。
//
// 文法：
//   expr    := or
//   or      := and ( '||' and )*
//   and     := unary ( '&&' unary )*
//   unary   := '!' unary | compare
//   compare := primary ( ( '==' | '!=' ) primary )?
//   primary := '(' expr ')' | ref | literal
//   ref     := 'flags.' 名前 | 'cond.' 名前 | 'up.' 名前 | 'char'
//   literal := '文字列' | "文字列" | true | false | 数値

export type Ref = { kind: 'ref'; ns: 'flags' | 'cond' | 'up' | 'char'; name: string };
export type Expr =
  | Ref
  | { kind: 'lit'; value: string | number | boolean }
  | { kind: 'not'; expr: Expr }
  | { kind: 'and' | 'or'; left: Expr; right: Expr }
  | { kind: 'eq' | 'ne'; left: Expr; right: Expr };

export interface EvalContext {
  flags: Record<string, unknown>;
  cond: Record<string, string | undefined>;
  up: Record<string, unknown>;
  char: string;
}

export class FlagExprError extends Error {}

type Token =
  | { t: 'op'; v: '==' | '!=' | '&&' | '||' | '!' | '(' | ')' }
  | { t: 'ref'; v: Ref }
  | { t: 'lit'; v: string | number | boolean };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === '==' || two === '!=' || two === '&&' || two === '||') {
      out.push({ t: 'op', v: two });
      i += 2;
      continue;
    }
    if (c === '!' || c === '(' || c === ')') {
      out.push({ t: 'op', v: c });
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      const end = src.indexOf(c, i + 1);
      if (end < 0) throw new FlagExprError(`文字列が閉じていません（${i + 1}文字目）`);
      out.push({ t: 'lit', v: src.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    const num = /^-?\d+(\.\d+)?/.exec(src.slice(i));
    if (num) {
      out.push({ t: 'lit', v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const word = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?/.exec(src.slice(i));
    if (word) {
      const w = word[0];
      i += w.length;
      if (w === 'true' || w === 'false') {
        out.push({ t: 'lit', v: w === 'true' });
        continue;
      }
      if (w === 'char') {
        out.push({ t: 'ref', v: { kind: 'ref', ns: 'char', name: '' } });
        continue;
      }
      const [ns, name] = w.split('.');
      if ((ns === 'flags' || ns === 'cond' || ns === 'up') && name) {
        out.push({ t: 'ref', v: { kind: 'ref', ns, name } });
        continue;
      }
      throw new FlagExprError(`使えない名前です：${w}（flags.／cond.／up.／char のどれかを使う）`);
    }
    throw new FlagExprError(`使えない文字です：${c}（${i + 1}文字目）`);
  }
  return out;
}

export function parseFlagExpr(src: string): Expr {
  const tokens = tokenize(src);
  let p = 0;
  const peek = () => tokens[p];
  const isOp = (v: string) => {
    const tk = peek();
    return tk?.t === 'op' && tk.v === v;
  };

  function primary(): Expr {
    const tk = tokens[p++];
    if (!tk) throw new FlagExprError('式が途中で終わっています');
    if (tk.t === 'op' && tk.v === '(') {
      const e = or();
      if (!isOp(')')) throw new FlagExprError('括弧が閉じていません');
      p++;
      return e;
    }
    if (tk.t === 'ref') return tk.v;
    if (tk.t === 'lit') return { kind: 'lit', value: tk.v };
    throw new FlagExprError(`ここに ${tk.v} は書けません`);
  }
  function compare(): Expr {
    const left = primary();
    if (isOp('==') || isOp('!=')) {
      const op = (tokens[p++] as { v: string }).v;
      const right = primary();
      return { kind: op === '==' ? 'eq' : 'ne', left, right };
    }
    return left;
  }
  function unary(): Expr {
    if (isOp('!')) {
      p++;
      return { kind: 'not', expr: unary() };
    }
    return compare();
  }
  function and(): Expr {
    let left = unary();
    while (isOp('&&')) {
      p++;
      left = { kind: 'and', left, right: unary() };
    }
    return left;
  }
  function or(): Expr {
    let left = and();
    while (isOp('||')) {
      p++;
      left = { kind: 'or', left, right: and() };
    }
    return left;
  }

  if (tokens.length === 0) throw new FlagExprError('式が空です');
  const e = or();
  if (p !== tokens.length) throw new FlagExprError('式の終わりに余分な記述があります');
  return e;
}

function value(e: Expr, ctx: EvalContext): unknown {
  switch (e.kind) {
    case 'lit':
      return e.value;
    case 'ref':
      if (e.ns === 'char') return ctx.char;
      if (e.ns === 'flags') return ctx.flags[e.name];
      if (e.ns === 'cond') return ctx.cond[e.name];
      return ctx.up[e.name];
    default:
      return evalExpr(e, ctx);
  }
}

/** 真偽の判定。未設定（undefined）は false として扱う */
export function evalExpr(e: Expr, ctx: EvalContext): boolean {
  switch (e.kind) {
    case 'lit':
      return Boolean(e.value);
    case 'ref':
      return Boolean(value(e, ctx));
    case 'not':
      return !evalExpr(e.expr, ctx);
    case 'and':
      return evalExpr(e.left, ctx) && evalExpr(e.right, ctx);
    case 'or':
      return evalExpr(e.left, ctx) || evalExpr(e.right, ctx);
    case 'eq':
      return value(e.left, ctx) === value(e.right, ctx);
    case 'ne':
      return value(e.left, ctx) !== value(e.right, ctx);
  }
}

const cache = new Map<string, Expr>();

/** 文字列の式を評価する。式は undefined なら true */
export function check(src: string | undefined, ctx: EvalContext): boolean {
  if (src === undefined) return true;
  let e = cache.get(src);
  if (!e) {
    e = parseFlagExpr(src);
    cache.set(src, e);
  }
  return evalExpr(e, ctx);
}

/** 検証用：式に出てくる参照を列挙する */
export function collectRefs(e: Expr, out: Ref[] = []): Ref[] {
  switch (e.kind) {
    case 'ref':
      out.push(e);
      break;
    case 'not':
      collectRefs(e.expr, out);
      break;
    case 'and':
    case 'or':
    case 'eq':
    case 'ne':
      collectRefs(e.left, out);
      collectRefs(e.right, out);
      break;
  }
  return out;
}

/** 検証用：ref と literal を比べている組を列挙する（cond の選択肢IDの確認に使う） */
export function collectComparisons(e: Expr, out: { ref: Ref; lit: unknown }[] = []): { ref: Ref; lit: unknown }[] {
  if (e.kind === 'eq' || e.kind === 'ne') {
    if (e.left.kind === 'ref' && e.right.kind === 'lit') out.push({ ref: e.left, lit: e.right.value });
    if (e.right.kind === 'ref' && e.left.kind === 'lit') out.push({ ref: e.right, lit: e.left.value });
  }
  if (e.kind === 'not') collectComparisons(e.expr, out);
  if (e.kind === 'and' || e.kind === 'or' || e.kind === 'eq' || e.kind === 'ne') {
    collectComparisons(e.left, out);
    collectComparisons(e.right, out);
  }
  return out;
}
