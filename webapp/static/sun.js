/* Alba e tramonto con l'algoritmo NOAA (lo stesso usato da timeanddate.com):
   sole 0,833° sotto l'orizzonte (rifrazione + raggio del disco), calcolo
   ripetuto all'ora stessa del tramonto, arrotondato al minuto. */
(function () {
  const R = Math.PI / 180;
  const sin = (d) => Math.sin(d * R), cos = (d) => Math.cos(d * R), tan = (d) => Math.tan(d * R);

  function solar(jd) {
    const jc = (jd - 2451545) / 36525;
    const L = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360;
    const M = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
    const e = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc);
    const C = sin(M) * (1.914602 - jc * (0.004817 + 0.000014 * jc)) + sin(2 * M) * (0.019993 - 0.000101 * jc) + sin(3 * M) * 0.000289;
    const om = 125.04 - 1934.136 * jc;
    const app = L + C - 0.00569 - 0.00478 * sin(om);
    const obl0 = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60;
    const obl = obl0 + 0.00256 * cos(om);
    const decl = Math.asin(sin(obl) * sin(app)) / R;
    const y = tan(obl / 2) ** 2;
    const eq = 4 * (y * sin(2 * L) - 2 * e * sin(M) + 4 * e * y * sin(M) * cos(2 * L) - 0.5 * y * y * sin(4 * L) - 1.25 * e * e * sin(2 * M)) / R;
    return { decl, eq };
  }

  // minutes after local midnight; sign -1 = alba, +1 = tramonto
  function event(date, lat, lon, sign) {
    const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
    const tz = -new Date(y, m, d, 12).getTimezoneOffset();          // minutes, DST-aware
    const jd0 = Date.UTC(y, m, d) / 86400000 + 2440587.5;
    let t = 720;
    for (let k = 0; k < 3; k++) {
      const { decl, eq } = solar(jd0 + (t - tz) / 1440);
      const ha = Math.acos(cos(90.833) / (cos(lat) * cos(decl)) - tan(lat) * tan(decl)) / R;
      t = 720 - 4 * lon - eq + tz + sign * 4 * ha;
    }
    const mins = Math.round(t);
    return new Date(y, m, d, Math.floor(mins / 60), mins % 60);
  }

  window.sunTimes = (date, lat, lon) => ({ sunrise: event(date, lat, lon, -1), sunset: event(date, lat, lon, 1) });
})();
