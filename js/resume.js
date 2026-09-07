/* Serves a different resume to visitors in India.
   Links start out pointing at the global PDF (so they work with JS off or slow);
   this rewrites their href to the India one once the visitor's country is known. */
(function () {
  var BASE = 'assets/pdf/';

  var INDIA_PDF = 'Shubham_Agrawal_Resume_India.pdf';  // global version is the href already in the HTML
  var INDIA_COUNTRIES = ['IN'];                        // add 'NP', 'BD' etc. to send them the India PDF too
  var TIMEOUT_MS = 1500;                               // give up on IP lookup, use timezone instead

  var links = document.querySelectorAll('[data-resume]');
  if (!links.length) return;

  // .href reads back absolute, so both work when assigned to a blank popup's location.
  var globalHref = links[0].href;
  var indiaHref = new URL(BASE + INDIA_PDF, location.href).href;
  var pending = null;   // tab opened by a click that landed before detection finished

  function apply(country) {
    var inIndia = INDIA_COUNTRIES.indexOf(country) !== -1;
    if (inIndia) {
      Array.prototype.forEach.call(links, function (a) { a.href = indiaHref; });
    }
    if (pending) {
      pending.location = inIndia ? indiaHref : globalHref;
      pending = null;
    }
  }

  // If someone clicks during the lookup, open the tab now (inside the user gesture,
  // so it isn't blocked) and point it somewhere once we know.
  function onEarlyClick(e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    var tab = window.open('', '_blank');
    if (!tab) return;   // popup blocked — let the plain link through
    e.preventDefault();
    pending = tab;
  }

  Array.prototype.forEach.call(links, function (a) { a.addEventListener('click', onEarlyClick); });

  function done(country) {
    Array.prototype.forEach.call(links, function (a) { a.removeEventListener('click', onEarlyClick); });
    try { sessionStorage.setItem('resumeCountry', country); } catch (e) {}
    apply(country);
  }

  function timezoneCountry() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') return 'IN';
    } catch (e) {}
    return null;
  }

  // Already worked out on a previous page view this session.
  try {
    var cached = sessionStorage.getItem('resumeCountry');
    if (cached) return done(cached);
  } catch (e) {}

  if (!window.fetch || !window.Promise || !Promise.any || !window.AbortController) {
    return done(timezoneCountry() || 'ZZ');
  }

  // Free, key-less, CORS-enabled. Raced so one being down or rate-limited doesn't matter.
  var PROVIDERS = [
    { url: 'https://api.country.is/',                 pick: function (d) { return d.country; } },
    { url: 'https://get.geojs.io/v1/ip/country.json', pick: function (d) { return d.country; } },
    { url: 'https://ipwho.is/?fields=country_code',   pick: function (d) { return d.country_code; } }
  ];

  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);

  Promise.any(PROVIDERS.map(function (p) {
    return fetch(p.url, { signal: ctrl.signal, cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) {
        var c = p.pick(d);
        if (!c || !/^[A-Za-z]{2}$/.test(c)) throw 0;
        return c.toUpperCase();
      });
  }))
    .then(function (country) { clearTimeout(timer); done(country); })
    .catch(function () { clearTimeout(timer); done(timezoneCountry() || 'ZZ'); });
})();
