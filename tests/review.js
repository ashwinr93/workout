/* Opens one screen, as a person would see it, for review screenshots (tests/e2e/review.mjs).
   Loaded only with index.html?review=<screen>; nothing is saved while reviewing.

     home          the home screen (top)          day[:i]       day i of the plan (top)
     home-end      the home screen, scrolled down day-end[:i]   day i, scrolled down
     create        "Create your own plan"         player[:i]    day i's first exercise playing
   Add a plan link after "#" to review someone else's plan, or a broken one for "This link needs a fix".
*/
(() => {
  const [screen, arg] = (QUERY.get("review") || "home").split(":");
  const day = () => Plans.current.days[+(arg || 0)];
  const end = () => setTimeout(() => window.scrollTo(0, document.documentElement.scrollHeight), 50);
  const screens = {
    home() {},
    "home-end": end,
    day() { UI.openDay(day()); },
    "day-end"() { UI.openDay(day()); end(); },
    create() { UI.create(false); },
    player() { UI.openDay(day()); Workout.start({ warm: false, cool: false, label: `${DAY_NAMES[day().d]} · ${day().name}` }); },
  };
  if ($("fix").hidden) (screens[screen] || screens.home)();   // a broken link already shows its own screen
  document.documentElement.dataset.review = "ready";
})();
