/**
 * A tiny, pure tone-mark → tone-digit reader over the DISPLAY (tone-mark)
 * pinyin form the real `src/sidecars/zh` sidecar's wire payload already
 * carries (`src/sidecars/zh/app/pinyin.py`'s `display()` converts its
 * internal tone3 canon to tone marks before it ever reaches the wire — see
 * `gate.py`'s `_payload()`). This is the TS-side mirror of that sidecar's
 * `tone_of()`, operating on the tone-MARK form rather than tone3, because
 * `gate.ts` never sees tone3 — only the already-displayed wire strings.
 *
 * Used to derive the tone sub-track (design §3.1 dim 3, §3.5) — stored
 * separately from the segmental pinyin body so the character-borne
 * late-tone-state cue can still paint a tone after the segmental ruby has
 * faded (a tone mark cannot outlive its vowel).
 */

const TONE1 = "āēīōūǖĀĒĪŌŪǕ"; // macron
const TONE2 = "áéíóúǘÁÉÍÓÚǗ"; // acute
const TONE3 = "ǎěǐǒǔǚǍĚǏǑǓǙ"; // caron
const TONE4 = "àèìòùǜÀÈÌÒÙǛ"; // grave

/** Tone digit (1–4) of a tone-mark pinyin syllable, or 5 (neutral) when no
 * diacritic is present (e.g. `de`, `le`, `ma`, `men`, `zi`). */
export function toneOfDisplaySyllable(syllable: string): 1 | 2 | 3 | 4 | 5 {
  for (const ch of syllable) {
    if (TONE1.includes(ch)) return 1;
    if (TONE2.includes(ch)) return 2;
    if (TONE3.includes(ch)) return 3;
    if (TONE4.includes(ch)) return 4;
  }
  return 5;
}
