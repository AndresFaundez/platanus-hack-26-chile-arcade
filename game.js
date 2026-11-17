// Chile's Bizarre Adventure — Platanus Hack 26
// Juego de peleas 1v1 con íconos chilenos. 1P vs CPU (modo arcade) o 2P versus.
// Sistema inspirado en los juegos de pelea arcade de Capcom: 3 golpes (débil/medio/fuerte)
// + botón ÁNIMA (espíritu que pelea contigo), especiales con movimientos de joystick,
// súper por niveles, dash, agarre, esquive y empuje.

// Todo va dentro de una función (se cierra al final del archivo): el minificador no acorta
// nombres globales, pero sí los locales, y eso ahorra ~1,4 KB.
(() => {

const W = 800, H = 600, FL = 520; // FL = altura del suelo
const FONT = 'Arial Black, Impact, sans-serif';
// Colores de texto más repetidos (como string el minificador no los junta; los números sí los inlinea)
const YS = '#ffe14d', RD = '#7a0f3a';
// Estados del luchador, poses, fases de la pelea y pantalla siguiente van como números (el minificador del sitio
// no inlinea constantes con nombre): 1 idle, 2 walk, 3 jump, 4 crouch, 5 block, 6 hit, 7 down, 8 ko, 9 pre, 10 atk,
// 11 rec, 12 cmd (el Stand ataca) · fases: 13 intro, 14 fight, 8 ko, 15 end · siguiente: 16 revancha, 17 escalera, 18 título.

// Atajos: el minificador no acorta nombres de métodos ni propiedades, así que los más repetidos
// tienen alias cortos. Graphics: fs=fillStyle fr=fillRect fc=fillCircle ft=fillTriangle ls=lineStyle
// lb=lineBetween fe=fillEllipse.
// Cualquier objeto: sd=setDepth so=setOrigin sa=setAngle ss=setScale sl=setAlpha. M = Math.
const M = Math, I = '¡', PM = Phaser.Math, PU = Phaser.Utils.Array; // I: el ¡ va aparte porque el minificado lo escapa como \xa1 (4 bytes)
const GP = Phaser.GameObjects.Graphics.prototype, GO = Phaser.GameObjects.GameObject.prototype;
for (const k of ['fillStyle:fs', 'fillRect:fr', 'fillCircle:fc', 'fillTriangle:ft', 'lineStyle:ls', 'lineBetween:lb', 'fillEllipse:fe']) { const [a, b] = k.split(':'); GP[b] = GP[a]; }
for (const k of ['setDepth:sd', 'setOrigin:so', 'setAngle:sa', 'setScale:ss', 'setAlpha:sl']) { const [a, b] = k.split(':'); GO[b] = function (...x) { return this[a](...x); }; }

// DO NOT replace existing keys — they match the physical arcade cabinet wiring.
// To add local testing shortcuts, append extra keys to any array.
const CABINET_KEYS = {
  P1_U: ['w'], P1_D: ['s'], P1_L: ['a'], P1_R: ['d'],
  P1_1: ['u'], P1_2: ['i'], P1_3: ['o'],
  P1_4: ['j'], P1_5: ['k'], P1_6: ['l'],
  P2_U: ['ArrowUp'], P2_D: ['ArrowDown'], P2_L: ['ArrowLeft'], P2_R: ['ArrowRight'],
  P2_1: ['r'], P2_2: ['t'], P2_3: ['y'],
  P2_4: ['f'], P2_5: ['g'], P2_6: ['h'],
  START1: ['Enter'], START2: ['2'],
};

const K2A = {};
for (const [code, keys] of Object.entries(CABINET_KEYS)) {
  for (const k of keys) K2A[k.length === 1 ? k.toLowerCase() : k] = code;
}
const held = {}, tap = {}, edge = {};
let LT = 0; // momento del último input (ms): demo e inactividad
const keyCode = (e) => K2A[e.key.length === 1 ? e.key.toLowerCase() : e.key];
window.addEventListener('keydown', (e) => {
  const c = keyCode(e);
  LT = Date.now();
  // e.key[1]: flechas y Enter, para que no hagan scroll en la página que contiene el juego
  if (c) { if (e.key[1]) e.preventDefault(); if (!e.repeat) tap[c] = true; held[c] = true; }
  if (AC?.state === 'suspended') AC.resume();
});
window.addEventListener('keyup', (e) => {
  const c = keyCode(e);
  if (c) held[c] = false;
});
// Si el juego pierde el foco el keyup nunca llega: se sueltan todas las teclas para que no queden pegadas.
// (addEventListener y no window.onblur: Phaser reemplaza window.onblur al arrancar)
window.addEventListener('blur', () => { for (const k in held) held[k] = false; });
// Botones recién presionados desde el último paso (no se pierden toques más cortos que un frame).
function poll() {
  for (const c in CABINET_KEYS) { edge[c] = !!tap[c]; tap[c] = false; }
}
const any = (...c) => c.some((k) => edge[k]);


// ---------------- Audio sintetizado ----------------
let AC = null, NB = null, TH = 0, TT; // TH: semicorcheas que le quedan al tema del súper; TT: [melodía, bajo]
// ty = forma de onda como índice (0 square, 1 triangle, 2 sawtooth, 3 sine): ahorra ~230 B frente a los strings
function tone(f, d, ty = 0, v = 0.08, f2) {
  if (!AC) return;
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.type = ['square', 'triangle', 'sawtooth', 'sine'][ty];
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g).connect(AC.destination);
  o.start(t);
  o.stop(t + d);
}
function noise(d, v = 0.15, hp = 800) {
  if (!AC) return;
  if (!NB) {
    NB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const b = NB.getChannelData(0);
    for (let i = 0; i < b.length; i++) b[i] = M.random() * 2 - 1;
  }
  const t = AC.currentTime, s = AC.createBufferSource(), g = AC.createGain(), fl = AC.createBiquadFilter();
  s.buffer = NB;
  fl.type = 'highpass';
  fl.frequency.value = hp;
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + d);
  s.connect(fl).connect(g).connect(AC.destination);
  s.start(t);
  s.stop(t + d);
}
const sfx = {
  hit: () => { noise(0.12, 0.25, 300); tone(140, 0.12, 0, 0.08, 60); },
  heavy: () => { noise(0.2, 0.3, 150); tone(90, 0.25, 2, 0.1, 40); },
  block: () => { tone(900, 0.06, 0, 0.05, 500); },
  whiff: () => noise(0.06, 0.05, 2500),
  jump: () => tone(300, 0.1, 1, 0.05, 600),
  special: () => { tone(400, 0.25, 2, 0.06, 1200); },
  anima: () => { tone(220, 0.35, 3, 0.1, 880); tone(330, 0.35, 1, 0.05, 1320); },
  ck: () => { tone(800, 0.6, 2, 0.08, 60); noise(0.4, 0.2, 400); },
  super: () => { tone(110, 0.8, 2, 0.1, 880); noise(0.6, 0.12, 1500); },
  ko: () => { tone(600, 1.2, 0, 0.1, 50); noise(0.8, 0.2, 100); },
  sel: () => tone(660, 0.08, 0, 0.06),
  ok: () => { tone(523, 0.1, 0, 0.06); setTimeout(() => tone(784, 0.15, 0, 0.06), 90); },
  bell: () => { tone(1320, 0.6, 1, 0.08); tone(1980, 0.4, 3, 0.04); },
};

// Cumbia chiptune: bajo raíz-quinta + güiro + cencerro. Un paso = 1/16.
const SONG = [[110, 165], [110, 165], [147, 220], [165, 247]];
// Tema del súper (campo th de cada luchador): su canción en chiptune reemplaza a la de fondo
// mientras suena. th = [melodía en 1/16 con chr(midi) y ' ' = silencio, bajo en 1/8 con chr(midi + 12) o ''].
function music(n) {
  const b = n % 16, bar = SONG[(n >> 4) % 4];
  if (b % 2 === 0 || b % 4 === 3) noise(0.04, b % 4 === 0 ? 0.05 : 0.025, 4000);
  if (b === 6 || b === 14) tone(820, 0.05, 0, 0.02);
  if (TH) {
    const [m, bs] = TT, L = m.length;
    if (TH >= L && b % 4) return; // arranca en un tiempo, en fase con el güiro
    const i = L - TH--, c = m.charCodeAt(i), d = bs.charCodeAt(i / 2);
    if (c > 32) tone(440 * 2 ** ((c - 69) / 12), 0.14, 0, 0.05);
    if (d && i % 2 < 1) tone(440 * 2 ** ((d - 81) / 12), 0.25, 1, 0.09);
    return;
  }
  if (b % 8 === 0) tone(bar[0], 0.25, 1, 0.09);
  if (b % 8 === 4) tone(bar[1], 0.2, 1, 0.07);
  if (b === 10) tone(bar[1] * 2, 0.12, 0, 0.02);
}

// ---------------- Movimientos ----------------
// s = arranque, a = frames activos, r = recuperación (60fps), d = daño,
// hb = [adelante, altura, ancho, alto], k = empuje, hs = aturdimiento,
// low = se bloquea agachado, ov = se bloquea de pie, kd = derriba, sp = especial (daño al bloquear),
// air = activo hasta caer, lp = [vx, vy] impulso al salir, inv = frames invulnerable.
const B = {
  L: { s: 4, a: 3, r: 7, d: 3, hb: [46, 90, 44, 18], k: 2, hs: 12 },
  M: { s: 6, a: 4, r: 11, d: 6, hb: [56, 86, 56, 22], k: 4, hs: 16 },
  H: { s: 9, a: 5, r: 17, d: 9, hb: [66, 84, 72, 26], k: 7, hs: 20 },
  cL: { s: 4, a: 3, r: 7, d: 3, hb: [44, 40, 44, 18], k: 2, hs: 12, low: 1 },
  cM: { s: 6, a: 4, r: 12, d: 5, hb: [56, 30, 60, 20], k: 3, hs: 15, low: 1, kick: 1 },
  cH: { s: 8, a: 5, r: 20, d: 8, hb: [66, 16, 80, 20], k: 4, hs: 20, low: 1, kd: 1, kick: 1 },
  jL: { s: 4, a: 6, r: 3, d: 4, hb: [30, 60, 44, 40], k: 2, hs: 12, ov: 1 },
  jM: { s: 5, a: 6, r: 3, d: 6, hb: [36, 56, 54, 44], k: 3, hs: 14, ov: 1 },
  jH: { s: 7, a: 6, r: 3, d: 8, hb: [40, 50, 60, 50], k: 4, hs: 16, ov: 1, kick: 1 },
};
const DODGE = { s: 0, a: 0, r: 24, inv: 20, dodge: 1 };
// Parry (botón 6): ventana de 8 frames; si te golpean en ella no recibes daño y el rival queda expuesto.
const PARRY = { s: 0, a: 8, r: 16, parry: 1 };
const THROW = { s: 2, a: 0, r: 20 };
// Movimientos de joystick escritos mirando a la derecha
const QF = '↓↘→', QB = '↓↙←';

const CH = [
  {
    // Papi Micky usa el id interno 'prat' (IA, récords y sprites cuelgan de ese id). Arturo Prat original: tag git v4.
    // sw = usa el cuadro "especial" (el puño con fuego).
    id: 'prat', sn: 'papi micky', n: 'PAPI MICKY', sub: 'Directo del Torneo de Cell',
    an: 'JB THE VOICE', ac: 0xd8dcff, hp: 100, spd: 4.2,
    o: { H: { hb: [78, 84, 92, 26], d: 10, s: 10, sw: 1 }, jH: { sw: 1, kick: 0 } },
    S1: { s: 7, a: 99, r: 16, d: 10, hb: [30, 50, 64, 64], k: 8, hs: 22, sp: 1, air: 1, sw: 1, lp: [7.5, -13], t: I + 'PA!' },
    S2: { s: 12, a: 0, r: 26, fire: 'bill', t: I + 'VALE 150 LUCAS MATÍAS!' },
    X: { s: 2, a: 36, r: 16, d: 5, hb: [44, 70, 96, 110], k: 4, hs: 16, sp: 1, multi: 6, dash: 15, sw: 1 },
    xt: I + 'TU PERFUME A CHANEL!',
    ml: ['Golpe PA', '150 Lucas', 'Perfume a Chanel'],
    win: I + 'Llegó la hora del after party!',
    th: ['B @ ? ? ; ? ?   B @ ? ? ; ? @  ??  ;=;=;= ;    =;=; =', ''], // Chanel (de chanel_partitura_notas_v2.txt)
  },
  {
    id: 'vidal', n: 'ARTURO VIDAL', sub: 'El Rey',
    an: 'ANÍBAL MOSA', ac: 0x9ec9ff, hp: 95, spd: 3.9, // Stand: Aníbal Mosa (antes: El Rey dorado)
    o: { H: { kick: 1, hb: [64, 44, 80, 30] } },
    S1: { s: 8, a: 14, r: 22, d: 8, hb: [34, 112, 46, 36], k: 10, hs: 22, sp: 1, dash: 11, head: 1, t: I + 'CABEZAZO!' },
    S2: { s: 3, a: 14, r: 18, d: 9, hb: [26, 140, 64, 70], k: 9, hs: 24, sp: 1, air: 1, lp: [2, -15], inv: 10, kick: 1, kd: 1, t: I + 'CHILENA!' },
    X: { s: 2, a: 40, r: 14, rep: 8 },
    xt: I + 'METO PUROS GOLES DE CABEZA!',
    ml: ['Cabezazo', 'Chilena', 'Lluvia de goles'],
    win: 'No fue culpa mía, yo estoy bien, mi familia está bien y gracias por todo.',
    th: ['JJIJ GFGG BC CGJJIJL JIHHEDB BHLLKL HGHEEBEH EEJJ HG E GGGGF GG', ''], // Mala Junta
  },
  {
    // Leo Rey usa el id interno 'melo' (IA, Stand que camina y sprites cuelgan de ese id).
    // Pancho Melo original: rama git pancho-melo.
    id: 'melo', sn: 'leo', n: 'LEO REY', sub: 'Rey de la Cumbia', // sn: nombre corto del récord de campeones
    an: 'ALEXITICO', ac: 0xf2c230, hp: 112, spd: 4.1,
    o: { M: { hb: [52, 96, 50, 24] }, H: { d: 10, hs: 22 } },
    S1: { s: 9, a: 0, r: 18, fire: 'kid', t: I + 'BRÍGIDO!' },
    S2: { s: 6, a: 0, r: 16, fire: 'no', t: I + 'MORTAL CUMBIA!' },
    X: { s: 2, a: 40, r: 14, rep: 10 },
    xt: I + 'CHUPALO ALEXITICOO!',
    ml: ['Impacto Brígido', 'Mortal Cumbia', 'El Superclásico Cumbiero'],
    win: I + 'Sigue el ritmo... y seguirá el sabor!',
    th: ['N NI I IE E J I NINQPQN  N NN   L L G GD D GD @ LKLNP QS', '69==69==69==69==43;;438;43;;'],
  },
  {
    id: 'massu', n: 'NICOLÁS MASSU', sub: 'Doble Oro',
    an: 'FERNANDO GONZÁLEZ', ac: 0xffe27a, hp: 106, spd: 4.4, // Stand: su compañero del oro en dobles de Atenas 2004
    o: { L: { hb: [54, 88, 52, 20] }, M: { hb: [64, 86, 64, 24] }, H: { hb: [76, 82, 84, 30] } },
    S1: { s: 8, a: 0, r: 12, fire: 'serve' },
    S2: { s: 10, a: 0, r: 16, fire: 'lob', t: I + 'GLOBO!' },
    X: { s: 2, a: 0, r: 10, fire: 'massuX' },
    xt: I + 'NADA ES IMPOSIBLE!',
    ml: ['Saque', 'Globo', 'Doble oro'],
    win: I + 'En la vida nada es imposible, weón! ¡Ni una wea!',
    th: ['C HHGEECB CA@  >@ACE  CA@ACA@>  C HHGEECB CA@  C HGFG  HEDEGC  ', ''], // Himno Nacional: Puro Chile es tu cielo azulado
  },
];
// Arma la tabla de golpes normales de cada personaje: N.L, N.cM, N.jH… y la versión con Ánima (N.aL…).
for (const c of CH) {
  c.N = {};
  for (const k in B) {
    const m = { ...B[k], ...c.o[k] };
    c.N[k] = m;
    c.N['a' + k] = {
      ...m, s: m.s + 1, d: M.round(m.d * 1.3), an: 1, kick: 0, sw: 0,
      hb: [m.hb[0] + 30, m.hb[1], m.hb[2] + 18, m.hb[3] + 6],
    };
  }
}
const FX_WORDS = [I + 'PUM!', I + 'PAF!', I + 'ZAS!', I + 'TOING!', I + 'CRACK!', I + 'POW!'];
const RANK = { L: 1, M: 2, H: 3, S1: 4, S2: 4, X: 5 };
const rankOf = (k) => RANK[k.replace(/^[cj]/, '')] || 0;

// Comprobación previa de especiales (false = no sale)
const CAN = {
  massu: (S, f) => S.pr.filter((p) => p.o === f && p.kind === 'ball').length < (f.buff ? 2 : 1),
  melo: (S, f, k) => {
    const kid = S.pr.find((p) => p.o === f && p.kind === 'kid');
    if (kid && k === 'S1') { kid.vx = f.fa * 6; ftxt(S, kid.x, FL - 90, I + 'CORRE!', 0xffffff, 18); }
    return true;
  },
};
// Efectos que salen cuando el movimiento llega a su frame activo
const FIRE = {
  // Papi Micky: "¡vale 150 lucas!" lanza un billete (sonido de caja registradora)
  bill(S, f) {
    const b = f.an ? 1.25 : 1;
    proj(S, f, 'bill', f.x + f.fa * (f.an ? 70 : 40), FL - 100, f.fa * 9 * b, 0, { w: 24, h: 20, d: M.round(8 * b), k: 6, hs: 20, sp: 1 });
    tone(1568, 0.1, 0, 0.06); tone(2093, 0.3, 1, 0.05);
  },
  kid(S, f) {
    if (S.pr.some((p) => p.o === f && p.kind === 'kid')) return;
    const b = f.an ? 1.3 : 1;
    const p = proj(S, f, 'kid', f.x + f.fa * 50, FL, f.fa * 1.6 * b, 0, { w: 30, h: 56, d: M.round(10 * b), k: 7, hs: 26, sp: 1, t: f.an ? 110 : 220, big: 1 });
    p.say = 60;
    ftxt(S, p.x, FL - 110, I + 'LLEGÓ ALEXITICO!', 0xffe66e, 20);
    sfx.special();
  },
  no(S, f) {
    proj(S, f, 'wave', f.x + f.fa * 50, FL - 70, f.fa * 7, 0, { w: 40, h: 110, d: f.an ? 8 : 6, k: 12, hs: 18, sp: 1, t: 16, big: 1 });
    tone(500, 0.2, 2, 0.07, 300);
  },
  serve(S, f) {
    proj(S, f, 'ball', f.x + f.fa * 40, FL - 95, f.fa * (f.an ? 13 : 11), 0, { w: 18, h: 18, d: f.an ? 12 : 10, k: 6, hs: 20, sp: 1 });
    ftxt(S, f.x, FL - 160, I + 'SAQUE!', 0xd9ff3a, 22);
    tone(700, 0.1, 0, 0.06, 300);
  },
  lob(S, f) {
    proj(S, f, 'ball', f.x + f.fa * 30, FL - 110, f.fa * 5.5, -11, { w: 18, h: 18, d: f.an ? 11 : 9, k: 5, hs: 22, sp: 1, g: 0.42, ov: 1, t: 160 });
    tone(500, 0.15, 1, 0.06, 900);
  },
  massuX(S, f) {
    f.buff = 480;
    proj(S, f, 'ball', f.x + f.fa * 40, FL - 95, f.fa * 15, 0, { w: 20, h: 20, d: 12, k: 9, hs: 24, sp: 1 });
  },
};
// Súper que repiten un efecto cada `rep` frames
const REP = {
  vidal(S, f, o) {
    const y = FL - 150, dx = o.x - f.x, fr = M.max(8, M.abs(dx) / 12);
    proj(S, f, 'ball', f.x + f.fa * 10, y, f.fa * 12, (o.y - 90 - y) / fr, { w: 22, h: 22, d: 6, k: 4, hs: 16, sp: 1, soccer: 1 });
    tone(250, 0.08, 0, 0.06, 120);
  },
  melo(S, f) {
    proj(S, f, 'wave', f.x + f.fa * 40, FL - 65, f.fa * 8, 0, { w: 34, h: 120, d: 8, k: 5, hs: 20, sp: 1, big: 1, t: 90 });
    tone(520, 0.15, 2, 0.05, 380);
    S.cm.shake(120, 0.006);
  },
};

// ---------------- Sprites (pixel art) ----------------
// Hojas WebP generadas desde sprites/*.jpg. Cuadros: 0 idle, 1 walk, 2 jump, 3 crouch, 4 hit,
// 5 ko, 6 punch, 7 special, 8 lowkick. Ánima: an cuadros (Melo: el niño caminando y golpeando).
// x / ax = anclaje horizontal de los pies dentro del cuadro.
// Todas las imágenes (SPR, LOGO, STG) van en basE91 y no en base64: ocupan ~8% menos.
// Alfabeto: ASCII imprimible (32-126) sin " ' / \ — así no hay que escapar nada ni aparece "//".
// d91() vuelve a armar los bytes del WebP y devuelve el data URI.
// @SPRITES-START
const SPR = {"prat":{"s":"7=4V$,3 RgiSL!326sY1n#  Xi):-PR6S[1qfUC}^foz}#!S,P-Y.J~B?NCHmV g}_;T>FDu+><Yg4!Tgs%2%twq;=+0{}YC-^XC.7r.sbwQIo0!U(OvNpoBtZVlbqbRQL|2ke~#mb*`xCZjkDgPv0=i4w$]H_H.MP63!M+&o9KJVd:[c6M.J(Mt%e^iTZ? b2ma:hjxLFPAQEHJ8-kO4m5Zs{vZLgu}k#F{K&<fT52gM@+?IX gA$?PTU]68$9M,$5~;<~N3M`|r7g<Gr)a*r3+xh-x4K$f*d6MS<>kWT$k7S,Jub#:s,oHSalrg`MM4~fAr,mHxAL!-;qzSzrCZbg513i%|q!o]jT,Pszfed)q~rv?daBV9MLjUpxN%0&5Tron>^;Iaf@QW9iebYEgRdoJ{;#oQ=Xr6xBx0x}?$8HqC[p|2^z@J:DsN|-{QBFpmf^0!2lj9;ElIK4{)fLQ|[]55CCc?y<^nm[b)~T#Yz8O6Gd@iEYL$E0C-d#E?_l7[z5aK$:N4}C])aOw7b<k@pkbQw?HWeBhy0vedB T 3FFDjoXjc|OnDdeT7(3=3+TN& 3@c^eq VI&CIIVI$3La2b&<5NLySiqp<k(SSA5N,G9XGCjWQ]0CAl$:CZw>a8VA;{I,<`TcS@cw>l|7P])a3Z<p}xAxebVc<O+I<IiR5tQzLP0oOV[s3A) (a-?r2U)_t,gkDI6+q^35j8I`CCjgH4xiBt~obmI}g#%`qr7@EMcN&M;m p{|&Kq}&4d1[4%[,Tk}|}e1&wALGOne-&Us^p$fjEwJm9CTT6U+@Jn!xH&AyWB+O15X~>}-wvpI[&mhtjg])>I5~KnEgDovpg8)s--D0oneF(:4b?H`P|6E6fHnu_2|q#!s%Qr=mE8!xNnV;?YX@ga{1.XLdrBgz@y7,bzM,G;kqi[v9^(:LBP~L`pMC2IfM`p9`o,I:bA6jJ* `,woY)2LDI)}w]lvg~>u75}[jcn_e0?sl.X6+FV}h}FvK#6X]S)kgP WrBNv9DR{zUQ A8CyO[F]c JUVP;KK46a+%70glLnM obJ+q<?My,YRI*^b`t`iiW7WVE].VvPg2w`<GWPtb2mzJ@#8!HPm#MI1-uE%m.EQkdLF`4o^AFK`DCYy>dP4eWw9j9KQ`xS08zP;zX[VXQdYHY-K]zXqGF;yCdzn^0!Nj;p>yGm3U{]^=@_kvXXxmQajEQcvH=)3d$T5lu>b.R7DRCikL6b0R M`ewDU;Skp$(0!e{oIu$2$)5,zBJ}%)QW}uhlJ]5Mt]1hcG46L`kqI6sD;Tu0]SC:hzet1?&`#7jZg5JL>kH[474XEz2Z12v_w^^|j67=vnEL@hKuoYu<4Z[BmB6!ErwMP) A)cuN+P=.M6ynUjRJl2>x<1jj*z<8Fh~x2Z:GH}$pwL1mRM:X!>N3un;eLld_n5e#u(Un^n60 +RWX@~4|AQ?dklpiJ_E%&g_<ptGO9=^K8t!6$x;&N[9B7W]E<XJYJyhq+~P3L1m5Y}W.n&:MvtWV{A3O]CP#R;`>qY^h<Pl4# h1x`p(?o=``@7@A;-@gtl7dQPfQd%{U*7d$|X{HUvv519$AYAddRl[fE9#YR3b%[pmQN7_nv9BL7Meg Z#]-AI(sV3Rv.E0!CO+to?Bkrij_Ha2]8375![fGx+AC<$PySyV0aO~C:+:LA|DsWj,SWC8fZFpNce.b$?%ZNN(Z;]&6 $_UvUmmD$%b>i5_BZl8%<Aq8srLk<-kYP);lwH;kQdI]<z0sX|0gghnxP51m9[bTZCsf)oNsC$Eu[!EMGSdL~o|R?6#P<ri{h2VZ*!5QXMx_:m!Tlevl[?BAy|$DHBR[6$0,QcsOyg GOn`Vnv&Q3gHuh*-z>GxU?u1,&l@LmBnX0FZ!*q@sG]c=YxtI`XQW]=)_nraHhsBHn:%7){`6-~j>&oVevmp_Y`ovag($GF] X)==@hF)j%b7=}-&;O1giy*1j^e8~ExK|I%,>:KkBeV-*g%=(;*Ave^gn.0Wx3mr*bO8pak1J(;n3F%]*ri9&U@7+y(29<]LAvT8<ns,%Wl[O J$cFx7t$!*JU?vSpyRse~t^=ynqv& Kj+~w>;K0qCV#<HZu@HGyC>!o[1E 5T,<RUJQZF:DR?+lNnb!`>!!!6sI#Q^&Z@E*d)=;Q_2IV9iQ^2w?@]0O&22kN?79mfACt4(!)UI%F$?8*;3^Cj#BVP^XDl-M:N4v.c-VlU=vF>%PG*+.`o8v5bnT~DhMj.!]rb^$A)ls`ENJbhg1nSC74KO>EYAhf~*N!j%JC{4<A(+@2WP2b@h7,Jnw$0P!h33!GMxF(0TTE!fvs&2tcB@QTrgJ2 5&D-R>^;wP*+d#jghdQlg@lPqKK2XlkEzyX14IUlgdX,XV!|EGyVfse-tXkut8{tFtf{4.*@p-,<> 5aQzA*4AsS9Bo D>BGW~A<E^hsXP~4gP4Wsa81_NI>z1(?p^tuFICaJqFmY!lb lF2F_#;3[b*0G&e<3tz,?!5ep.R{~T6[u(y_z98t6O^UJ|8,Mu u+T  ","w":47,"h":42,"x":20,"a":"7=4V7)% RgiSL!326srjc   2@?[V9>:9Ve<p.w?j1OEHe=H w]L|q81..zG ErWEjoTe;.:`$sl;:~G[<yl]F9H~3{}[gzv+#4MNlFxPgq9s}{.b<v5OV[<39LR_U.%Ty1waCUM,REzGuiobKufD)=L~eBe~nw{i0kL-9`KFI~e.qVT*m!EXv{LGLCMuvDpJa5oaK#x*mi;1-KiLM|4vhkX {aK[v~,F&e[ M6jr~ fLzn{Lkg3W.o&ddhAOD;}p.L5~$A-MQ?vsqP[oPio]OKq%zx<3dsvr2YQQj;v.y#`AOf-pJ!fcH`{QAuvd~E~#@CJql5TGi<c#G%ll.gFD#.n]50C Ds;$-j;ODIR rQH<ix4a#<#vXDIGpw.Y_l#%XRK5mKz~m r2M!%b(%duEUo^x[,@gy,N[<GF];s)~i`-}tQv.v@.IcP`[ G}{v]r&d|vgp8^.RVs*Y83vqUJJY9.i8pN,c-?7t.hkyy^;sU2s`|<upM=p7hGqqUJtQQm~[+.s0uYZ]stk330P}#,NEvMVu+Q%lX?7gV{N4jF]Uk!<0Pd.u3N%7SIVIQG HnC5P.JjE1}X4 m^KVk-@z<y|C?~[h_ll$;ChkC%!YTY_U]Y$`pI[UILNZixXQA3Bhyy-u1GhK , ","aw":35,"ah":46,"ax":12,"an":2},"vidal":{"s":"7=4VTC5 RgiSL!326sY16$  Xi<:-P26O[1qq<3[+{m~P!F#d[Ks$b^;h%k`X8es]eLllOyVSZH>jySlswOYMR#s_HYr[nG8=d1qQh1&UWB`FCSsS1wpc8RpxmH8#W#Tv#osXC,#O*:$@~n#S9vS%*%65&{GL1T+nPI)0Guxil7Gnv&1nfS<WI>d1qf*NKVX3>L)m@A@-Xb7G1,avOm^E)L-*89[s9wZ{lu!l9mp7(MbQk50Mu[#)j]SZ<VXP~0yAv)Lw}8~I*t}# AxCera(s*TG}E+MZ38r3&sqIphPhwxZwM)[ifVv0^D_yWeBC~OWi#)1mNp0cIioaT{lSd|!~cddDjFQE>5-.;b&z6KO`QAP&5pr{&5lSAr%ZH|=B[ORFFNn{Fk s-G?X7wp9}.r5xK8;&y~j>3z[pb5cfOp;!LK]zfArA]-Jz$TIGv>N~{aPv{C9Z;rc,oV&bQOguq?wXaF@=zdz?#POr0*uX7x)qYf|km]v^A6Iv<3MXbLKKv6?%AlZ(05{1T&SORI_el.,>%CUIY=@ZeZWDJ`hz66XB#Q[Yv(ZHn}.g#DdWP4o}e.49kitu[tC|Z{M%:M1Co6Yp*!de550Z~ dd^Yu<Y*`moF+#I!1]fy(V4*tIuIp;kV!K:IG71ILSBO5L<*M?50.X6kGWE}`{@cv*)cDA~_z:&zCHe`esGS2Q@}X]+Qwu%1X2.UT+DL%$+;Z>N*Hz`MYmd1~sW#uq@m5v|QO)&>N$p)iWHa$k{Q]=&:SAr2h(qura%gN@`^tw&.?Dv9UBQ(66^wvoaZkf?n2t|e>$?t(lC8lWkEu1<<u]as0} !QLmrq-)(q_?pI4E@^K=J`M4PL8^Yit[|vr<?#Rn_A`|yk0`Ek?:<NWm*pz<A{&B JM.Po-#b=be4;!`uD4xOKRsQWY0O:>;%AXO#quyMdQUzwk&!q77j5d70pUNqR~G##(]`qlwY!SxYqCh>Wq9)4GCGmmqH+ pU+mfW%-[p<1sQo}~*^iPKDo[{WeaWlL 6r?eG~)*4G8q6e7#Fmrr[AY<hSm[Hn>eKzh~79P+?{s5H(cbuR*[rS0SS%#$J2g3yt^~s0 ruin%z#m3!AzCA&y{w${sgaKO_$}5$tz?DFrkxR0^REAoiX`dEr3.oaK!P3SZ7Qm:;6;!;Q7_=)&&Zzkq7~:|FtW:KVLBKVT%CC5]2ji.I:?HDGS,3qI$-9S>j3q*O|#mY+G*G1|VJ5qQGD4,gycoOesn$b^FK7w[@92AVY vU_B1ul|ufy0!FB@S9V5Yhwr.lVwgr[:O3HB5wp+:0s_]!zdWM:|y][Z|Ki.xdqxy4K?`^tlqYLM|V=Uis^wJ7!A)N5>Fh(J(b5l(1rY|!Gnx,X!S|k#e_odb,9EWrSu?Kr+5}*9Iq<h~pwNe&Edv*5Qj48%Ls7&K0q8+mK]~be]I(J6x2!kgem|F8g_OI>mX$,6eY?mY GykGFyRcfYZ%n9#_u&6(nRn!`BLCL;q G}e=6c4H).Blgf{->Mh,<M3OaQW~,]Og+xqnET2^C]Ibs~3s]M72Aup=V_OVMMu;?-<i-V^&Eyw2qqmYLYwQW=2P,h`TA]*#w#DkIed0kOEI]jbfuJnUH<2]6PTRiFTA;G`]IF]]IZ%dm5pOccfUT8$&eo4)G*l]je.ruQd(Te%v=$R061q{CqG|EZq%8c;+<n H`^FBV+JzNX+9m}.bIy@qGOX:IVzSUK~P6h`$*NbxK;q:b[q>(WaXc@d]IcZ*.Ws!!^h8{3u=w[:s.Y!NLMd~-Zd$l1E%z5Uu&@k+4Y{B^ A~kMX!|e!iMu.[faE^Ry.F=7<(5>w)b5UtF9QeM,jRe`ioS~4h;)3SloKSelLST5UJSK|>mh.CCob*{hPAra<Q`^#z#u3WyH* e]FVKBVJKX>c.Uyk5t0ANj-nPo$F%EB!fYX^q<b+)sH<h[Bwz^TO(%p-b3tbMdhCbi*!{Bga,VDO|@=Z_P)b.!V(r38nhtw7R4#~X+h>}9pK3VK4+G(b]oOiQ`e9qZdO8Tey5{<@Yy.!&nJf0OAo9C$j7$PP%QNwFR`kfq#5.3ztnj]vw_]<Q+`+-AA .Gx.(=pdu!S%v=<Y%XPPI]+:7^[|V-;0{2[SZyL1s-<}#m^Q*!eTEcAZq#FrD}%[K)&P{zLU:uFP8C76;SE=VAvogFK?7LakfSwe-DwW:|25j}%.3ymf0})}e*B<6*lC$@d!`|*DhKs[`v[]_:384-$Hra02PE0V#~n<[+[jwduGv7;,v>ogC8rlrZboh?oLVEr3!7 Q8-r%P7a_vrk_g5bswZ@x38^Z.PR1L^~~.<HoJ%WO@BKCR~JKsU5&7?ug>(1E!AK:=~K&xYAXh6w.gQA:`Aq< M#VTG>x%1N]uVL,uY&O?i4[I,([=`AA~34)Py^<!F-[ SXfxKlP]*U)1^1q+PS~Nf N]Hv!7t.oc4+.Cor6alY4~z|uAx%9s)pzXH9W7yYxpHE.Q+PwUNqc4?.Q9O},5#`uXPFq  @mbGxM#8<s6xdq!7 Q$`na.;|^.iTa(Ks6;DW2@u%SSuA 5}*dQc6[K;bUBh(!A:}mtz1=#9D3?U$gZ[~U0OWB&m^NNKvI:dsy_eIa(k_q6j0tv*mUgNJFf1 ;*.?.<1@=1!:5Vq,^MQE=Vscuvx1q6d7+_H20@W*>vV9F^K[g<V,)1-+u@JRyv@Kmr)F^RuM8adTk-lus^cuX9+[ifH6v~~n+wO.5ykf&Mg@,T@-dxwd4)!)L,pPf 9#nMSglP=,S;myLQP)`e38Q7%u}]a(Be?rEO_gu=oGz[f-luD2 (9<*`&hMVnW[|W*G-=+hQn?[fAm%u82ZFK~`Y1n@MQ#,f}u.V_mnJ.&E:YGRTJXpK>#_G+gMUQGSn99, [A=}=5M9q&~MZ  ","w":63,"h":42,"x":33,"a":"7=4Va`& RgiSL!326sY1}   A^_9.Pf5v(>d1qW({44&k<JqFMEZrw&R:c+)b#m1TR9TdS=dH[~O&n3[7#8:;-[mRRp3&,{}[gM9vOxx(-g}RtZ[`|p{6.Iq6Y<U5p7c+*G$TH,X,@,;(3pHmH>G9*>@H1NC}1nBf`5o,d`ZMY*>$Ce2K6]W8y`fGIy*V0Me#BzGW^9+@$|2}GAtc<u<VyFNm.&j0>p(0CNg(-zHcc=@_p=.=d DB~).VI*gF>R=-%Lo8exdLpZvcwt3z)&fk`=k9HnL#RThP[tP<O#g:@4r>7PbqjawC!0gkao2)d)RS;TzTDvFRk1vYT~7ZdgRZfeEtE%X@RP3hWr:U>8rO2t4@hOIZWo{qQ66c)}~R=>HOMYVm|Up9g4Fl< Wx!mZ D0p}LYVQ=CPf:WIs]aPQ ~H f$;O5$9!xJ}Qx6=&2.JYb*c`mN_|%(#nFw%Jk7I(u(}5Y{k-J9<m ({jezfG=SI36GV13uFmk5,sbY.rm0@S-7b$NOpMDS*4ZCV@<SI:S?3CVl.DW~WzqIyRju<|](:gpB>]8l@SI7yK>^-OwIy-=!zb,E7;F#%3I^Vu=A.fH4%GQBIk.RSJ#dojU3xOfTg|*=xJnF$!Y1Lxyh?)u=.JUL5 ltNW,RrUL !vd0!GuC*|&hpe<{.pV@>KAMKQ&e!Yo9n?l5B]q;f~p2q]D$[I|7k[OOhd<>y.>=@^dinKO?N^.ha4Y:RIV4Lglk^z4cp%j`r$lF$!YSg:R|=q(KV#GGf|t*q:Z0E;n>!A_ZYTcBn}uKH_0T48gmlUI56;y%@`0~4I:^>1* L+qGIPcKO1GGf7&b^Ok~f}tPrj;4%wL!Y35c)d+t4ZGglI&T4cpmk(0z4j{@[cMnze<>K4Gt| n}k^! ","aw":55,"ah":46,"ax":27,"an":2},"melo":{"s":"7=4V@?3 RgiSL!326sCSq#  )R&:-PM5S[^+KVC}^fFxB-:4<[Uoo5l1YEu^Dm&@*V{4q-)Q{IW(UlnoCy0n`E7&d<4NA|a(LG#X3lhDqg8hKKb)xE{},P>`(3MV&qQ;h1zNF*7g`{1kY_ok)2<Fai0^F[n;q#n;K~sf3Rl4n0)^9)F:JVF6_kv&y(TNW|Q$i}#{8(_.egoa2v-}^Bn|;De$woe|8>k<3s}v2$W;.t}9T_.^Yx.07=QWtQQ]fDo1v]YxtUy@-^{6s]%v.HiDA.s1aj~U%1p7iUKWt1-rrm2^+NIV+f!5sUU(ecPX08pD|2b%FxGDJQP0lN6r+y#+p_:A~Fk1m &_1LfZ.izG}Ku!7F,GG=5sh_wg0B9ZVVdKb<b.4|:Sa8LQw9yB]`$Pv<2uTHG2OUsiOc$p:Y_$e<e<g}(&L)q0BLx^P&oW|GOdpDW*r#O,uw%iy(9:%#S}f9-iZ!!s- S#s]ttUh[:DJUIcas$FvSDp$JV&@`?Y~K60(Hw_2&s zefPM*&<,QJ2Ib y4_9Mr8f(+&Fj3{!(3l$QWKWt1JW2s:whNsStOWK7<+7nPoj:P=P?bgf)a3P=l=(Rk #p:Vr.L}a2I|$-a?C Ll<_i,Uy*^g=^u1_!j*Je?Fk`+tZ-?:EQz$}>a23Pi(DN+Bt!}9%#&Zbnm MVDuHSQ=7^>E*TXT,rIe-*m<qRP6:o3pjDMV=M@$MGP7%<:`&*Uvc@pL]bN+.C0BL1V|1?#X6g`UN_081oRb<`DG6xQ!1z:9X&H!L-%Xw$~rhU0j(bgf`Ob]p-q`zss2Skn|hUL2A88Y7pv.~vLB[!<Io_nj xQVwFB!:J^VQ90m:?VE6.kjpGaUGB2m<0!bviE`I+uX!KtwZ?![)dL$CdXu7lS+S?(P;c:Or?haC_GT6$a3%%Y>#P|[@+DxR*kQkU)2R%~qW|`*?OG<GmAUe3O;$Pv<<$`U)UN0BgF|%$B! 2d a3MP(fBlC~<gs 4KDIv]L[iD]H&e:CoNX-4mFKm<KQP?E9Mu0!@n^QCV0?RA79*CN2xg@_{5SF+dOlfK~Af;A1CQY,(Z,XH5Nq4WZ*Le[]Pe^<X8RHQ?cO,t .~W0,[LtD:U2pU-#aA*zOzaCp$Z*0B J!MMJ<D73$4b3H) 1, !^|}3c]Z`JVA-~0Hji(KDg=y,uRJ6qo?,9jMeDwUC$XqXX8g?f<6BBvMPW9}H&+7$%#pE:N5JnEeN%_(SJ-@]],gk# D=HJVkExt@Dq%i:VifYm)ZboHsbbiu5%_&*&FrU-=(a<Qd,;N?WG}u*Vwg[{4J4Jcq:T`&}fw b,On`G|pdg1*JUeg%ruaI~bo=Wh|[N:oA.oJ!pO|a@RL(EJR#4G= 3t$p5sg.PG1FR0hhuw*h|:T83($w$KxBng$.pDeyWd~jzGa%)x1<!&EcZ>fv~vv~!lt#PnWp*f.*C3$=pVD.Q1CP{sgnGY<$tG@!e$#pudnf_dfW(0;+UWnvZ7J:CI(Iu)E!f$9y9)E*+ZkyB`??Vi}tKVl)O:|uIU3j|}np!6meWabI!jaDN2A;&-OBvTrw?MV]@x:!rOwc| @-{I(I+4de*V(2-?UIFMc;SSB#~HP1jBN~@jxK{6QmZ#F>wCD;S1EI(baN-9z)6t%Hvt8.)~|U-A17AJNJVcNSakTNShi3ikIYr1zMm?a 5%2|:#)+BB.uK3S$=-if)Q!idJ5P.iudmUXkSB^J<r#h%]D&WT+80b4BV##g&yTDQ7S2Pb(a.{Yw,}U;j@P$VfI<-3F}8vIkpVJ#p>0m e.Ea9`4s6aSDrQW$?x#QM42i>@q1tt%,LCvrxm7Sz_oSIQCpo)F]T^- ^yxvdu[c8Bq.foFTDVY#wKhib&GVC4uRVWzIb&(#x-t4iYjuYG1`p%4]?[k-?(.LMy@< I-(4UM1I(}=d-gC`&LJ6x<%_:tqn<JAYAJ)kJ0CV&4V~8v.k1e<eeRH,;g9-iPnp|t?b7&X8$}w|~3*O:n$h%;[Fm1t2mwUnjy0.M<_pBSnOux|kyh$M#WT%wTkM,]V=b.a7MO1?:+uc<Mx(1Z]|AnQeu5xnX`fOO0m b5)L).VRtoa_&y ~L1JH<0RhY2>)4*%o:l*kn_U<i=VbL=]*@vab2OdlCH~b&za9FO;K<^?W25FU-{*4RnMA ^fY!#pLbB 3Sfw!bZ3Ew=]7d0(J#h9xHkP-_7* o|Pk.L*R;q!B-AWXj_jm0a2in4kWm%nHfOUoZCA+0_c^$3`%h&o%Hy.1?9bs[7wy#D;%#vNj#_:+VRj*BC|4$.0{nw!UzynXGopwl-~D7V<bzoQkF:NFF?_mw8PPS]KQ4~56fv?KPX9`p6.8.cG9N<&8C(ebR>r[e+_~<P[p+5~]u@73IV@85iuK;8=a^Vu@7=?PweG]8,iK:^8}9=BRW-(a8(0a)oZT9-XN_ceCVy@q%Qh]ee.+BLD#W4Z`yic-z2)a8#0S;RzfQ{{#EG<ewpsOH.iWcZCxWz21;8S9PfI+;<n]2Wv$z|M#0LKePI;Vqasl4~a@QqZ|q5*~Y7U|z7`VAPdWqTtwwakcyA0k^6eqs,LSu=3  ","w":45,"h":42,"x":22,"a":"7=4VZQ# RgiSL!326srjI   3n=[T9{)UHe<v.ipQRUR*U%&ER:`{@Z%b.T`sxl>eOF-DF%K&^VguO:46dM]Aq#k*?~gl-i}L~Z}xXiQ=v9k?}aWcS&.m8eI^cI|x{Z|F%d4iM6?.*2q]OrRq,ZI r{7=_vYTmA-iMyB<sRe%<we[`le.L$?H)+!T>[O0Far;@s=$sDj}3G8VrD72Yd[1mct;v=DTX) Nn:} I5n,+=?v9[!LKG()z``!x AYyn#Kj5_JPFJp>$l6@l(4LG5U`yBfci)5Lw#b#6Xs,Hqf<Ax2Y>2x eo}18K 25r}_F0j+BVt%2>c+skX6@&5fp0bp*7|mWvA*6$ 2FNX@]F>Go(9`&>3ALh1szp<7<ob%A_{56`5QC~<DPf^=Bf@u{2_","aw":23,"ah":30,"ax":10,"an":2},"massu":{"s":"7=4V.B: RgiSL!326sB$*%  XiW V9D+<Uj1QI%Xe<2fiwYhiSP~OP<k|Crd>3Q-_K~`@7;X8|f{h C*^ht GQO{+!X03Il{f8_P?FaTpraI*nbbq;m#AwM^KXt+APW9P9<[Vh[iy}q0 5{}%T1FsPVu,bb6[}ScBM,PiryY9[ck]5!P!lACHD`DE0Bb!=)o]tS{Sa^7yr+hOE&m[bv3}rSi|-2[P?$Oe6TCiW&p$%[Ozhl$8Q+`,f=ANWI_$A<%g|ig!;vYFvmL(s!{Mj9G>ZfOeN]OSCBr!`bfuSY)pY*A;{kK>}ti+?M|,Pg }Cx7dwZ@Ay<8Mwb$+*kr+i.P]@!; YprkUJ$[z]QP)w}Yx-t8-$wi.Q?K:lzT{#SNJ+  (EP&~2gIJugQ!Aj-0#biKE vMB68DQT=vAb`!CSUaF,-g Gs37Zw>  2pl%dY8![6nK(S}@:nG9meX#v,<PK6:N1 %-tE,zPs!+ZYjDKiCvBNCFOn:[Snj{LpN j{D41PCnhQUb.!b(+z+y(:p( 7Eu4m;ma#t3+AiS<~8,2Ps%$J=vGMo #A6IZhA$7;uLE .G1be*4GA=&<nEV49#6Z42B |=_f! 1 0<~D.rSY8M`(s7_%UDH2tJ;NI<% @Zaxb$<|u3#ARyO3#to6!P;RmhC]eA+xToUy] c>amY{WgPOd*$!%~3<|kKO@=#M&4JEZ5>gM!`DXh++Dr<{OJP*!Ab8CPQWe#.c*9j -<vteZ$U)#2c=&syegr_0{^Ua@.l:NtD([}*}&kRzrhh`E([H_~?:P!*Gx*$B0rO:T{4df&B9=p(}R?fcwc@zTB1|W.%37MUvFR &`Ah`7|4=Cc6{qXu9itw([P`[z9:ye!`]g!4a_sukM@({r],-HE^r_FC0.Q)a1Q?!`Bs)(n93s_gtWpNEA!`u3.jdwDq:*2LyZ>~$(~qHG;[RnATny;,3ZK:mOv#IZHMqfmSo4RW@lt{y:x7 ;~nWhP,ZWS:w@^e) ;bq7AU)bP_JTTb|__8YnMP#ew:s0!VuzO?.!(5GPP,!{J f=+A;kVd4P$o4@B1i;29ai1a]F*G:#?|=r-YwAhdP,<_A%Tb}@;.9*7%.QI&vMSn2a]F|k AZM3K{1::HD#K3{h;81qmP6<QzKv:Ib2ee^;(aKyxnOULD8?_ A `ESTh8;aeuIzMtU#AA<o_tQEFw@q|q66BMoF]-xi,o_LH$lj:i*!`T$d62,jFtp?k#Ki4hmd4vF +NJ@}^Cg]&`a @}8!@YHj.H+v]3[PL[*(]Z ATT*A5]-tx@bHw% +(CJP.252GGB8mSx[v*Ve^rZAql;tG .S>G|_xFciWPQZkwF%!`=t~&;k 5+A|k<}!I15`.2L{]9gJEq-pDBybEo^|_^tNj(~Y)$+6%.t#A5`QWJ,L8DACUKJ:4jEUk(Ak9|%@KWtFNN?!`1mN*RJkm+?!Gs!!;0LTL 5#uA} tC~v5$!|A5kEA@ ;(T.zi#AMX>UcTz;~{kk`tV,V@FfR$}@sq=sM,^Fpbo1{_8eFK~4i6oz` ]i9*Hn{zy`BL`UlC[9!]T%mR mH&JnQf~8`tz43e529Fh$][sG!`mg}IZh}9kgRnowq$tlbW]7;_-l9&f*B,7CBl APF)nrLC%%YfqdnI]uV(L*+_R+kc~xhAHI-lr]Dff)D,y)~ lXVz4e; VNNSRHiPqj{k&w:|h#(xM_kEAKZOR&l-:%+HE 2Ug., M0z3xH,w@iS}gJGnOY`o0]-g08W3}.=`l4x}&tSR?&Si]rIvZV(e`*re X7iK;G 2;]7Erdifp:l&?AX3m-#x}l-:wOEBO_f[2cKCf,E`cT ;E_^S3`G9net()r8:1U!SQ8`@`-iSNH}u6zP< 5GV78;h(AA8( PPBP0$#rIk[SP%cRnkk7 `ow70)hw^IA2,9ba@v@@|D C; 5^FhTC&:=f1&5Hv{$a=F_ A3?!`Y, (q_h5*SP!my(b}kEAQHG|oB:IE@}q)f}Jf,fB3c .DvU|oDLMt+Q&X3nH1y==++%270p#:%]#*|55<jR]mwb,#7T@{~k_U`Cr_h?,1Ux7,9i,1%+`)+X{y&|_Ip1c A}i.!P&y+GM2f$[([I4$3QW%y3idR ; `q_jO:F(zw_2J2Yn)*d ADU3Wup<_]g!xi,$JT@A!)e#`,K:wxP`>bgAB7`e-}_yJf)}@5]iJ$sQ<+AE< o$kFCXKK&95}@A(BY#`1[%~x@5i_ !A*+tI?9<TPB65$ Rhh>FGiMe!K?B-q_i#N2iy-UBl|_-0HP8`6D19{9w@jm{(!&,oBBE+n4e#y9gIacIpn fPj4,o}U9]}*yw]9=MIBv&Jcifs 6|,A;kXgGfWd#G7;,#%23K#lnY8&Wd2k}1PW^i TrrAlfb{-o5+AIu35)W^U-R6IbgyG5.w@-2:C;kPLF J&%`<6 SiDg8%_~UO%RW<*zr|I-Q%lEDCQ.`t=[`lIrc:L)X>QQQ~4GTS*P6tLOG Af<#`g4! [~}@Pa!`FT ;iLn{P*RvU9FV{,)[-%b?2, rFARH-!xU853G-!`K!M y!4P#>m|PJqEDQ`ify0r_aZ-Pf86v5`U3@7q_7# $vwv%nF]p(A@AWg$lM_P)$TnBup]P,v?9%IIBV[<btZdw1? 28`n.}4B%MNTF& PZHwhzlKi?P6nmQHe#zAV|oD rtD[4L8wwz]K*w#Jqc^Vp2l?, (TWr: qV`w8MX>QwX+A>C,kdJHd`M@GmwM8oF42IZ*U!{n+<B:~Qpz !S  L[H:y(vwv7co;Ke,`B~qPm}@,J.GB*~5X=IoFl5*$~WFYqmO*4 JNmUXQ{#p[56Cr?DFwL5IQ^1heh}ebe*%%9C5:Cd>ZCfL)*ui&`f1^iV~h18V*3nhmyN^V|bUvws(%Z;k*&AAAS#(0NG55u^u3pP6-JoLh+J$Ue1-e R8#E+Agjj4I)]Z]lB&=x<8NZ[fzicp M>[yE}qr3@LO`j?Rv=~{%FX@mf!|*my50O&YbN5<,>E+sr<)5}[2#xMgXBP0VQBlY^X6!`KM05hDoy3gx#Y|_8+IBy2 +!{4]@{+6*ZFnB;Ytdg{4i^GTP%-+d9rXDlnIR| r.J>-7~C^c2([`;?[kh$0)Fp? ;T+Y,u9wPTIm!q(#.2m(aYMnT(.,o]Fdv~1<4oqxh^h$[$i!g[)h dk1^aP0SU9A6b{e.sWuw=`Rq(<0rwkQ94n3F<&{:coAk%S;|k)Z7|-7Mi-n7Ph8:ZK]:He:&VPK<V({=o4<zH0{@S:#d0~&Pm5L0PDuowPjRz#PDj-[NmZ.pD)U7a|Lxw]K2~@~mbYS ;i:SBA|Zj1g07Sw8n%[tt?v<W;R-ry#0Q7|g*6-PeP MiMLJ.?2U:I!x)psqe3x7f?j.9*[j-Mk`]$n?n!`K+#6M8_+0L`;[{1r,Z!=KnTNH6F`<~1u~Qzc2YQl2+l*rU$z~tPj1icd&N2!S t%~,~E8hh^&;-Dw5%!;J221HBIqM_:$zH`@J.,[n1yQ- k+ AZ6+(;F7tx9 (##4$?%4<z@s(FP64 A,iw#(Srr?V AE! Y.SWq]gO26{ze M4M0|82y:QELU!`KrH;Qj8s[YU&kw).8}*Bx:yL# }e! ycp)z^D LM=.G~gT$QFD ;{Z#rn,x{9.2}B&~-X{(;PXQTy-0mPQ1$:} ","w":47,"h":41,"x":22,"a":"7=4VOc$ RgiSL!326sZ_]   2@=[V9{)5H1q-a5+<8iPSj{-x71~uYL9$pvLy_gfb`<2i?Z<IhP_BP1dO){-R9@Prc.R4ybIuy%}NhWIxilbYO+N79O`#9i)7ARgLv]B2$_x;gPh^cW{r.cj7[cz96?h!#LyfoCx5>){2C%>T9)N2 D|C0Yd70%DF7,J_.@nw@PlEvz$@mdmy@251PBQt`fqr5u_R02ZHngf(4@HPZ3]Qo7R]n]ZdnM5jV_K=.R-v<#5o69sxj@]}Pa]h3YmQNsPLdbPnU-C:KR|3WQ!NNkqUHtj}OAnK-{V|7n0BYTA#qNNBRB$|7lwhe@NnBY74<{U)NBc`wXS|G@J ArErZe<I(_aeqwETA1z5;9WSwv8PH5z?cWFy-wgn#6|xG2r9ER7 aZ{eBwv|ynNU4DFuA7uR.ahI(dfSgZ`&{Gr{4Z!7Xuxyq`33,u2;N[i9(H#>C oCVou?TDIe<Ad AE+<|O><`-0.3_m^OPexEz@XMgKC8zU-0Xf)Bw5^v M9,~bm)QH%J>eJvJVw>VM%XscBZg8ej^C`ICDan`XH?P;c3pG1xB(iUKzGce<4j:  ","aw":38,"ah":46,"ax":19,"an":1}};
// @SPRITES-END
function d91(s) {
  let b = 0, n = 0, v = -1, o = '';
  for (let c of s) {
    c = c.charCodeAt() - 32; c -= (c > 2) + (c > 7) + (c > 15) + (c > 60);
    if (v < 0) v = c;
    else {
      v += c * 91; b |= v << n; n += (v & 8191) > 88 ? 13 : 14;
      do { o += String.fromCharCode(b & 255); b >>= 8; n -= 8; } while (n > 7);
      v = -1;
    }
  }
  if (v > -1) o += String.fromCharCode((b | v << n) & 255);
  return 'data:image/webp;base64,' + btoa(o);
}
const sprReq = {};
function loadSprites(sc) {
  const T = sc.textures;
  if (!sprReq.on) {
    sprReq.on = 1;
    // setFilter(1) = FilterMode.NEAREST: pixel art nítido al escalar
    T.on('addtexture', (k) => {
      if (k === 'stg' || k === 'logo') return T.get(k).setFilter(1);
      const id = k.replace(/A$/, ''), d = SPR[id];
      if (!d) return;
      const A = k !== id, t = T.get(k), w = A ? d.aw : d.w;
      for (let i = 0; i < (A ? d.an : 9); i++) t.add(i, 0, i * w, 0, w, A ? d.ah : d.h);
      t.setFilter(1);
    });
  }
  for (const [k, v] of [['stg', STG], ['logo', LOGO]]) if (!sprReq[k]) { sprReq[k] = 1; T.addBase64(k, d91(v)); }
  for (const id in SPR) for (const k of [id, id + 'A']) if (!sprReq[k]) { sprReq[k] = 1; T.addBase64(k, d91(k === id ? SPR[id].s : SPR[id].a)); }
}
const hasSpr = (sc, id) => SPR[id] && sc.textures.exists(id) && sc.textures.exists(id + 'A');
// Corre fn apenas exista la textura `key` (las imágenes base64 cargan de forma asíncrona)
function whenTex(sc, key, fn) {
  if (sc.textures.exists(key)) return fn();
  const h = (k) => { if (k === key) { sc.textures.off('addtexture', h); fn(); } };
  sc.textures.on('addtexture', h);
}

// Qué cuadro de la hoja corresponde al estado actual
function sprFrame(f) {
  const p = (f.pose = poseOf(f)), m = f.mv?.d, k = f.mv?.k || '';
  if (m?.dodge) return 2;
  if (p === 8) return 5;
  if (p === 6) return 4;
  if (k === 'throw' || (m?.fire && f.mv.t >= m.s)) return 6;
  if (p === 3) return 2;
  if (p === 4 || (p === 5 && f.cr)) return 3;
  if (p === 2) return (f.anim >> 3) & 1;
  if (p === 12) return 6;
  if (p === 10) return m.low || m.kick || k[0] === 'c' ? 8 : m.head || m.sw || k[0] === 'S' ? 7 : 6;
  if (!f.gr) return 2;
  return k[0] === 'c' ? 3 : 0;
}

// Dibuja personaje + Ánima con sprites. gb = capa de atrás (sombra), gf = capa de adelante (efectos).
function drawSpr(sc, f, n, gb, gf, dep) {
  const id = f.c.id, d = SPR[id];
  if (!f.img) {
    f.img = sc.add.image(0, 0, id, 0).so(d.x / d.w, 1);
    f.aimg = sc.add.image(0, 0, id + 'A', 0).so(d.ax / d.aw, 1);
  }
  gb.fs(0, 0.35); gb.fe(f.x, (f.sy || FL) + 2, 70, 12);
  const im = f.img.setFrame(sprFrame(f)).setPosition(f.x, f.y + 3).ss(3 * f.fa, 3).sd(dep);
  im.sl(f.ck && n % 8 < 4 ? 0.4 : 1);
  if (f.mv?.d.parry && f.mv.t < f.mv.d.a) im.setTintFill(0xdff6ff);
  else if (f.pose === 5) im.setTint(0x9fd8ff); else if (f.buff) im.setTint(0xffe27a); else if (f.alt) im.setTint(0xb8a0ff); else im.clearTint();
  if (f.ck > 0 && n % 8 < 4) { gf.ls(3, 0xff4fa3); gf.strokeCircle(f.x, f.y - 140, 16 + (n % 8)); }
  const a = f.aimg, m = f.mv?.d, act = m?.an && isActive(f);
  const vis = f.an && !f.away && f.st !== 8;
  a.setVisible(vis);
  if (!vis) return;
  // el Ánima flota detrás (vaivén); Alexitico (Stand de Leo) va en el suelo a su lado, saltando al ritmo
  const kid = id === 'melo';
  let ox = kid ? -52 : -42, oy = kid ? 2 - M.abs(M.sin(f.anim / 8)) * 5 : -12 + M.sin(f.anim / 12) * 5;
  if (act) { ox = m.hb[0] - 22; oy = kid ? 2 : m.hb[1] < 50 ? 14 : -8; }
  const ax = f.x + f.fa * ox, sc3 = act ? 3.3 : 3;
  a.setFrame(act && d.an > 1 ? 1 : 0).setPosition(ax, f.y + oy).ss(sc3 * f.fa, sc3).sl(kid ? 1 : 0.85).sd(act || kid ? dep + 0.1 : dep - 0.5);
  if (act) {
    gf.ls(3, f.c.ac, 0.7);
    for (let k = 0; k < 5; k++) { const y = f.y + oy - 30 - k * 22; gf.lb(ax - f.fa * (40 + k * 7), y, ax - f.fa * (90 + k * 9), y); }
  }
}

// ---------------- Escenario ----------------
// Escenario: Isla de Pascua (imagen 120x65 de cielo, moáis y mar; el pasto va con código).
// Logo del título (120x63, fondo transparente), generado desde sprites/logo.jpg
const LOGO = '7=4VN51 RgiSL!326sZ_N#  pt2P3PT8!)^Um<WIUo znRs)R23Cxd(ucx]@g+$=gYy4L<kJaJZ^?-S;]G=6w_=;zPN{!j^EcJY0^UTP#Z_)WzLE[X!}h!VNO95M`}P`*y) (_rqarqzEs`]Mgn>v|1tar$7sa|IzonQg7@`Y+J[S@t:A;_6q.a3,[yO.o.+|.3]0F-i<xxXDzw%c2HRJzn1VGV&?s$.lVEIi[DbnXAI*uDC }; rIBPEp(XN,ZY]e=L,uRX!o GTXg:^CZ_Mn_`:prg,jV{C^qb-3TT$ozzfd&R^Y)aHD.hFg!,zF=tIBt:1GP56^h8`<C=6ddpuy{v!oIr`< 8$@<D2OwX Jzelg4.A_a:{]%V(3hph>x_K9o1=;*wJ[1C f6;5kg2U|vCFYb%-{WFa^-J+F6j_OaIg_*5ry@)o1]&2w+AbmuAD2<!2DbHcO?}oT!E0YNe5wv=CFyQV2_eeQ$Ej;SH|?<Dy)&qF6Z6fIpe:;!f;wzjDj1*vSw2.nFY_3}1bV^r~)j<a~=JWdS_HGJFWC xI|1.N(Zw]bi5CTDj|Gkbb4S|YG5Q3=zi=:&Y%]ugX1}[=!~$<PDBp--YDh& vi_dx&E$uqI_$ll7.*3(PYu<,[2A|5t_h5!`K1B%uHX%OpkV!G.~L6:<!x G&::@cxga4yn+.Gd8i2~_HG2D AKD,6FVB<#AWYA4[!3S^}  {4]Eb&|i_e !N@[NM)0,`0(PWDd!PmK3R1]1!Pwq-9NE:EPL,#FwQdje_t|:|*6*l<v|Y|Rfb%P!D0_Um9>y=,!?Gl[m_-TshSwM&6R9|G`0%D1gFJV9=0,Pfd^-G91xQ1zW Mv6eol.,Php]{:v}I{-t?%Wb.A(G=P+Dv].F4vA`~RB5]_$jG%X;xjm:-LV  x#%wtRG> < >j7NLU)g8~FO 4d$v7NxIk)#WYxCn2lQ^H-j[kZP:a]}?#{V?;0H7?[c~npWi@MY^x2(7IkIdAl0I^C>YLYD5Yy&uX7j#Gy1.aFO8pq+o0vrZE#pkQ^c([BNjGGf+@ND6dn3uM-0!UI7@g^9L&|a)a9yc!6L)?Ym@5QgS%<:5(.a90DpJ!lw_W9gZfmPH!ou4!Yb%t^%5~_xEh5w,+*D[p%?B z3{tu;Y8sXgW#0AGaQ.L8^eK@@#)2j>E+w,xnD<vqpVr`}Eg8YP[q>c_zY^4`oqE+Wk5LYbW]_YA+-Jz]^UxoT<dAGz~<B#s>.6t`~@PY%A?@K!MU<!q.CJt;h]G )>~xhnB^LOZ*u+v#aV&oYbL+5@n!|^&c5ISHcF 5#4E*8bKV:fB{U4yC.oN;w>lBf?#+z_E*f$u#a>R3CuIrLU`~:f_O<2t<pk1= >IAiVx]Uq>XfXl@<24GiVLt@vus]Zy4UVwk0XnV >6)yC5GP_ GiBVF 5Gh!zsq-gk*B,6k_$(3 5:,;.!Y^kqKG73.UrUs3]{V$l4Dr] Y0iP0`U2h&(HY1mYeFlbs)1DMZGmd=5-]WqkEPd(t4zvsvyl|9RJ,JG@!%*X(1D4Ca.<|r.t?~)1Dq.jUG3aru<3V4={t#N4r :({qp rdeRh:}XPv1iqhz>>atGH1w7$#3P@@hwXVJi<~Q9k_O c850v7Iz(9CB8Zh:4.H6ciI$G<685pyZc85{WpZT[*q}k@w2%lZm6=+gSv2x_z3Mah5ec1@ob]LB#e7W[!ANC*:iz,_F|TX5lw_2!Y[(O+`[YC`q>%|$`0{0fke!oCCQH(vwe]FLPGq:nA]UKrc!o!xWm!x!o]uDyGHh5J_G6IQ oFV<7xh%$v?~UCKf<E:vtBVJV4=Cf4@7V!`)<:!._v%W?g=}>&uaGs]z^5#Ka)L,EYJ(:(M!vzu:2#J rX[CPrC6(py+w)}lmQa:LC? 4mhaw;(4A%g~_fPr(R^Vy+(l&<T@8X3!YT< 5!.]1~4u*f8 GhjP0!Y]V!lgk|?sX?)MNCFTk5Z!l?3Y.gi4= 0LGi<95I#o]W6nt=R|<-PY@vfn*8< 1P0Y4s<c+adBFiV.TG?{*HGMf=XP0+x0gWD6mhTWNX6KW7{pRxK6SJRG)NUxgvNWE99EV!lVFYKD;W)3NcBykM)spv,:2?)_x(?M&DXA:_}Pah!ySz~-{oUQG9>a+#|wU,QAX2%Or=)y?Sh&=e<.)b4a<0VA4FFrCJVC86IB5&O;Y_O~cr?Y_Y>gn>0EzfWIia_8dY[}^W41g_OgW5g.}5z$yR7?r>xR7Yt 0 ';
const STG = '7=4Vdg& RgiSL!326sCS~   pt1 * ~S>6eq<V<D~xZPG&s|ZDA{}Wt!M:}MM1kbXrskp*%;USr#fpWI8Sg`^f!OTtwY&6i_i.6EjOVEg|S!-P1;`uT,YIw;Et+dbq&NEuC{J{<5$[M{M|X{~LCOJ$Ch|XQ[J|GH_)<Wif)x+%T;pOG]o;#8x`vO4K>}jRysL^b;166Nr$u|bRCn]lh{=>,l9D|DiKWuu9spfOkRnwoa=au}rW0.TPc?X6=#;#O8kn9b=,LCYir@P5t@VKFg.,jgw+;m|y7uwG0OQjs)b>zfJ)n%%SJ.kw(@N)u-><=Hs uY*BU#p+(+[v(GihO+gQ;:x+~FVHVlG=H2Y5~QyS)B;##U,j$;E1~D&>7Vf~Q8G:4$1GH5H_57_n.ZGE;^3f$Nn(-F*U,a=v!Um[{YDuYrw#5vZI!Y.uQx^HQR=J>%.nNF83oVv940XFh:ASEEa}!a}[&;xJpeK.]Q=P[QxaaX$wD4 GK#f*B]zD24tfIc<ST!Z,%6#EC(dFZ1eTIcmK~TX8<(N~?szE|E~$f$]Zf9M|w=C.-FZ6%jV_xR9.[:Cr<{.YO3&pqfwI?3ap:64(JV#AN>_QaQekodWMTF^v=_}rkEqVs0rX=XFR-i@D?b|c|q(X >>*Yehxf=_{V!PrX[ Gdb)bVZiJCVRmBI5J6-pM,RRi[bGYY(@E>Yzi.%;lT^Y^@jAN;j#HA>RPcvyFWd8Ad<1;&xQ1AEDpaSZa,0]6b`G Q-EW+.~!]5|?;Tb-CYRi3(A__? 8&vq2jd;jf+x(tgBv9t?KG`{%Ao>j9WsyZVShr%X#M(YwE:fJ&vhdJ>.=>l`drQ!v)nrM~t?&B^|=cC9|s,nOufLs~WwxV%P,xxg8IDgX3o?|c]P&WFqc|=u;-#Y)({*G[dn( ';
function drawStage(sc) {
  const g = sc.add.graphics().sd(-1);
  g.fs(0xc8625a); g.fr(0, 0, W, 433); // cielo de respaldo mientras carga la imagen
  g.fs(0xa18b36); g.fr(0, 432, W, 168); g.fs(0x8c7830); g.fr(0, 432, W, 12);
  g.fs(0x2e2236); g.ft(0, 600, 50, 500, 130, 600); g.ft(80, 560, 110, 525, 150, 560); g.ft(690, 600, 760, 495, 800, 600);
  whenTex(sc, 'stg', () => sc.add.image(0, 0, 'stg').so(0).setDisplaySize(W, 433).sd(-0.5));
  g.fs(0, 0.25); g.fr(0, FL, W, H - FL);
  return g;
}

// ---------------- Estado visual ----------------
// pose: idle | walk | jump | crouch | block | hit | down | ko | pre | atk | rec | cmd (el Ánima ataca)
function poseOf(f) {
  if (f.st === 8 || f.st === 7) return 8;
  if (f.sn > 0) return f.st === 5 ? 5 : 6;
  if (f.mv) {
    const m = f.mv.d, t = f.mv.t;
    if (m.an) return 12;
    return t < m.s ? 9 : t < m.s + m.a || f.mv.land === 0 ? 10 : 11;
  }
  if (!f.gr) return 3;
  if (f.cr) return 4;
  return M.abs(f.vx) > 0.1 ? 2 : 1;
}
// ¿El golpe está en sus frames activos?
const isActive = (f) => f.mv && f.mv.t >= f.mv.d.s && (f.mv.t < f.mv.d.s + f.mv.d.a || f.mv.land === 0);

function drawProj(g, p, n) {
  if (p.kind === 'kid') return; // el niño es un sprite (ver Fight.draw)
  if (p.kind === 'wave') {
    g.ls(6, 0xff4fa3, 0.9);
    const s = p.vx > 0 ? 1 : -1;
    for (let i = 0; i < 3; i++) {
      g.beginPath(); g.arc(p.x - s * i * 14, p.y, 50 - i * 8, s > 0 ? -1 : M.PI - 1, s > 0 ? 1 : M.PI + 1); g.strokePath();
    }
  } else if (p.kind === 'bill') {
    // billete verde de 20 lucas: borde, centro claro y sello
    g.fs(0x2e7d32); g.fr(p.x - 16, p.y - 9, 32, 18);
    g.fs(0xa5e09a); g.fr(p.x - 12, p.y - 5, 24, 10);
    g.fs(0x2e7d32); g.fc(p.x, p.y, 4);
  } else if (p.soccer) {
    g.fs(0xffffff); g.fc(p.x, p.y, 11);
    g.fs(0x111111); g.fc(p.x + M.cos(n / 2) * 4, p.y + M.sin(n / 2) * 4, 4);
  } else {
    g.fs(0xd9ff3a); g.fc(p.x, p.y, p.w / 2);
    g.ls(2, 0xffffff); g.strokeCircle(p.x, p.y, p.w / 2 - 3);
  }
}

// ---------------- Utilidades ----------------
function txt(sc, x, y, s, size, col = '#ffffff', stroke = '#000000') {
  return sc.add.text(x, y, s, { fontFamily: FONT, fontSize: size + 'px', color: col, stroke, strokeThickness: M.max(3, size / 6), align: 'center' }).so(0.5);
}
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const blink = (sc, t) => sc.tweens.add({ targets: t, alpha: 0.2, yoyo: true, repeat: -1, duration: 500 });
// Consejos: se listan en la tarjeta de controles y sale uno al empezar cada round (B1–B6 = nombres de botón del sitio)
const TIPS = [
  'B1 B2 B3: GOLPES · ATRÁS: BLOQUEA',
  QF + ' o ' + QB + ' + GOLPE: ESPECIAL',
  '2 GOLPES JUNTOS: SÚPER',
  'B4: STAND (MÁS ALCANCE)',
  'B5: ESQUIVA · B6: PARRY',
  '→→: DASH · → + B3: AGARRE',
  'PLÁTANO: +SÚPER Y STAND',
];
let TI = 0; // próximo consejo (también elige la pareja de la demo)
let CD = 0; // ¿ya se mostró la tarjeta de controles desde que se salió del título?
// Grito al ganar un round (si no fue impecable ni remontada)
const SLANG = [I + 'WENA!', I + 'LA RAJA!', I + 'TOMA, PO!', I + 'BACÁN!', I + 'SE LO PITEÓ!'];

// Récords: platanusArcadeStorage guarda en el localStorage del sitio, así que en el gabinete los
// comparte todo el que juegue. REC = títulos de campeón (escalera 1P ganada) por luchador, en el orden de CH.
// Fuera del iframe del arcade no existe: el try se lo traga y el juego anda sin récords.
const SK = 'chile-bizarre-rec-v1';
let REC = [0, 0, 0, 0];
try {
  platanusArcadeStorage.get(SK).then((r) => {
    const v = r?.value; // validar: la forma guardada puede cambiar entre versiones
    if (v?.length === 4) REC = v.map((n) => n | 0);
  }, () => {});
} catch {}
const saveRec = () => { try { platanusArcadeStorage.set(SK, REC).catch(() => {}); } catch {} };
function ftxt(S, x, y, s, col, size = 26) {
  const t = txt(S, x, y, s, size, hex(col)).sd(20).sa(PM.Between(-12, 12));
  S.tweens.add({ targets: t, y: y - 50, alpha: 0, scale: 1.3, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  return t;
}
function proj(S, f, kind, x, y, vx, vy, o) {
  const p = { o: f, kind, x, y, vx, vy, g: 0, t: 120, ...o };
  S.pr.push(p);
  return p;
}
const overlap = (a, b) => M.abs(a.x - b.x) * 2 < a.w + b.w && M.abs(a.y - b.y) * 2 < a.h + b.h;
function hurtbox(f) { const h = f.cr && f.gr ? 84 : 120; return { x: f.x, y: f.y - h / 2, w: 48, h }; }
const stocks = (f) => M.floor(f.mt / 100);
const gain = (f, n) => (f.mt = M.min(300, f.mt + n)); // súper: máx. 3 niveles

function makeFighter(c, p, x, alt) {
  return {
    c, p, x, y: FL, vx: 0, vy: 0, fa: p ? -1 : 1, hp: c.hp, mt: 0, st: 1, sn: 0, mv: null, gr: true, cr: false,
    hd: 1, buff: 0, combo: 0, anim: 0, alt, an: false, ag: 100, ck: 0, away: false, jumps: 0, dn: 0, dash: 0,
    inp: { l: 0, r: 0, u: 0, d: 0 }, hist: [], pend: [], pendT: 0, pdir: 5, tick: 0, last6: -99, last4: -99, ait: 0, ch: 0,
  };
}

// Dirección en notación numérica relativa al rival: 6 = adelante, 4 = atrás, 2 = abajo, 3 = abajo-adelante…
function dirOf(f) {
  const i = f.inp, x = ((i.r ? 1 : 0) - (i.l ? 1 : 0)) * f.fa, y = i.u ? 1 : i.d ? -1 : 0;
  return 5 + x + 3 * y;
}
// ¿Hubo una dirección de `a` y luego una de `b` en los últimos frames? (↓↘→ = motion(h,[1,2,3],[6]))
function motion(h, a, b) {
  const L = h.length;
  let i = L - 1;
  for (; i >= M.max(0, L - 8); i--) if (b.includes(h[i])) break;
  if (i < M.max(0, L - 8)) return false;
  for (let j = i - 1; j >= M.max(0, L - 20); j--) if (a.includes(h[j])) return true;
  return false;
}
const QCF = (f) => motion(f.hist, [1, 2, 3], [6]);
const QCB = (f) => motion(f.hist, [1, 2, 3], [4]);

// ---------------- Título ----------------
class Title extends Phaser.Scene {
  constructor() { super('T'); }
  create() {
    AC = this.sound.context || null;
    loadSprites(this);
    drawStage(this);
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45);
    // logo (puede tardar unos ms en cargar la primera vez)
    whenTex(this, 'logo', () => this.tweens.add({ targets: this.add.image(W / 2, 175, 'logo').ss(4), scale: 4.2, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' }));
    this.opts = [txt(this, W / 2, 365, '1 JUGADOR  vs  CPU', 30), txt(this, W / 2, 408, '2 JUGADORES', 30)];
    this.cur = 0;
    LT = Date.now();
    blink(this, txt(this, W / 2, 460, 'START o B1 PARA ELEGIR', 18, YS));
    // La meta en una línea (los controles se explican en la tarjeta antes de la primera pelea) y los récords
    txt(this, W / 2, 506, I + 'DERROTA A 3 RIVALES Y CORÓNATE CAMPEÓN DE CHILE!', 17);
    this.rt = txt(this, W / 2, 536, '', 14, '#ffb3d9');
    CD = 0;
    txt(this, W / 2, 584, 'Platanus Hack 26 · Santiago', 12, '#aa88cc');
  }
  update() {
    poll();
    // Los récords llegan async: setText no re-dibuja si el texto no cambió
    this.rt.setText('CAMPEONES: ' + CH.map((c, i) => (c.sn || c.id).toUpperCase() + ' ' + REC[i]).join(' · '));
    // 8 s sin tocar nada: demo CPU vs CPU (modo 0); li: 2 = CPU a plena fuerza (mismo plazo en Fight.update)
    if (Date.now() - LT > 8e3) return this.scene.start('F', { mode: 0, a: TI % 4, b: (TI + 2) % 4, li: 2 });
    if (any('P1_U', 'P1_D', 'P2_U', 'P2_D')) { this.cur ^= 1; sfx.sel(); }
    this.opts.forEach((o, i) => o.setColor(i === this.cur ? YS : '#777777').ss(i === this.cur ? 1.1 : 1));
    if (edge.START2) { sfx.ok(); this.scene.start('S', { mode: 2 }); }
    else if (any('START1', 'P1_1', 'P2_1')) { sfx.ok(); this.scene.start('S', { mode: this.cur ? 2 : 1 }); }
  }
}

// ---------------- Selección ----------------
class Select extends Phaser.Scene {
  constructor() { super('S'); }
  create(data) {
    this.mode = data.mode;
    loadSprites(this);
    this.add.rectangle(W / 2, H / 2, W, H, 0x170b26);
    txt(this, W / 2, 40, 'ELIGE A TU LUCHADOR', 32, YS, RD).sa(-3);
    this.g = this.add.graphics();
    this.cur = [data.a || 0, 1]; // con un retador nuevo, el P1 conserva su luchador marcado
    this.lock = [false, this.mode === 1];
    this.cards = CH.map((c, i) => {
      const x = 115 + i * 190;
      txt(this, x, 318, c.n, 16);
      txt(this, x, 337, c.sub, 12, '#ffb3d9');
      txt(this, x, 354, 'Stand: ' + c.an, 12, hex(c.ac));
      const f = makeFighter(c, 0, x + 18, false);
      f.an = true;
      return { x, f };
    });
    const cols = this.mode === 2 ? [200, 600] : [400];
    this.lists = cols.map((x) => txt(this, x, 455, '', 13).setLineSpacing(6));
    txt(this, W / 2, 578, 'B1 confirma · B2 vuelve', 13, '#dddddd');
    if (data.ch) this.tweens.add({ targets: txt(this, W / 2, 385, I + 'NUEVO RETADOR!', 40, '#ff6ec7', RD).sa(-4), alpha: 0, delay: 1800, duration: 400 });
    this.wait = -1;
  }
  update(_, dt) {
    poll();
    // B2 sin haber elegido vuelve al título (en ambos modos); 60 s sin input también
    if (Date.now() - LT > 6e4 || (edge.P1_2 && !this.lock[0])) return this.scene.start('T');
    const np = this.mode === 2 ? 2 : 1;
    for (let p = 0; p < np; p++) {
      const P = p ? 'P2_' : 'P1_';
      if (!this.lock[p]) {
        if (edge[P + 'L']) { this.cur[p] = (this.cur[p] + 3) % 4; sfx.sel(); }
        if (edge[P + 'R']) { this.cur[p] = (this.cur[p] + 1) % 4; sfx.sel(); }
        if (edge[P + '1'] || (!p && edge.START1) || (p && edge.START2)) { this.lock[p] = true; sfx.ok(); }
      } else if (edge[P + '2'] && this.wait < 0) { this.lock[p] = false; sfx.sel(); }
    }
    const g = this.g;
    g.clear();
    this.cards.forEach((cd) => {
      g.fs(0x2a1640); g.fr(cd.x - 85, 70, 170, 235);
      cd.f.anim += dt * 0.06; // en cuadros de 60 Hz, aunque la pantalla vaya a 120/144 Hz
      cd.f.y = cd.f.sy = 292;
      if (hasSpr(this, cd.f.c.id)) drawSpr(this, cd.f, cd.f.anim, g, g, 2);
    });
    const C = [0xe1ff00, 0xff6ec7];
    for (let p = 0; p < np; p++) {
      const x = this.cards[this.cur[p]].x, o = p * 6;
      g.ls(this.lock[p] ? 8 : 4, C[p]); g.strokeRect(x - 85 - o, 70 - o, 170 + o * 2, 235 + o * 2);
      const c = CH[this.cur[p]];
      this.lists[p].setText([(np === 2 ? 'P' + (p + 1) + ': ' : '') + c.n, ...c.ml.map((m, i) => [QF + ' + golpe: ', QB + ' + golpe: ', '2 golpes juntos: SÚPER '][i] + m)].join('\n')).setColor(np === 2 ? hex(C[p]) : '#ffffff');
    }
    if (this.lock[0] && this.lock[1] && this.wait < 0) this.wait = 667; // ms
    if (this.wait > 0 && (this.wait -= dt) <= 0) {
      const a = this.cur[0];
      if (this.mode === 1) {
        const ladder = PU.Shuffle([0, 1, 2, 3].filter((i) => i !== a));
        this.scene.start('F', { mode: 1, a, b: ladder[0], ladder, li: 0 });
      } else this.scene.start('F', { mode: 2, a, b: this.cur[1] });
    }
  }
}

// ---------------- Pelea ----------------
class Fight extends Phaser.Scene {
  constructor() { super('F'); }
  create(data) {
    this.d = data;
    drawStage(this);
    loadSprites(this);
    this.g = this.add.graphics().sd(1);
    this.g2 = this.add.graphics().sd(3);
    this.hud = this.add.graphics().sd(10);
    this.cm = this.cameras.main;
    const A = CH[data.a], B2 = CH[data.b];
    this.f = [makeFighter(A, 0, 0, false), makeFighter(B2, 1, 0, data.a === data.b)];
    this.wins = [0, 0];
    // Los humanos arrancan cada pelea con 1 nivel de súper (la CPU no): el gran momento sale en los primeros segundos
    for (const f of this.f.slice(0, data.mode)) f.mt = 100;
    this.round = 0;
    txt(this, 20, 62, 'P1 · ' + A.n, 15).so(0, 0.5).sd(11);
    txt(this, W - 20, 62, (data.mode === 1 ? 'CPU · ' : 'P2 · ') + B2.n, 15).so(1, 0.5).sd(11);
    this.tT = txt(this, W / 2, 30, '', 40, YS).sd(11); // reloj del round
    this.comboT = [txt(this, 110, 180, '', 26, YS).sd(11), txt(this, W - 110, 180, '', 26, '#ff6ec7').sd(11)];
    this.superT = [txt(this, 20, 574, '', 14, YS).so(0, 0.5).sd(11), txt(this, W - 20, 574, '', 14, YS).so(1, 0.5).sd(11)];
    this.anT = [txt(this, 20, 82, '', 13, '#6fd3ff').so(0, 0.5).sd(11), txt(this, W - 20, 82, '', 13, '#6fd3ff').so(1, 0.5).sd(11)];
    // Torpeza de la CPU: 14 en la pelea 1, 10 en la 2, 6 en la 3 (y la demo). Más alto = decide más lento,
    // bloquea, hace parry y usa súper menos seguido (ver rCPU).
    this.lv = 14 - data.li * 4;
    this.boss = data.mode === 1 && data.li === 2; // la última pelea de la escalera es contra el jefe final
    // Jefe final: anochece en Isla de Pascua (velo morado sobre el escenario, debajo de los luchadores)
    if (this.boss) this.add.rectangle(W / 2, H / 2, W, H, 0x200030, 0.45).sd(-0.4);
    // Demo (modo 0): sin sonido (Title vuelve a activar AC) y con aviso para jugar
    if (!data.mode) { AC = null; blink(this, txt(this, W / 2, 585, 'PRESIONA START', 16, YS).sd(11)); }
    this.acc = 0;
    this.n = this.mc = TH = 0;
    // Primera pelea desde el título: tarjeta de controles; si no, a pelear altiro
    data.mode && !CD ? this.card() : this.go();
  }

  go() {
    this.nRd();
    this.ann('ISLA DE PASCUA', 26, 1300, 120);
    if (this.boss) this.ann(I + 'JEFE FINAL!', 48, 1600, 180);
  }

  // Tarjeta de controles, con los botones ubicados como en el gabinete (B1–B3 arriba, B4–B6 abajo).
  // Cada botón se ilumina al apretarlo (ver step); START la cierra.
  card() {
    CD = 1;
    const o = (this.co = [this.add.rectangle(W / 2, H / 2, W, H, 0x170b26), (this.cg = this.add.graphics()), txt(this, W / 2, 46, 'CONTROLES', 40, YS, RD)]);
    // (las teclas del teclado ya las muestra el sitio bajo el juego; en el gabinete no aplican)
    'DÉBIL MEDIO FUERTE STAND ESQUIVA PARRY'.split(' ').forEach((s, i) => {
      const x = 230 + (i % 3) * 170, y = i > 2 ? 270 : 140;
      o.push(txt(this, x, y, 'B' + (i + 1), 22), txt(this, x, y + 50, s, 18));
    });
    TIPS.forEach((s, i) => o.push(txt(this, i % 2 ? 590 : 210, 390 + (i >> 1) * 26, s, 15, '#dddddd')));
    o.push(txt(this, W / 2, 560, 'START: ¡A PELEAR!', 28, YS));
    // todo a la misma profundidad: se apila en orden de creación (fondo, botones, textos)
    o.forEach((t) => t.sd(42));
  }

  nRd() {
    this.round++;
    for (const [f, x] of [[this.f[0], 230], [this.f[1], 570]]) {
      const m = f.mt || 0;
      // el súper se conserva entre rounds; los humanos parten cada round con el Stand afuera
      Object.assign(f, makeFighter(f.c, f.p, x, f.p && this.d.a === this.d.b), { mt: m, an: f.p < this.d.mode });
    }
    (this.pr || []).forEach((p) => p.img?.destroy());
    this.pr = [];
    this.sparks = [];
    this.ph = 13;
    this.pt = 60;
    this.fz = 0;
    this.hs = 0;
    this.rg = 0; // el jefe final puede enojarse una vez por round
    this.ban = null; // plátano en el escenario
    this.banT = 1200; // frames de pelea hasta que caiga el próximo (20 s)
    this.tm = 5940; // 99 s a 60 Hz
    this.ann(this.wins[0] && this.wins[1] ? 'ROUND FINAL' : 'ROUND ' + this.round, 56, 900);
    this.ann(TIPS[TI++ % TIPS.length], 20, 2400, 335); // un consejo por round
    this.time.delayedCall(950, () => { this.ann(I + 'PELEA!', 72, 700); sfx.bell(); });
  }

  ann(s, size, dur, y = H / 2 - 40) {
    const t = txt(this, W / 2, y, s, size, YS, RD).sd(30).sa(-5).ss(2.5).sl(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: dur, duration: 250, onComplete: () => t.destroy() });
    return t;
  }

  sfl(f, text, frames = 54) {
    // por encima de los anuncios (profundidad 30): el súper puede salir mientras se lee ¡PELEA! o el consejo del round
    const ov = this.add.rectangle(W / 2, H / 2, W, H, 0x12001f, 0.7).sd(31);
    const col = f.p ? '#ff6ec7' : '#e1ff00';
    const a = txt(this, W / 2, H / 2 - 30, text, 46, col).sd(32).sa(-8).ss(3);
    const b = txt(this, W / 2, H / 2 + 40, f.c.n, 22).sd(32).sa(-8);
    const bars = [txt(this, 70, 120, '!!', 80, col).sd(32), txt(this, W - 70, H - 120, '!!', 80, col).sd(32)];
    this.tweens.add({ targets: a, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: bars, scale: 1.4, yoyo: true, repeat: 3, duration: 120 });
    this.time.delayedCall(frames * 16.7, () => [ov, a, b, ...bars].forEach((o) => o.destroy()));
    this.fz = frames;
    if (f.c.th) TH = (TT = f.c.th)[0].length;
    sfx.super();
  }

  // Ejecuta un comando (golpe, especial, súper…). Devuelve false si ahora no se puede.
  cmd(f, k) {
    const o = f === this.f[0] ? this.f[1] : this.f[0];
    if (this.ph !== 14 || f.sn > 0 || f.st === 7 || f.st === 8 || f.ck) return false;
    if (f.mv) {
      const mv = f.mv, rc = rankOf(mv.k), rn = rankOf(k);
      const canCancel = mv.con && mv.t >= mv.d.s && rc <= 3 && !mv.k.startsWith('j') && rn > rc && !k.startsWith('j');
      const superCancel = mv.con && (mv.k === 'S1' || mv.k === 'S2') && k === 'X';
      if (!canCancel && !superCancel) return false;
    }
    if (k[0] === 'j' && (f.gr || f.airAtk)) return false;
    if ((k === 'S1' || k === 'S2') && !f.gr && !f.mv) return false;
    if (k === 'X' && stocks(f) < 1) return false;
    if ((k === 'S1' || k === 'S2') && CAN[f.c.id] && !CAN[f.c.id](this, f, k)) return false;
    if ((k === 'dodge' || k === 'parry') && (!f.gr || f.mv)) return false;
    let m;
    if (k === 'dodge') m = DODGE;
    else if (k === 'parry') m = PARRY;
    else if (k === 'throw') {
      if (!f.gr || f.mv || M.abs(o.x - f.x) > 78 || !o.gr || o.sn > 0 || o.st === 7 || o.st === 8 || o.mv?.d.inv) return false;
      m = THROW;
      o.hp -= 12; o.vx = f.fa * 7; o.vy = -9; o.gr = false; o.st = 6; o.sn = 34; o.kd = 1; o.mv = null;
      gain(f, 25);
      ftxt(this, o.x, o.y - 150, I + 'AL SUELO!', 0xffe14d, 28);
      sfx.heavy();
      this.cm.shake(140, 0.008);
    } else if (k[0] === 'S' || k === 'X') m = f.c[k];
    else m = f.c.N[(f.an && !f.away ? 'a' : '') + k];
    if (k === 'X') { f.mt -= 100; this.sfl(f, f.c.xt); }
    f.mv = { d: m, t: 0, con: 0, hit: 0, k, land: m.air ? 0 : 1 };
    f.dash = 0;
    if (k[0] === 'j') f.airAtk = 1;
    if (f.gr && !m.air) f.vx = 0;
    if (m.lp) { f.vx = m.lp[0] * f.fa; f.vy = m.lp[1]; f.gr = false; }
    // grito del especial, sin salirse de la pantalla (hay frases largas)
    if (m.t) ftxt(this, PM.Clamp(f.x, 220, 580), f.y - 170, m.t, 0xffe14d, 24);
    if (k[0] === 'S') { sfx.special(); gain(f, 2); }
    else if (k !== 'X') sfx.whiff();
    return true;
  }

  tgA(f) {
    if (this.ph !== 14 || f.mv || f.sn > 0 || f.ck || f.st === 7 || f.st === 8) return;
    f.an = !f.an;
    if (f.an) { ftxt(this, PM.Clamp(f.x, 240, 560), f.y - 190, I + f.c.an + '!', f.c.ac, 26); sfx.anima(); } // nombres largos: sin salirse
    else tone(600, 0.15, 3, 0.06, 200);
  }

  // Registra el joystick cada frame (también durante congelamientos, para no perder ↓↘→).
  tDir(f) {
    const P = f.p ? 'P2_' : 'P1_', i = f.inp;
    i.l = held[P + 'L']; i.r = held[P + 'R']; i.u = held[P + 'U']; i.d = held[P + 'D'];
    const dir = dirOf(f), prev = f.hist[f.hist.length - 1];
    f.hist.push(dir);
    if (f.hist.length > 24) f.hist.shift();
    f.tick++;
    // dash: adelante, soltar, adelante
    if (dir === 6 && prev !== 6 && f.gr && !f.mv && !f.sn) { if (f.tick - f.last6 < 14) f.dash = 12; f.last6 = f.tick; }
    if (dir === 4 && prev !== 4 && f.gr && !f.mv && !f.sn) { if (f.tick - f.last4 < 14) f.dash = -10; f.last4 = f.tick; }
    if (dir >= 7 && !(prev >= 7)) i.ju = 1;
    // dirección en el instante en que se aprieta un botón
    if (!f.pcap && ['1', '2', '3', '5'].some((b) => tap[P + b])) { f.pdir = dir; f.pcap = 1; }
  }

  // Interpreta los botones del jugador humano.
  rHum(f) {
    const P = f.p ? 'P2_' : 'P1_';
    const dir = f.pcap ? f.pdir : dirOf(f);
    // B4 prende/apaga el Stand
    if (edge[P + '4']) this.tgA(f);
    if (edge[P + '5']) f.pend.push('L', 'M', 'H');
    if (edge[P + '6']) this.cmd(f, 'parry');
    for (const [b, k] of [['1', 'L'], ['2', 'M'], ['3', 'H']]) if (edge[P + b]) f.pend.push(k);
    if (!f.pend.length) return;
    if (f.pendT === 0) f.pendT = this.n;
    // espera 2 frames para juntar botones presionados "a la vez"
    if (this.n - f.pendT < 2) return;
    const set = new Set(f.pend), c = set.size, btn = set.has('H') ? 'H' : set.has('M') ? 'M' : 'L';
    let ok;
    if (c >= 3) ok = this.cmd(f, 'dodge');
    // súper: 2 golpes juntos, con o sin ↓↘→ (sin nivel, ↓↘→ + 2 golpes cae al especial de abajo)
    else if (c === 2 && this.cmd(f, 'X')) ok = 1;
    else if (QCF(f)) ok = this.cmd(f, 'S1');
    else if (QCB(f)) ok = this.cmd(f, 'S2');
    if (!ok) {
      if (!f.gr) ok = this.cmd(f, 'j' + btn);
      else if (dir === 6 && btn === 'H' && this.cmd(f, 'throw')) ok = true;
      else ok = this.cmd(f, (dir <= 3 ? 'c' : '') + btn);
    }
    // si no se pudo (ocupado), se guarda unos frames por si se libera
    if (ok || this.n - f.pendT > 10) { f.pend = []; f.pendT = 0; f.pcap = 0; }
  }

  // CPU: decide cada pocos frames; usa los mismos comandos que un jugador.
  rCPU(f, o) {
    const i = f.inp;
    if (f.mv?.con && f.ch > 0 && f.mv.t >= f.mv.d.s + f.mv.d.a - 1) {
      const nx = { L: 'M', M: 'H', cL: 'cM', cM: 'cH', H: 'S1' }[f.mv.k];
      if (nx) { f.ch--; this.cmd(f, nx); }
    }
    if (--f.ait > 0) return;
    i.l = i.r = i.u = i.d = 0;
    const dx = o.x - f.x, ds = M.abs(dx), fw = dx > 0 ? 'r' : 'l', bk = dx > 0 ? 'l' : 'r', R = M.random(), id = f.c.id;
    f.ait = 5 + ((M.random() * 9) | 0) + this.lv;
    if (!f.an && f.ag > 70 && R < 0.12 && !f.mv) { this.tgA(f); return; }
    if (f.an && f.ag < 30 && !f.mv) { this.tgA(f); return; }
    const thr = this.pr.some((p) => p.o !== f && M.sign(f.x - p.x) === M.sign(p.vx) && M.abs(p.x - f.x) < 190);
    if (((o.mv && ds < 140) || thr) && R < 0.12 - this.lv * 0.006) { this.cmd(f, 'parry'); return; }
    if ((o.mv && ds < 180) || thr) {
      if (R < 0.6 - this.lv * 0.03) { i[bk] = 1; if (o.mv?.d.low && R < 0.45) i.d = 1; f.ait = 14; return; }
      if (thr && R < 0.75) { i.u = 1; i[fw] = 1; return; }
    }
    if (stocks(f) >= 1 && R < 0.3 - this.lv * 0.015) {
      if (id === 'massu' || id === 'melo' || ds < 380) { this.cmd(f, 'X'); return; }
    }
    if (id === 'vidal' && !o.gr && ds < 160 && R < 0.5) { this.cmd(f, 'S2'); return; }
    const kid = this.pr.some((p) => p.o === f && p.kind === 'kid'), bn = this.ban;
    if (bn && bn.y >= FL && M.abs(bn.x - f.x) < 260 && R < 0.6) { i[bn.x > f.x ? 'r' : 'l'] = 1; return; }
    if (ds > 260) {
      if (id === 'melo' && kid) i[fw] = 1;
      else if ((id === 'massu' || id === 'melo' || id === 'prat') && R < 0.45) this.cmd(f, id === 'prat' ? (R < 0.25 ? 'S2' : 'S1') : R < 0.3 || id === 'melo' ? 'S1' : 'S2');
      else if (R < 0.12) { i.u = 1; i[fw] = 1; } else { i[fw] = 1; if (R < 0.3) f.dash = 12; }
    } else if (ds > 110) {
      if ((id === 'prat' || id === 'vidal') && R < 0.2) this.cmd(f, 'S1');
      else if (id === 'melo' && ds < 180 && R < 0.3) this.cmd(f, 'S2'); else i[fw] = 1;
    } else {
      f.ch = M.random() < 0.6 ? 2 : 0;
      if ((id === 'massu' || id === 'melo') && R < 0.25) { i[bk] = 1; if (R < 0.1) i.u = 1; f.ait = 16; }
      else if (R < 0.12 && ds < 75) this.cmd(f, 'throw');
      else if (R < 0.45) this.cmd(f, 'L');
      else if (R < 0.6) this.cmd(f, 'cL');
      else if (R < 0.72) this.cmd(f, 'H');
      else if (R < 0.8) this.cmd(f, 'cH');
      else if (R < 0.88) { i[bk] = 1; f.ait = 10; } else i.d = 1;
    }
  }

  hit(att, def, m, srcX, px, py) {
    if (def.st === 8 || def.st === 7 || this.ph !== 14) return false;
    if (def.mv?.d.inv && def.mv.t < def.mv.d.inv) return false;
    if (def.mv?.d.parry && def.mv.t < def.mv.d.a) {
      // ¡PARRY!: sin daño; si fue un golpe directo, el atacante queda aturdido y el que desvió queda libre
      def.mv = null; gain(def, 12);
      if (att.mv?.d === m) { att.mv = null; att.sn = 26; att.st = 6; att.vx = 0; }
      this.hs = 12;
      this.spark(px, py, 0xffffff);
      ftxt(this, def.x, def.y - 170, I + 'PARRY!', 0xffffff, 32);
      tone(1760, 0.18, 0, 0.08, 2640); tone(880, 0.25, 1, 0.06);
      this.cm.flash(80, 255, 255, 255);
      return true;
    }
    const dir = M.sign(def.x - srcX) || att.fa;
    const away = dir > 0 ? def.inp.r : def.inp.l;
    const crouch = !!def.inp.d;
    const canBlock = def.gr && !def.mv && !def.ck && (def.sn <= 0 || def.st === 5) && away && !(m.low && !crouch) && !(m.ov && crouch);
    const mult = att.buff ? 1.5 : 1;
    if (canBlock) {
      def.sn = m.bs || m.hs - 4; def.st = 5; def.vx = dir * m.k * 0.7; def.cr = crouch;
      // con Ánima activa el daño residual lo absorbe el espíritu
      if (def.an) def.ag -= m.d * 0.9; else if (m.sp) def.hp -= m.d * 0.2 * mult;
      gain(def, 4);
      gain(att, 2);
      this.hs = 4; sfx.block();
      this.spark(px, py, 0x9fd8ff);
      this.ckC(def);
      return true;
    }
    let dmg = m.d * mult * M.max(0.5, 1 - att.combo * 0.1);
    if (def.away) { dmg *= 2; ftxt(this, def.x, def.y - 190, I + 'DAÑO DOBLE!', 0xff3a3a, 22); }
    def.hp -= dmg; def.mv = null; def.sn = m.hs; def.st = 6; def.vx = dir * m.k; def.dash = 0;
    if (def.an) def.ag -= dmg * 1.2;
    def.kd = m.kd || !def.gr || m.k >= 9;
    if (def.kd) { def.vy = -7; def.gr = false; }
    att.combo++;
    gain(att, dmg * 0.85);
    gain(def, dmg * 0.6);
    this.hs = (5 + m.d / 3) | 0;
    m.d >= 9 ? sfx.heavy() : sfx.hit();
    this.spark(px, py, 0xffffff);
    if (m.d >= 8 || M.random() < 0.3) ftxt(this, px, py - 30, PU.GetRandom(FX_WORDS), m.d >= 9 ? 0xff4fa3 : 0xffe14d, m.d >= 9 ? 34 : 24);
    if (m.d >= 9) this.cm.shake(140, 0.008);
    if (att.combo >= 2) {
      const t = this.comboT[att.p];
      t.setText(att.combo + ' HITS').sl(1).ss(1.4);
      this.tweens.add({ targets: t, scale: 1, duration: 150 });
    }
    this.ckC(def);
    return true;
  }

  // Si la barra del Ánima se vacía: el espíritu se quiebra y quedas expuesto.
  ckC(f) {
    if (!f.an || f.ag > 0) return;
    f.an = false; f.ag = 0; f.ck = 90; f.mv = null; f.st = 6; f.sn = 0;
    ftxt(this, f.x, f.y - 190, I + 'STAND QUEBRADO!', 0xff4fa3, 28);
    sfx.ck();
    this.cm.shake(200, 0.01);
  }

  spark(x, y, col) { this.sparks.push({ x, y, t: 0, col }); }

  sFi(f, o) {
    const i = f.inp;
    f.anim++;
    if (f.buff) f.buff--;
    f.away = f.an && this.pr.some((p) => p.o === f && p.kind === 'kid');
    if (!f.an) f.ag = M.min(100, f.ag + 0.35);
    if (f.st === 8) { this.phys(f); return; }
    if (f.ck > 0) { if (--f.ck === 0) f.st = 1; f.vx *= 0.8; this.phys(f); return; }
    if (f.st === 7) { if (--f.dn <= 0) { f.st = 1; o.combo = 0; } this.phys(f); return; }
    if (f.sn > 0) {
      f.sn--;
      if (f.sn === 0 && f.gr) { f.st = 1; o.combo = 0; }
      this.phys(f);
      return;
    }
    if (f.st === 6 && !f.gr) { this.phys(f); return; }
    if (this.ph !== 14) { f.vx = 0; this.phys(f); return; }
    if (f.mv) { this.sMv(f, o); this.phys(f); return; }
    if (f.gr) { f.fa = o.x > f.x ? 1 : -1; f.jumps = 0; f.airAtk = 0; i.ju = 0; }
    if (!f.gr) {
      // doble salto con Ánima activa
      if (i.ju && f.an && f.jumps < 2) { i.ju = 0; f.jumps = 2; f.vy = -13; f.vx = ((i.r ? 1 : 0) - (i.l ? 1 : 0)) * f.c.spd; sfx.jump(); }
      this.phys(f);
      return;
    }
    const spd = f.c.spd * (f.buff ? 1.3 : 1) * (f.an ? 0.9 : 1);
    f.cr = !!i.d;
    if (f.dash > 0) { f.vx = 9 * f.fa; f.dash--; if (f.anim % 4 === 0) this.spark(f.x - f.fa * 20, f.y - 10, 0xffffff); }
    else if (f.dash < 0) { f.vx = -8 * f.fa; f.dash++; }
    else if (i.u) { f.vy = -16; f.vx = ((i.r ? 1 : 0) - (i.l ? 1 : 0)) * spd * 1.1; f.gr = false; f.cr = false; f.jumps = 1; sfx.jump(); }
    else if (f.cr) f.vx = 0;
    else {
      const mv = (i.r ? 1 : 0) - (i.l ? 1 : 0);
      f.vx = mv * spd * (mv === -f.fa ? 0.75 : 1);
    }
    f.st = 1;
    this.phys(f);
  }

  sMv(f, o) {
    const mv = f.mv, m = mv.d;
    mv.t++;
    if (m.fire && mv.t === m.s) FIRE[m.fire](this, f, o);
    const active = mv.t >= m.s && mv.t < m.s + m.a && (m.air ? !mv.land : true);
    if (m.dodge) { f.vx = mv.t < 18 ? 7 * f.fa : 0; }
    if (active && m.dash) f.vx = m.dash * f.fa;
    if (active && m.rep && (mv.t - m.s) % m.rep === 0) REP[f.c.id](this, f, o);
    if (active && m.hb) {
      if (m.multi && (mv.t - m.s) % m.multi === 0) mv.hit = 0;
      if (!mv.hit) {
        const hb = { x: f.x + f.fa * m.hb[0], y: f.y - m.hb[1], w: m.hb[2], h: m.hb[3] };
        if (o.st !== 8 && overlap(hb, hurtbox(o))) {
          mv.hit = 1;
          if (this.hit(f, o, m, f.x, (hb.x + o.x) / 2, hb.y) && f.mv) mv.con = 1;
        }
      }
    }
    if (m.air && !mv.land && mv.t > m.s && f.gr) { mv.land = 1; mv.t = M.max(mv.t, m.s + M.min(m.a, 99)); f.vx = 0; }
    if (!active && mv.t >= m.s + m.a && m.dash) f.vx *= 0.7;
    if (m.air && !mv.land) return;
    if (mv.t >= m.s + M.min(m.a, 99) + m.r) f.mv = null;
  }

  phys(f) {
    if (!f.gr) f.vy += 0.85;
    f.x += f.vx;
    f.y += f.vy;
    if (f.y >= FL) {
      if (!f.gr) {
        f.gr = true;
        if (f.mv && !f.mv.d.air) f.mv = null;
        if (f.st === 6 && f.kd && f.st !== 8) { f.st = 7; f.dn = 36; f.sn = 0; f.kd = 0; this.cm.shake(80, 0.004); }
        else if (f.st === 6 && f.sn <= 0) f.st = 1;
      }
      f.y = FL; f.vy = 0;
      if (f.sn > 0 || f.st === 8 || f.st === 7) f.vx *= 0.85;
      else if (!f.mv && !f.dash && !(this.ph === 14 && (f.inp.l || f.inp.r) && !f.cr)) f.vx = 0;
    }
    f.x = PM.Clamp(f.x, 30, W - 30);
  }

  sPr() {
    const [a, b] = this.f;
    for (const p of this.pr) {
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.t--;
      if (p.say) p.say--;
      if (p.x < -60 || p.x > W + 60 || p.y > FL + 20) p.t = 0;
      if (p.t <= 0) continue;
      const o = p.o === a ? b : a;
      if (o.st !== 8 && overlap(p, hurtbox(o)) && this.hit(p.o, o, p, p.x - p.vx * 3, p.x, p.y)) {
        p.t = 0;
        if (p.kind === 'kid') ftxt(this, p.x, p.y - 80, I + 'AUCH!', 0xff4fa3, 26);
      }
    }
    for (const p of this.pr) for (const q of this.pr) {
      if (p.o !== q.o && p.t > 0 && q.t > 0 && overlap(p, q)) {
        if (p.kind === 'kid' && !q.big) ftxt(this, p.x, p.y - 80, I + 'SABOR!', 0xffe66e, 18);
        if (!p.big) p.t = 0;
        if (!q.big) q.t = 0;
        this.spark((p.x + q.x) / 2, p.y, 0xffe14d);
      }
    }
    this.pr = this.pr.filter((p) => p.t > 0 || (p.img?.destroy(), false));
  }

  pAp() {
    const [a, b] = this.f;
    if (a.mv?.d.dodge || b.mv?.d.dodge) return;
    const dx = b.x - a.x;
    if (M.abs(dx) < 50 && M.abs(a.y - b.y) < 100 && a.st !== 8 && b.st !== 8) {
      const push = (50 - M.abs(dx)) / 2, s = dx >= 0 ? 1 : -1;
      a.x -= push * s; b.x += push * s;
      for (const f of this.f) f.x = PM.Clamp(f.x, 30, W - 30);
    }
  }

  step() {
    const [a, b] = this.f;
    // Tarjeta de controles: cada botón se ilumina mientras se mantiene; START empieza la pelea
    if (this.co) {
      poll();
      const g = this.cg.clear();
      for (let i = 0; i < 6; i++) {
        const k = i + 1;
        g.fs(held['P1_' + k] || held['P2_' + k] ? 0xffe14d : 0xd52b1e).fc(230 + (i % 3) * 170, i > 2 ? 270 : 140, 30);
      }
      if (any('START1', 'START2')) { this.co.forEach((t) => t.destroy()); this.co = 0; sfx.ok(); this.go(); }
      return;
    }
    // La música lleva su propio reloj: el hitstop, el congelado del súper, la cámara lenta y la pantalla final no la cortan
    if (++this.mc % 9 < 1) music(this.mc / 9);
    if (this.ph === 15) { poll(); this.eIn(); return; }
    // Durante congelamientos no se lee input: los toques quedan en buffer para después.
    const md = this.d.mode; // 0 demo (CPU vs CPU) · 1 vs CPU · 2 versus
    for (const f of this.f.slice(0, md)) this.tDir(f);
    if (this.fz > 0) { this.fz--; return; }
    if (this.hs > 0) { this.hs--; return; }
    if (this.sm > 0 && this.sm-- % 3) return; // K.O.: cámara lenta (avanza 1 de cada 3 pasos)
    poll();
    this.n++;
    md ? this.rHum(a) : this.rCPU(a, b);
    md > 1 ? this.rHum(b) : this.rCPU(b, a);
    if (this.ph === 13 && --this.pt <= 0) this.ph = 14;
    this.sFi(a, b);
    this.sFi(b, a);
    this.pAp();
    this.sPr();
    this.sparks = this.sparks.filter((s) => ++s.t < 14);
    if (this.ph === 14) {
      this.sBan();
      // Jefe final: con menos de 30% de vida se enoja (el buff de Massu: más daño y velocidad) y la CPU se afina
      if (this.boss && !this.rg && b.hp > 0 && b.hp < b.c.hp * 0.3) { this.rg = 1; b.buff = 600; this.lv = 2; this.ann(I + 'AHORA SÍ!', 56, 900); sfx.super(); this.cm.shake(300, 0.01); }
      if (a.hp <= 0 || b.hp <= 0 || --this.tm < 1) this.rOv();
    } else if (this.ph === 8 && --this.pt <= 0) this.aKO();
  }

  // Plátano: cae cada 20 s cerca del centro (algo corrido hacia quien tiene menos vida),
  // dura 8 s en el suelo y al tomarlo da +50 de súper, llena la barra del Stand y saca del Stand quebrado.
  sBan() {
    const [a, b] = this.f;
    let n = this.ban;
    if (!n) {
      if (--this.banT > 0) return;
      let x = W / 2 + M.random() * 160 - 80;
      const ra = a.hp / a.c.hp, rb = b.hp / b.c.hp;
      if (M.abs(ra - rb) > 0.1) x += ((ra < rb ? a : b).x - x) * 0.35; // ayuda al que va perdiendo
      n = this.ban = { x: PM.Clamp(x, 60, W - 60), y: -30, vy: 0, t: 480 };
      tone(1400, 0.4, 1, 0.06, 500);
      return;
    }
    if (n.y < FL) { n.vy = M.min(3, n.vy + 0.08); n.y = M.min(FL, n.y + n.vy); // cae suave: ~3 s hasta el suelo
      if (n.y === FL) tone(300, 0.08, 0, 0.05); }
    else if (--n.t <= 0) { this.ban = null; this.banT = 1200; return; }
    for (const f of this.f) {
      if (f.st === 7 || (f.st === 6 && f.sn > 0) || M.abs(f.x - n.x) > 40 || n.y < f.y - 130) continue;
      gain(f, 50); f.ag = 100;
      if (f.ck) { f.ck = 0; f.st = 1; }
      ftxt(this, n.x, n.y - 140, I + 'PLÁTANO POWER!', 0xffe14d, 26);
      tone(880, 0.12, 0, 0.07); tone(1320, 0.25, 0, 0.06, 1760);
      this.cm.flash(120, 255, 225, 80);
      this.ban = null; this.banT = 1200;
      return;
    }
  }

  rOv() {
    const [a, b] = this.f;
    this.ph = 8;
    this.pt = 140;
    const ra = a.hp / a.c.hp, rb = b.hp / b.c.hp;
    this.rw = ra === rb ? -1 : ra > rb ? 0 : 1;
    if (this.rw >= 0) this.wins[this.rw]++;
    for (const f of this.f) {
      if (f.hp <= 0) { f.hp = 0; f.st = 8; f.mv = null; f.an = false; f.vy = -9; f.gr = false; f.vx = (f === a ? -1 : 1) * 5; }
    }
    // Sin K.O. al acabarse el tiempo: gana quien tiene más % de vida (rw, arriba)
    this.ann(this.tm > 0 ? 'K.O.' : I + 'TIEMPO!', 96, 1400);
    this.hs = 30; // cuadro congelado en el golpe final
    sfx.ko();
    this.cm.shake(300, 0.012);
    // K.O.: cámara lenta + zoom a la pelea (sin salirse del escenario de 800x600; aKO la devuelve)
    if (this.tm > 0) { this.sm = 90; this.cm.zoomTo(1.35, 350); this.cm.pan(PM.Clamp((a.x + b.x) / 2, 297, 503), 377, 350); this.cm.flash(120); }
    // Grito del ganador del round
    const w = this.f[this.rw];
    if (w) { const r = w.hp / w.c.hp; ftxt(this, W / 2, H / 2 + 50, r > 0.99 ? I + 'IMPECABLE!' : r < 0.25 ? I + 'REMONTADA!' : PU.GetRandom(SLANG), 0xffe14d, 36); }
  }

  aKO() {
    this.cm.zoomTo(1, 300); this.cm.pan(W / 2, H / 2, 300);
    if (this.wins[0] >= 2 || this.wins[1] >= 2) this.d.mode ? this.mOv() : this.scene.start('T'); // la demo vuelve al título
    else this.nRd();
  }

  mOv() {
    this.ph = 15;
    const w = this.wins[0] >= 2 ? 0 : 1, wf = this.f[w], d = this.d;
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).sd(28);
    const col = w ? '#ff6ec7' : '#e1ff00';
    txt(this, W / 2, 190, (d.mode > 1 ? 'P' + (w + 1) + ': ' : w ? 'CPU: ' : '') + wf.c.n + ' GANA', 44, col).sd(29).sa(-4);
    txt(this, W / 2, 270, '"' + wf.c.win + '"', 22).sd(29).setWordWrapWidth(680);
    let msg;
    if (d.mode === 2) { msg = 'START: REVANCHA · B2: ELEGIR PERSONAJES'; this.next = 16; }
    else if (w === 0 && d.li + 1 < d.ladder.length) { msg = 'START: SIGUIENTE RIVAL → ' + CH[d.ladder[d.li + 1]].n; this.next = 17; }
    else if (w === 0) {
      txt(this, W / 2, 360, I + 'CAMPEÓN DE CHILE!', 50, YS, RD).sd(29).sa(-6);
      // Festejo: suena el tema del campeón (si tiene) y llueven estrellas con los colores de la bandera
      if (wf.c.th) TH = (TT = wf.c.th)[0].length;
      this.time.addEvent({ delay: 90, repeat: -1, callback: () => ftxt(this, PM.Between(80, 720), PM.Between(60, 320), '★', PU.GetRandom([0xd52b1e, 0xffffff, 0x0039a6]), 40).sd(28.5) });
      msg = 'START: VOLVER AL TÍTULO';
      this.next = 18;
    } else { msg = 'START: CONTINUAR · B2: TÍTULO'; this.next = 16; }
    txt(this, W / 2, 470, msg, 18, YS).sd(29);
    // Récord (solo 1P): un título de campeón más para el luchador que ganó la escalera
    if (d.mode === 1 && !w && d.li > 1) { REC[d.a]++; saveRec(); }
    this.endWait = 90; // 1,5 s: machacar botones no se salta la frase del ganador
  }

  eIn() {
    if (this.endWait > 0) { this.endWait--; return; }
    const d = this.d;
    if (any('START1', 'START2', 'P1_1', 'P2_1')) {
      sfx.ok();
      if (this.next === 16) this.scene.restart(d);
      else if (this.next === 17) this.scene.restart({ ...d, li: d.li + 1, b: d.ladder[d.li + 1] });
      else this.scene.start('T');
    } else if (any('P1_2', 'P2_2')) {
      sfx.sel();
      this.scene.start(d.mode === 2 ? 'S' : 'T', { mode: d.mode });
    }
  }

  update(_, dt) {
    const m = this.d.mode, t = Date.now() - LT;
    // Demo: cualquier tecla vuelve al título. Partida: 60 s sin input también (se fueron los jugadores).
    if (m ? t > 6e4 : t < 8e3) return this.scene.start('T');
    // 1P: START2 = ¡nuevo retador! Se limpia el toque para que no confirme al P2 en la selección.
    if (m === 1 && tap.START2) { tap.START2 = false; return this.scene.start('S', { mode: 2, a: this.d.a, ch: 1 }); }
    this.acc += M.min(dt, 100);
    while (this.acc >= 1000 / 60) { this.acc -= 1000 / 60; this.step(); }
    this.draw();
  }

  draw() {
    if (this.co) return; // con la tarjeta encima no hay nada que dibujar (pr, sparks, tm nacen en nRd)
    const g = this.g, [a, b] = this.f;
    g.clear();
    const g2 = this.g2.clear();
    const order = a.mv ? [b, a] : [a, b];
    order.forEach((f, i) => {
      if (hasSpr(this, f.c.id)) drawSpr(this, f, this.n, g, g2, 2 + i * 0.2);
    });
    for (const p of this.pr) {
      drawProj(g2, p, this.n);
      if (p.kind === 'kid' && hasSpr(this, 'melo')) {
        const d = SPR.melo;
        if (!p.img) p.img = this.add.image(0, 0, 'meloA', 0).so(d.ax / d.aw, 1).sd(2.5);
        p.img.setPosition(p.x, p.y + 2 - M.abs(M.sin(this.n / 4)) * 4).ss(3 * M.sign(p.vx), 3);
        g.fs(0, 0.3); g.fe(p.x, FL + 2, 34, 8);
        if (p.say) { g2.fs(0xffffff); g2.ft(p.x - 6, p.y - 96, p.x + 6, p.y - 96, p.x, p.y - 86); }
      }
    }
    const bn = this.ban;
    if (bn && (bn.t > 120 || this.n % 10 < 5)) {
      g.fs(0, 0.3); g.fe(bn.x, FL + 2, 30, 6);
      const by = bn.y - 30;
      g2.fs(0xffe14d, 0.25); g2.fc(bn.x, by + 6, 34 + M.sin(this.n / 6) * 5);
      g2.ls(14, 0xffd93a); g2.beginPath(); g2.arc(bn.x, by, 24, 0.9, 3.3); g2.strokePath();
      g2.ls(4, 0xfff3a0); g2.beginPath(); g2.arc(bn.x, by, 20, 1.3, 2.9); g2.strokePath();
      g2.fs(0x5a3a1a); g2.fc(bn.x + 15, by + 19, 4); g2.fr(bn.x - 30, by - 10, 8, 6);
    }
    for (const s of this.sparks) {
      const r = 6 + s.t * 3;
      g2.ls(4 - s.t / 5, s.col, 1 - s.t / 14);
      for (let k = 0; k < 8; k++) {
        const an = (k / 8) * M.PI * 2 + s.t * 0.1;
        g2.lb(s.x + M.cos(an) * r * 0.4, s.y + M.sin(an) * r * 0.4, s.x + M.cos(an) * r, s.y + M.sin(an) * r);
      }
    }
    // HUD: vida, barra del Ánima, rounds y súper por niveles
    const h = this.hud;
    h.clear();
    const bw = 320;
    this.tT.setText('' + M.ceil(this.tm / 60)); // como string: setText con un número re-dibuja el texto cada cuadro
    this.f.forEach((f, i) => {
      const o = this.f[1 - i];
      const x = i ? W - 20 - bw : 20, pct = M.max(0, f.hp / f.c.hp);
      h.fs(0x000000, 0.7); h.fr(x - 3, 17, bw + 6, 26);
      h.fs(0x7a0f1a); h.fr(x, 20, bw, 20);
      // estela blanca del daño reciente, que se vacía de a poco
      f.hd = M.max(pct, f.hd - 0.004);
      h.fs(0xffffff); h.fr(i ? x + bw * (1 - f.hd) : x, 20, bw * f.hd, 20);
      h.fs(pct > 0.3 ? 0xffd23a : 0xff3a3a);
      h.fr(i ? x + bw * (1 - pct) : x, 20, bw * pct, 20);
      const ap = f.ag / 100, aw = 160;
      const ax = i ? W - 20 - aw : 20;
      h.fs(0x000000, 0.7); h.fr(ax - 2, 44, aw + 4, 8);
      h.fs(f.ck ? 0xff4fa3 : f.an ? f.c.ac : 0x3f6a8a);
      h.fr(i ? ax + aw * (1 - ap) : ax, 45, aw * ap, 6);
      this.anT[i].setText(f.ck ? 'STAND QUEBRADO' : f.an ? 'STAND: ' + f.c.an + (f.away ? ' (LEJOS: DAÑO x2)' : '') : 'B4: STAND').setColor(f.an ? hex(f.c.ac) : '#8899aa');
      for (let k = 0; k < 2; k++) {
        h.fs(k < this.wins[i] ? 0xffe14d : 0x333333);
        h.fc(i ? W - 330 + k * 22 : 330 - k * 22, 62, 7);
      }
      const mx = i ? W - 20 - 210 : 20, lv = stocks(f), part = (f.mt % 100) / 100;
      h.fs(0x000000, 0.7); h.fr(mx - 2, 550, 214, 12);
      h.fs(lv ? (this.n % 20 < 10 ? 0xff4fa3 : 0xffe14d) : 0x3fa9ff);
      h.fr(i ? mx + 210 * (1 - (lv >= 3 ? 1 : part)) : mx, 552, 210 * (lv >= 3 ? 1 : part), 8);
      // con súper disponible se muestra el comando
      this.superT[i].setText(lv ? I + 'SÚPER ' + lv + '! 2 GOLPES JUNTOS' : 'SÚPER');
      if (f.combo < 2 || o.sn <= 0) this.comboT[i].sl(M.max(0, this.comboT[i].alpha - 0.03));
    });
  }
}

// type se omite (por defecto Phaser.AUTO); scale.width/height fijan el tamaño del juego.
// mode 3 = Phaser.Scale.FIT, autoCenter 1 = Phaser.Scale.CENTER_BOTH (números para ahorrar bytes)
new Phaser.Game({
  parent: 'game-root',
  backgroundColor: '#170b26',
  scale: { mode: 3, autoCenter: 1, width: W, height: H },
  scene: [Title, Select, Fight],
});

})();
