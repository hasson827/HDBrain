/**
 * Vanilla typewriter for the hero intro: type text into an element once, then
 * hand off to the next (no delete/loop cycle — this is a static hero). Returns
 * Promises so callers can chain several elements to appear one after another.
 *
 * The cursor blinks a FIXED number of times, not forever — the site's one
 * loop rule (README §8 S3 DoD: "除鱼尾狮 loading 外无循环动画") reserves the
 * only looping animation for the Merlion's water jet. A finite blink still
 * reads as "typing", it just stops once the text is done.
 */
import { prefersReducedMotion } from "./motion.js";

/** Types `text` into `el` one character at a time. Resolves once typing (and
 * `pauseAfter`, if given) finishes. Falls back to setting the final text
 * immediately under reduced-motion — never leaves `el` empty waiting on a
 * timer chain the user has asked not to run. */
export function typeText(el, text, opts = {}) {
  return new Promise((resolve) => {
    if (!el) {
      resolve();
      return;
    }
    if (prefersReducedMotion()) {
      el.textContent = text;
      resolve();
      return;
    }

    const speed = opts.typingSpeed ?? 32;
    el.textContent = "";

    let cursor = null;
    if (opts.showCursor ?? true) {
      cursor = document.createElement("span");
      cursor.className = "text-type-cursor";
      cursor.textContent = opts.cursorCharacter ?? "|";
      el.appendChild(cursor);
    }

    let i = 0;
    function step() {
      if (i < text.length) {
        el.insertBefore(document.createTextNode(text[i]), cursor);
        i++;
        setTimeout(step, speed);
        return;
      }
      const finish = () => {
        cursor?.remove();
        resolve();
      };
      if (cursor) {
        // A few finite blinks, not an infinite loop — see file header.
        cursor.classList.add("text-type-cursor--blink");
        setTimeout(finish, 550 * 3);
      } else {
        finish();
      }
    }
    step();
  });
}

/** Runs `steps` (each a `() => Promise`) strictly one after another. */
export async function runSequence(steps) {
  for (const step of steps) {
    await step();
  }
}
