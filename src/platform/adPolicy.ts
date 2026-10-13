// When ads may be shown. Pure logic (no DOM, no SDK) so it can be unit-tested.
// Principle: the player chooses rewarded ads; interstitials are rare and never interrupt play.

export const AD_RULES = {
  /** No interstitials until the player has finished this many level attempts in total. */
  interstitialAfterAttempts: 4,
  /** At most one interstitial every N level ends (wins or losses). */
  interstitialEvery: 3,
  /** Minimum seconds between two interstitials. */
  interstitialGapSec: 180,
  /** No interstitial within this many seconds after a rewarded ad. */
  afterRewardedSec: 90,
  /** Rewarded ads for booster refills per calendar day. */
  boosterRefillsPerDay: 5,
} as const;

export interface AdState {
  /** Level attempts finished (won or lost), lifetime. */
  attempts: number;
  /** Level ends since the last interstitial. */
  sinceInterstitial: number;
  lastInterstitialAt: number;
  lastRewardedAt: number;
  /** yyyy-mm-dd of `refillsToday`. */
  day: string;
  refillsToday: number;
}

export const freshAdState = (): AdState => ({ attempts: 0, sinceInterstitial: 0, lastInterstitialAt: 0, lastRewardedAt: 0, day: '', refillsToday: 0 });

const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);

/** Call when a level ends (win or lose). */
export function noteLevelEnd(s: AdState){ s.attempts++; s.sinceInterstitial++; }

/** Should an interstitial be shown at this natural break? (Does not change state.) */
export function interstitialDue(s: AdState, now: number){
  return s.attempts >= AD_RULES.interstitialAfterAttempts
    && s.sinceInterstitial >= AD_RULES.interstitialEvery
    && now - s.lastInterstitialAt >= AD_RULES.interstitialGapSec*1000
    && now - s.lastRewardedAt >= AD_RULES.afterRewardedSec*1000;
}
export function noteInterstitial(s: AdState, now: number){ s.sinceInterstitial = 0; s.lastInterstitialAt = now; }

/** How many booster refills by ad are left today. */
export function refillsLeft(s: AdState, now: number){
  return dayOf(now) === s.day ? Math.max(0, AD_RULES.boosterRefillsPerDay - s.refillsToday) : AD_RULES.boosterRefillsPerDay;
}
export function noteRewarded(s: AdState, now: number, refill: boolean){
  s.lastRewardedAt = now;
  if (refill){ const d = dayOf(now); if (d !== s.day){ s.day = d; s.refillsToday = 0; } s.refillsToday++; }
}
