import { describe, expect, it } from 'vitest';
import { check, FlagExprError, parseFlagExpr } from '../../src/engine/flags';

const ctx = {
  flags: { method: 'withdrawal', knows: true, n: 3 },
  cond: { sexEducation: 'taught' },
  up: { economy: 'hardship', familyCare: true },
  char: 'kei',
};

describe('条件式（§6.6）', () => {
  it.each([
    ["cond.sexEducation == 'taught'", true],
    ["cond.sexEducation == 'notTaught'", false],
    ["cond.sexEducation == 'taught' || flags.searchedWithdrawal == true", true],
    ["flags.method == 'withdrawal' && flags.knows != true", false],
    ['!flags.knows', false],
    ['!flags.unknownFlag', true],
    ['flags.unknownFlag != true', true],
    ['flags.n == 3', true],
    ["char == 'kei' && up.familyCare == true", true],
    ["(up.economy == 'middle' || up.economy == 'hardship') && !(char == 'yu')", true],
    ['true && !false', true],
    ['up.familyCare', true],
  ])('%s → %s', (src, want) => {
    expect(check(src, ctx)).toBe(want);
  });

  it('&& は || より強く結びつく', () => {
    expect(check('true || false && false', ctx)).toBe(true);
    expect(check('(true || false) && false', ctx)).toBe(false);
  });

  it.each(['', 'flags.', 'foo == 1', "cond.x == 'a", '(true', 'true )', 'true &&', 'flags.a = 1', 'window.alert'])(
    '構文エラー：%s',
    (src) => {
      expect(() => parseFlagExpr(src)).toThrow(FlagExprError);
    },
  );
});
