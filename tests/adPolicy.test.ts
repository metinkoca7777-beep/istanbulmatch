import { describe, expect, it } from 'vitest';
import { AD_RULES, freshAdState, interstitialDue, noteInterstitial, noteLevelEnd, noteRewarded, refillsLeft } from '../src/platform/adPolicy';

const T0 = Date.UTC(2026, 9, 13, 10, 0, 0);
const sec = (n: number) => n*1000;

describe('interstitials', () => {
  it('never show during the first level attempts', () => {
    const s = freshAdState();
    for (let i = 0; i < AD_RULES.interstitialAfterAttempts - 1; i++){ noteLevelEnd(s); expect(interstitialDue(s, T0 + sec(1000))).toBe(false); }
    noteLevelEnd(s);
    expect(interstitialDue(s, T0 + sec(1000))).toBe(true);
  });
  it('show at most every N level ends and with a minimum gap', () => {
    const s = freshAdState();
    for (let i = 0; i < 4; i++) noteLevelEnd(s);
    noteInterstitial(s, T0);
    noteLevelEnd(s); noteLevelEnd(s);
    expect(interstitialDue(s, T0 + sec(1000))).toBe(false); // only 2 level ends since
    noteLevelEnd(s);
    expect(interstitialDue(s, T0 + sec(60))).toBe(false); // too soon
    expect(interstitialDue(s, T0 + sec(AD_RULES.interstitialGapSec))).toBe(true);
  });
  it('do not follow a rewarded ad too closely', () => {
    const s = freshAdState();
    for (let i = 0; i < 6; i++) noteLevelEnd(s);
    noteRewarded(s, T0, false);
    expect(interstitialDue(s, T0 + sec(30))).toBe(false);
    expect(interstitialDue(s, T0 + sec(AD_RULES.afterRewardedSec))).toBe(true);
  });
});

describe('booster refills', () => {
  it('are capped per day and reset the next day', () => {
    const s = freshAdState();
    expect(refillsLeft(s, T0)).toBe(AD_RULES.boosterRefillsPerDay);
    for (let i = 0; i < AD_RULES.boosterRefillsPerDay; i++) noteRewarded(s, T0 + i, true);
    expect(refillsLeft(s, T0 + sec(10))).toBe(0);
    expect(refillsLeft(s, T0 + sec(24*3600))).toBe(AD_RULES.boosterRefillsPerDay);
    noteRewarded(s, T0 + sec(24*3600), true);
    expect(refillsLeft(s, T0 + sec(24*3600 + 5))).toBe(AD_RULES.boosterRefillsPerDay - 1);
  });
  it('a "+5 moves" ad does not use up booster refills', () => {
    const s = freshAdState();
    noteRewarded(s, T0, false);
    expect(refillsLeft(s, T0)).toBe(AD_RULES.boosterRefillsPerDay);
  });
});
