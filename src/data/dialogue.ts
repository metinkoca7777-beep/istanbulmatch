import type { BoosterKind, Special, Speaker } from '../engine/types';

// Hacivat & Karagöz lines. Copied verbatim from tatli-kavga.html.
export const WIN_H = ['Splendid! Simply magnificent!','Bravo, effendi! Order and harmony restored!','What skill, what mastery!'];
export const WIN_K = ['See that, Hacivat? Told you I could!','Pour another tea, let\'s celebrate!','Hooray! The sweets are ours!'];
export const CHAIN_Q = ['Maşallah! Knock on wood!','What a bounty, Hacivat!','Whoa, the pot is boiling over!','Sweets are flying, open an umbrella!'];
export const CHAIN_TXT = ['Super!','Maşallah!','Amazing!','Knock on wood!'];
export const SP_Q: Record<Special, [Speaker, string]> = {
  vh:['H','The ferry is leaving, kindly stand clear of the pier!'], vv:['H','The ferry is leaving, kindly stand clear of the pier!'],
  marti:['K','A dove swooped in and grabbed it!'], mangal:['K','Fire! Run, run!'], nazar:['H','The Sultan\'s crown! Make way, make way!']
};
/** [speaker, "tap a tile" prompt, "none left" line] */
export const BOOST_TXT: Record<Exclude<BoosterKind, 'zar'>, [Speaker, string, string]> = {
  terlik:['K','Where shall I throw it? Tap a tile!','No slippers left! Win a stop to earn another.'],
  oklava:['H','Which column shall the lightning strike? Tap a tile!','No lightning left! Win with three stars to earn more.'],
  supurge:['H','Which row shall we sweep? Tap a tile!','No brooms left! Win with three stars to earn more.']
};
