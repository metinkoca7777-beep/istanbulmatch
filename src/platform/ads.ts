import { Capacitor } from '@capacitor/core';
import { AdMob, AdmobConsentStatus, MaxAdContentRating, RewardAdPluginEvents } from '@capacitor-community/admob';
import { getMixer } from '../audio/mixer';
import { freshAdState, interstitialDue, noteInterstitial, noteLevelEnd, noteRewarded, refillsLeft, type AdState } from './adPolicy';

// AdMob ad units. Google's official test units are the default; real units come from
// VITE_ADMOB_REWARDED_ID / VITE_ADMOB_INTERSTITIAL_ID at build time (see docs/ANDROID.md).
const TEST_UNITS = { rewarded: 'ca-app-pub-3940256099942544/5224354917', interstitial: 'ca-app-pub-3940256099942544/1033173712' };
const UNITS = {
  rewarded: import.meta.env.VITE_ADMOB_REWARDED_ID || TEST_UNITS.rewarded,
  interstitial: import.meta.env.VITE_ADMOB_INTERSTITIAL_ID || TEST_UNITS.interstitial,
};
const USING_TEST_UNITS = UNITS.rewarded === TEST_UNITS.rewarded;
/** Your own phones (hashed device ids from logcat), so real ad units serve test ads to them. */
const TEST_DEVICES = String(import.meta.env.VITE_ADMOB_TEST_DEVICES || '').split(',').map(s => s.trim()).filter(Boolean);

const native = Capacitor.isNativePlatform();
/**
 * Real ads only exist in the Android app. On the public website there are no ads at all; the labelled
 * stand-in is only for dev and the demo build (VITE_WEB_AD_PREVIEW=1).
 */
export const adsEnabled = native || import.meta.env.DEV || import.meta.env.VITE_WEB_AD_PREVIEW === '1';
const KEY = 'istanbul-match-ads';

export type RewardResult = 'rewarded' | 'skipped' | 'unavailable';

let state: AdState = freshAdState();
try { state = { ...state, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) {}
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };

let ready = false;            // SDK initialised and consent allows ads (native)
let privacyRequired = false;  // show a "Privacy" entry point (GDPR)
let showing = false;          // a full-screen ad is on screen
let rewardedLoaded = false, interstitialLoaded = false, earned = false;

/** Last thing the ad SDK told us, for the hidden diagnostics line on the pause card. */
let lastStatus = native ? 'starting' : (adsEnabled ? 'web preview' : 'off');
const noteError = (where: string, e: unknown) => {
  const err = e as { code?: string | number; message?: string } | undefined;
  const code = err?.code !== undefined ? ` ${err.code}` : '';
  // AdMob load error 3 = "no fill": usually a new account/app that AdMob has not approved yet.
  lastStatus = `${where} failed${code}: ${String(err?.message || e).slice(0, 120)}`;
};
/** One-line ad status: SDK state, which ad units are in use and the last error. */
export const adStatus = () => `${native ? 'native' : 'web'} · ${USING_TEST_UNITS ? 'test units' : 'live units'} · ready=${ready} · rewarded=${rewardedLoaded ? 'loaded' : 'none'} · ${lastStatus}`;

/** True while a full-screen ad covers the game (the app may look "backgrounded"). */
export const adShowing = () => showing;

function pauseAudio(on: boolean){
  const m = getMixer(); if (!m) return;
  (on ? m.ac.suspend() : m.ac.resume()).catch(() => {});
}

const preloadRewarded = () => AdMob.prepareRewardVideoAd({ adId: UNITS.rewarded, isTesting: USING_TEST_UNITS })
  .then(() => { rewardedLoaded = true; lastStatus = 'rewarded loaded'; }).catch(e => { rewardedLoaded = false; noteError('rewarded load', e); });
const preloadInterstitial = () => AdMob.prepareInterstitial({ adId: UNITS.interstitial, isTesting: USING_TEST_UNITS })
  .then(() => { interstitialLoaded = true; }).catch(e => { interstitialLoaded = false; noteError('interstitial load', e); });

/** Consent (UMP) first, then the SDK, then preload. Safe to call once at start-up. */
export async function initAds(){
  if (!native){ ready = adsEnabled; return; }
  try {
    let info = await AdMob.requestConsentInfo();
    if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) info = await AdMob.showConsentForm();
    privacyRequired = String(info.privacyOptionsRequirementStatus) === 'REQUIRED';
    if (!info.canRequestAds){ lastStatus = `consent ${info.status}: ads not allowed`; return; }
    await AdMob.initialize({
      tagForChildDirectedTreatment: false, maxAdContentRating: MaxAdContentRating.ParentalGuidance,
      testingDevices: TEST_DEVICES, initializeForTesting: TEST_DEVICES.length > 0,
    });
    AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { earned = true; });
    ready = true; lastStatus = 'initialised';
    preloadRewarded(); preloadInterstitial();
  } catch (e) { ready = false; noteError('init', e); }
}

/** Whether the pause card should offer "Privacy settings" (required in the EEA/UK). */
export const privacyOptionsRequired = () => native && privacyRequired;
export async function showPrivacyOptions(){ try { await AdMob.showPrivacyOptionsForm(); } catch (e) {} }

export const refillsAvailable = () => refillsLeft(state, Date.now());

/**
 * A rewarded ad the player asked for. 'unavailable' = no ad could be loaded (offline, no fill, no consent).
 * The callers still give the reward when no ad is available, so a missing ad never blocks the player;
 * a booster refill given that way still counts toward the daily cap.
 */
export async function showRewarded(kind: 'moves' | 'refill'): Promise<RewardResult> {
  let result: RewardResult = 'unavailable';
  if (!ready){ /* SDK not initialised or no consent: see adStatus() */ }
  else if (native){
    if (!rewardedLoaded){ await Promise.race([preloadRewarded(), new Promise(r => setTimeout(r, 6000))]); }
    if (rewardedLoaded){
      earned = false; showing = true; rewardedLoaded = false; pauseAudio(true);
      try {
        const item = await AdMob.showRewardVideoAd();
        result = earned || (item && item.amount > 0) ? 'rewarded' : 'skipped';
      } catch (e) { result = 'unavailable'; noteError('rewarded show', e); }
      showing = false; pauseAudio(false);
      preloadRewarded();
    }
  } else {
    result = await webPreview('rewarded');
  }
  if (result !== 'skipped'){ noteRewarded(state, Date.now(), kind === 'refill'); persist(); }
  return result;
}

/** Call once per finished level attempt (win or lose). */
export function levelEnded(){ noteLevelEnd(state); persist(); }

/** At a natural break (leaving a win/lose card): shows an interstitial if the rules allow it. */
export async function maybeInterstitial(){
  const now = Date.now();
  if (!ready || !interstitialDue(state, now)) return;
  if (native){
    if (!interstitialLoaded) return;
    showing = true; interstitialLoaded = false; pauseAudio(true);
    try { await AdMob.showInterstitial(); noteInterstitial(state, now); } catch (e) { noteError('interstitial show', e); }
    showing = false; pauseAudio(false);
    preloadInterstitial();
  } else {
    await webPreview('interstitial'); noteInterstitial(state, now);
  }
  persist();
}

/**
 * Web builds (browser demo) have no ad SDK: a clearly labelled stand-in shows where the ad
 * would play, so the flow can be tried end to end.
 */
function webPreview(kind: 'rewarded' | 'interstitial'): Promise<RewardResult> {
  return new Promise(resolve => {
    const secs = kind === 'rewarded' ? 5 : 3;
    const el = document.createElement('div');
    el.className = 'adPreview';
    el.innerHTML = `<div class="adBox"><small>${kind === 'rewarded' ? 'Rewarded ad' : 'Ad'} · preview</small><b>Your ad plays here</b><span>On Android this is a real AdMob ${kind} ad.</span><i id="adCount">${secs}</i><button class="btn alt" id="adClose">${kind === 'rewarded' ? 'Skip (no reward)' : 'Close'}</button></div>`;
    document.body.append(el);
    pauseAudio(true); showing = true;
    let left = secs;
    const done = (r: RewardResult) => { clearInterval(t); el.remove(); pauseAudio(false); showing = false; resolve(r); };
    const t = setInterval(() => {
      left--; const c = el.querySelector('#adCount'); if (c) c.textContent = String(Math.max(0, left));
      if (left <= 0) done(kind === 'rewarded' ? 'rewarded' : 'skipped');
    }, 1000);
    el.querySelector<HTMLButtonElement>('#adClose')!.onclick = () => done('skipped');
  });
}
