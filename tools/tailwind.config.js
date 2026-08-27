/**
 * Tailwind build for the vendored stylesheet at static/libs/tailwind.css.
 *
 * The app used to pull in the Tailwind Play CDN, which compiled classes in the
 * browser on every page load. Players are outdoors on patchy mobile data, so
 * the stylesheet is now built ahead of time and served from static/libs.
 *
 * Run `npm run build:css` after adding new Tailwind classes to the front end.
 */
module.exports = {
  content: [
    'static/*.html',
    'static/*.js',
    'static/code-generator/*.html'
  ],
  safelist: [
    // Team colours are stored per team in the database, so a game created
    // before a colour was added to (or removed from) the picker can still ask
    // for one that no longer appears literally in the source
    {
      pattern: /^bg-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|gray)-(400|500|600)$/
    }
  ],
  theme: {
    extend: {}
  },
  plugins: []
};
