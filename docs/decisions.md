# Decisions: the detail behind CLAUDE.md's rules

What was decided with the owner, feature by feature, and why. CLAUDE.md keeps the rules short and
points here; **read the section for a feature before changing it**, and keep it true when the
feature changes.

## Sound
`Sound.mode` is `coach` | `video` | `off`. Coach is the default at the start of every workout/preview; Video lasts only for that session. On a demo with no voice, the coach speaks even in Video mode. Unmuting with YouTube's own speaker switches to Video. The app never mutes a video on a guess.

## Demo variants
When a demo is a different variant (pigeon vs figure-4, floor vs bench, sumo vs goblet…), give that video entry its own `name`/`key`/`cues`/`stop`; the screen and the coach then use the active demo's text (`variant(key, vi)`), switching demos restarts the coaching, and the choice is remembered per exercise (`store "demos"`). Plain alternates showing the same movement share the exercise's text.

## Quick facts
Level · equipment · joints it's easy on / loads. A preview shows each beside what it's about (level leads the top line, equipment beside the target, joints just under the safety line); the rest screen shows them on one line under "Up next"; not on the coaching screen, which is full in landscape. A joint is never both "easy on" and "loads" (self-test).

## Where you are, without sound
The screen alone must always say which set you're on (the owner once read three sets of one exercise as a bug, with the coach off). A set tracker sits beside the target (holds: beside the countdown, above Hold / Get in position): a bar per set (done, now, to come) and "Set 2 of 3" / "Last set"; the top line no longer repeats the set. A rest before another set of the same exercise is headed "Next: set 2 of 3" / "Next: last set" ("Up next" before a new exercise). During a rest the next demo plays muted and hidden behind a dimmed still of it with the same heading and the name ("Tap to watch the demo" lifts it); when the set starts the cover lifts and the demo restarts from the top with its sound (`Video.rest` / `endRest`; it keeps playing underneath because a phone may refuse to start a video with sound without a tap). The self-test checks the tracker, the heading and the cover on every step of two sessions.

## Player screen
Hierarchy: exercise name > target pill (holds: big countdown) > Focus card > current cue (follows the voice) > quiet amber safety line; Done is the biggest button. Must fit an iPhone in landscape (~852×320 usable) and portrait. Panel = scrollable `.panel-body` + `.controls` pinned to the bottom; never let flex squeeze content (`flex-shrink:0` on body children) — trim copy/spacing instead. The top bar stays inside the safe area (Dynamic Island). The Home Screen app uses an opaque status bar (`apple-mobile-web-app-status-bar-style: black`): with `black-translucent`, iOS 26 launches the page scrolled to −62 pt and later lets content slide under the status bar.

Buttons: ‹ (previous step) appears only when there's a step to go back to. ✕ closes a preview or a finished workout at once; mid-workout it opens the app's usual bottom sheet ("Leave this workout?", Keep going / Leave workout) with the clock paused, rather than a two-tap button (the owner found the red "Tap again to exit" dated). A "Skip warm-up" button sits in the button row between ‹ and Done during the warm-up (never in previews; Done stays the biggest) and jumps to the first main exercise (a quiet link at the end of the top line was too easy to miss).

## Coach pacing
In the rest before a main exercise's first set (rests of 30 s or more), after "Next up, …" the coach says what it works: "This one works your quads and glutes." (`SAY.works`; stretches: "stretches your"). Set 1: name and target, the cues spread through the set, then the Focus last as "Remember, …" (never before the movement has been described). Cues never restate the Focus — each cue adds something new. Set 2 (or the second side): the Focus is the one reminder; later sets rotate other cues. Holds spread cues then the Focus, before "Ten seconds left". Rests say what's next and "Ten seconds. Get ready."

## Muscle map
Main muscles solid `#3ddc97`, helping muscles finely striped green (`#fig-help`: 45°, period 16 / stripe 7 figure units; two shades of green were too hard to tell apart), body `#4b5260`. The day card and finish screen key them as two groups: a small "MAIN" / "HELPING" label, the names in neutral text, and a 6px bar drawn like the muscles (solid / the same diagonal stripes). Muscle names are capitalised. The figure swap is a small ⇄ icon centred under the figures, no text. Badges frame themselves on the main muscles (view with the most main-muscle area). Rows: badge + "amount · main muscles"; player: main muscles in the set line and a badge beside the name/target (portrait: beside the target, name keeps the full width); rest: badge beside "Up next"; day summary card and finish screen: full front and back figures. Real muscle names on screen, never simplified. The male/female figure is switched by a quiet "Show female/male figure" link under the day card's figures (`store "figure"`): only where the figures are visible, never as a prominent control (it looked like it changed the workout) and not on the home page (meaningless before you've seen a figure) or the player; never in the plan link, never asked by the AI.

Day card key: the MAIN/HELPING text starts at a fixed offset (about ear level of the figures), not centred, so it doesn't jump with its length; long lists end "and N more" above the feet.

## Navigation, Plans and Exercises
A bottom tab bar (My week · Plans · Exercises) on top-level screens only; plan previews, the day screen and the player have no tabs. Tapping an exercise anywhere plays its preview straight away (no detail page: the owner found it an unnecessary step) and closing it returns there. My week lists today first; with no plan yet it says so and the app opens on Plans.

Plans: goal chips (Lose weight · Get stronger · Move better), "Your plans" (ones made with AI) above "Ready-made plans", all as the same photo card, modelled on the Home Workout app's featured card the owner likes: the photo across the top fading into a dark base, then one statement: a big "3 days a week", the name, a white level pill ("Made with AI" for your own) with minutes and kit, and a quiet › (the whole card opens the plan; the owner found a full-width "View plan" button on every card unnecessary). No goal colours (owner: nobody knows what they'd mean). Photos are free Unsplash photos (bright, relatable people, not hardcore gym shots), saved in `photos/` by `tools/photos.mjs` from `photo` in programs.js and served by the site itself (your own plans get `OWN_PHOTOS` by the most kit they use, or stretching), credited in the README by `tools/credits.mjs`. On a landscape phone the plan cards lie on their side (photo left, text right). A "create your own with AI" card at the end plus "+ Create" in the header.

A plan's preview opens on its photo with the card's "3 days a week" and the title, then the level pill with minutes and kit, then its days; a plan's days open its day screen (back returns to the plan). Your own plans (not the current one) can be removed from "Your plans" there. A preview never changes your week; "Start this plan" does and asks first if you have one (switching back: your own plans are under "Your plans" on Plans, ready-made ones in their list).

Exercises: search, equipment chips (Bodyweight · Bands · Dumbbells · Gym; none selected = all; a chip also shows what needs less kit) and body-area chips (areas and exercises A to Z), with a line saying exactly what's shown.

## My week
Opens on the plan's photo (the same one its card uses) with the title and subtitle on it, then the days, then (on a phone in a browser) "Add to your Home Screen", then one "Change or share this plan" row that opens a sheet: Change it with AI · Share (the phone's share sheet; copies the link where there isn't one) · Switch plan (opens Plans).

With no plan it fills the screen: a photo (the Start Here plan's) with "Your week starts here", a line and "Demo videos · A coach voice · Timers", then Browse plans / Create your own with AI as full-width buttons at the bottom, above the tabs, where a thumb reaches (side by side in landscape and on wide screens). The owner found buttons at the top of an empty page ugly and a stretch.

The code: one quiet grey line, "Want to make changes to the app? The code is on GitHub" (links to the repo), at the end of My week (beside Diagnostics) and of Plans (where newcomers land). Deliberately inconspicuous: it's for someone who'd like to make their own version.

## Day screen
The warm-up and cool-down are optional sections whose header carries the switch; switched off, their exercises aren't listed. Day kinds: workout; stretch (only stretches: section "cool", 10 s rests); activity (one activity, e.g. `sport` for the owner's football: warm-up and cool-down buttons, no player).

## Nimble screens
Don't rebuild a screen to change one thing. The warm-up/cool-down switches show or hide their list; the figure swap redraws only the figure card; Plans and the Exercises list rebuild only when what they show has changed. Images paint in the first frame (no async decoding or fade-ins; the first plan cards load eagerly), on a calm placeholder colour while loading. The self-test checks the rows survive the switches.

## Home Screen
On a phone in a browser, My week shows "Add to your Home Screen" above "Change or share this plan"; its sheet shows three pictures in the app's style (iPhone: Share, then Add to Home Screen, then open from the icon; Android without Chrome's prompt: ⋮, then Add to Home screen, then the icon), or Chrome's own Install button when Chrome offers one (`beforeinstallprompt`). "Got it" puts the row away for good (`store "homeSeen"`); never shown on a computer or in the Home Screen app (`HomeScreen.standalone()`).

Tested on the iOS 26 simulator: Share is in Safari's ⋯ menu and "Add to Home Screen" under View More. iPhone's Home Screen app has its own storage, empty at first, and starts at the manifest's `start_url` if there is one, so the manifest has none (the icon then starts at the address it was added from) and the address always carries the plan (`Plans.url()`, even the owner's week). In the Home Screen app the plan picked inside it wins over the address it was added from (`Plans.boot`). Android also gets `icons/icon-maskable-512.png` (full square; Android crops it to its own shape).

## AI chats
Owner: ChatGPT, Claude, Gemini and DeepSeek matter; any other AI is copy-and-paste. Create shows the journey as three small drawn pictures with two-line captions (owner: reading paragraphs is off-putting): pick your AI → answer its questions → tap your link (it opens as your week), drawn in the app's own style, not screenshots of other companies' chats. Then one button per AI saying what it will do, and "Copy the message" for any other AI. The paste box (`planInText`) stays out of the way ("Already have a plan link?") until you've gone to a chat (`store "leftForChat"`, an hour): coming back to Create then puts "Back from your chat?" at the top, with a Paste button that reads the clipboard (`planInText` takes a whole address, a Markdown link or just the plan).

ChatGPT and Claude take the message via `?q=` (Claude's sign-in drops it, so its button says to sign in first); Gemini (no prompt parameter) and DeepSeek (its log-in drops it) copy and open. Tested in a real browser (Sep 2026): chat servers refuse very long addresses (Perplexity at 17,500 characters), so keep the message compact (one line per exercise; `inQuery` leaves query-safe punctuation unescaped and writes spaces as "+" where the chat reads that, `plus`); the self-test keeps every link under 16,000 and checks it decodes exactly. ChatGPT logged out works end to end but shows the plan link as plain text and leaves the prompt in its message box after sending. Fresh-Claude runs (new plan, change, warning signs) followed the message well. The message asks the AI to show the plan in the same reply as "I have what I need", to use exercise names (not ids) in the summary, and to give the link as a Markdown link whose text is the address. No custom GPTs/Gems/Projects (users would have to remember them).

## Analytics
Owner-approved Sep 2026, launch tracking for this and future projects in one Umami Cloud account. `Analytics` in `app.js` loads Umami's tracker from our own copy (`vendor/umami.js`, refreshed by `tools/umami.sh`; read the diff: it runs on every visit) only on the live site (not staging, localhost, tests, review or forks), cookieless, honouring Do Not Track. Never sent: the plan (address hash and query are excluded), plan titles (the page title is replaced), anything typed, full referrer addresses (origin only). Events: `open` (home screen or browser), `plan-view`, `plan-start`, `plan-link` (a plan link arrived: ok / needs a fix), `ai-chat` (which AI), `workout-start`, `workout-finish` (minutes, sound mode), `share`, `home-screen-help`, `install`. A plan is named only by a ready-made plan's id or "own". New events follow the same rules; the README says what's counted.

## Releases
The Pages workflow stamps each copy's commit into `index.html` (`?v=` on every script and the stylesheet, and `<meta name="build">`, which the app appends to the JSON it fetches), so a phone never mixes a new page with old cached files. Locally it's `dev`. GitHub Pages serves every file with `max-age=600` and new dates on each deploy (it can't be changed), so photos are re-checked after 10 minutes.

## Link preview card
`docs/share.jpg`, built by `tests/e2e/screenshots.mjs`: 1200×630, under 300 KB (WhatsApp drops bigger images). Everything centred, because WhatsApp on a phone shows only the middle square; `SHARE_CROP=<file>` also writes that square to check. The icon's ring (not its dark square) sets the spacing and alignment. Bump `?v=` on `og:image` when the card changes, or chat apps keep the old one.
