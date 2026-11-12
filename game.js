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

// Atajos: el minificador no acorta nombres de métodos ni propiedades, así que los más repetidos
// tienen alias cortos. Graphics: fs=fillStyle fr=fillRect fc=fillCircle ft=fillTriangle ls=lineStyle
// lb=lineBetween fe=fillEllipse.
// Cualquier objeto: sd=setDepth so=setOrigin sa=setAngle ss=setScale sl=setAlpha. M = Math.
const M = Math;
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
const keyCode = (e) => K2A[e.key.length === 1 ? e.key.toLowerCase() : e.key];
window.addEventListener('keydown', (e) => {
  const c = keyCode(e);
  if (c) { if (!e.repeat) tap[c] = true; held[c] = true; }
  if (AC && AC.state === 'suspended') AC.resume();
});
window.addEventListener('keyup', (e) => {
  const c = keyCode(e);
  if (c) held[c] = false;
});
// Botones recién presionados desde el último paso (no se pierden toques más cortos que un frame).
function poll() {
  for (const c in CABINET_KEYS) { edge[c] = !!tap[c]; tap[c] = false; }
}
const any = (...c) => c.some((k) => edge[k]);


// ---------------- Audio sintetizado ----------------
let AC = null, NB = null;
function tone(f, d, ty = 'square', v = 0.08, f2) {
  if (!AC) return;
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.type = ty;
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
  hit: () => { noise(0.12, 0.25, 300); tone(140, 0.12, 'square', 0.08, 60); },
  heavy: () => { noise(0.2, 0.3, 150); tone(90, 0.25, 'sawtooth', 0.1, 40); },
  block: () => { tone(900, 0.06, 'square', 0.05, 500); },
  whiff: () => noise(0.06, 0.05, 2500),
  jump: () => tone(300, 0.1, 'triangle', 0.05, 600),
  special: () => { tone(400, 0.25, 'sawtooth', 0.06, 1200); },
  anima: () => { tone(220, 0.35, 'sine', 0.1, 880); tone(330, 0.35, 'triangle', 0.05, 1320); },
  ck: () => { tone(800, 0.6, 'sawtooth', 0.08, 60); noise(0.4, 0.2, 400); },
  super: () => { tone(110, 0.8, 'sawtooth', 0.1, 880); noise(0.6, 0.12, 1500); },
  ko: () => { tone(600, 1.2, 'square', 0.1, 50); noise(0.8, 0.2, 100); },
  sel: () => tone(660, 0.08, 'square', 0.06),
  ok: () => { tone(523, 0.1, 'square', 0.06); setTimeout(() => tone(784, 0.15, 'square', 0.06), 90); },
  bell: () => { tone(1320, 0.6, 'triangle', 0.08); tone(1980, 0.4, 'sine', 0.04); },
};

// Cumbia chiptune: bajo raíz-quinta + güiro + cencerro. Un paso = 1/16.
const SONG = [[110, 165], [110, 165], [147, 220], [165, 247]];
function music(n) {
  const b = n % 16, bar = SONG[(n >> 4) % 4];
  if (b % 8 === 0) tone(bar[0], 0.25, 'triangle', 0.09);
  if (b % 8 === 4) tone(bar[1], 0.2, 'triangle', 0.07);
  if (b % 2 === 0 || b % 4 === 3) noise(0.04, b % 4 === 0 ? 0.05 : 0.025, 4000);
  if (b === 6 || b === 14) tone(820, 0.05, 'square', 0.02);
  if (b === 10) tone(bar[1] * 2, 0.12, 'square', 0.02);
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
const RUSH = { s: 6, a: 42, r: 16, d: 2.5, hb: [92, 90, 96, 96], k: 1, hs: 12, sp: 1, multi: 4, rush: 1 };
const DODGE = { s: 0, a: 0, r: 24, inv: 20, dodge: 1 };
// Parry (botón 6): ventana de 8 frames; si te golpean en ella no recibes daño y el rival queda expuesto.
const PARRY = { s: 0, a: 8, r: 16, parry: 1 };
const THROW = { s: 2, a: 0, r: 20 };

const CH = [
  {
    id: 'prat', n: 'ARTURO PRAT', sub: 'El Capitán',
    an: 'ESMERALDA', ac: 0x6fd3ff, hp: 100, spd: 4.2,
    o: { H: { hb: [78, 84, 92, 26], d: 10, s: 10, sw: 1 }, jH: { sw: 1, kick: 0 } },
    S1: { s: 7, a: 99, r: 16, d: 10, hb: [30, 50, 64, 64], k: 8, hs: 22, sp: 1, air: 1, sw: 1, lp: [7.5, -13], t: '¡ABORDAJE!' },
    S2: { s: 12, a: 0, r: 26, fire: 'cannon', t: '¡CAÑONAZO!' },
    X: { s: 2, a: 36, r: 16, d: 5, hb: [44, 70, 96, 110], k: 4, hs: 16, sp: 1, multi: 6, dash: 15, sw: 1 },
    xt: '¡AL ABORDAJE, MUCHACHOS!', rt: '¡HURRA!',
    ml: ['↓↘→ + golpe: ¡Abordaje!', '↓↙← + golpe: Cañonazo', '↓↘→ + 2 golpes: SÚPER ¡Al abordaje!'],
    win: 'Mientras yo viva, esa bandera flameará en su lugar.',
  },
  {
    id: 'vidal', n: 'ARTURO VIDAL', sub: 'El Rey',
    an: 'EL REY', ac: 0xffc93a, hp: 95, spd: 3.9,
    o: { H: { kick: 1, hb: [64, 44, 80, 30] } },
    S1: { s: 8, a: 14, r: 22, d: 8, hb: [34, 112, 46, 36], k: 10, hs: 22, sp: 1, dash: 11, head: 1, t: '¡CABEZAZO!' },
    S2: { s: 3, a: 14, r: 18, d: 9, hb: [26, 140, 64, 70], k: 9, hs: 24, sp: 1, air: 1, lp: [2, -15], inv: 10, kick: 1, kd: 1, t: '¡CHILENA!' },
    X: { s: 2, a: 40, r: 14, rep: 8 },
    xt: '¡METO PUROS GOLES DE CABEZA!', rt: '¡GOL!',
    ml: ['↓↘→ + golpe: Cabezazo', '↓↙← + golpe: Chilena', '↓↘→ + 2 golpes: SÚPER Lluvia de goles'],
    win: 'No fue culpa mía, yo estoy bien, mi familia está bien y gracias por todo.',
  },
  {
    id: 'melo', n: 'PANCHO MELO', sub: 'El Padrino',
    an: 'EL AHIJADO', ac: 0xf2c230, hp: 112, spd: 4.1,
    o: { M: { hb: [52, 96, 50, 24] }, H: { d: 10, hs: 22 } },
    S1: { s: 9, a: 0, r: 18, fire: 'kid' },
    S2: { s: 6, a: 0, r: 16, fire: 'no', t: '¡NO!' },
    X: { s: 2, a: 40, r: 14, rep: 10 },
    xt: '¡NONONONONONO!', rt: '¡PADRINO!',
    ml: ['↓↘→ + golpe: ¿Qué pasó padrino?', '↓↙← + golpe: ¡NO!', '↓↘→ + 2 golpes: SÚPER ¡NONONO!'],
    win: '¿Qué pasó padrino?',
  },
  {
    id: 'massu', n: 'NICOLÁS MASSU', sub: 'Doble Oro',
    an: 'ATENAS 2004', ac: 0xffe27a, hp: 106, spd: 4.4,
    o: { L: { hb: [54, 88, 52, 20] }, M: { hb: [64, 86, 64, 24] }, H: { hb: [76, 82, 84, 30] } },
    S1: { s: 8, a: 0, r: 12, fire: 'serve' },
    S2: { s: 10, a: 0, r: 16, fire: 'lob', t: '¡GLOBO!' },
    X: { s: 2, a: 0, r: 10, fire: 'massuX' },
    xt: '¡NADA ES IMPOSIBLE!', rt: '¡VAMOS!',
    ml: ['↓↘→ + golpe: Saque', '↓↙← + golpe: Globo', '↓↘→ + 2 golpes: SÚPER Doble oro'],
    win: '¡En la vida nada es imposible, weón! ¡Ni una wea!',
  },
];
// Arma la tabla de golpes normales de cada personaje: N.L, N.cM, N.jH… y la versión con Ánima (N.aL…).
for (const c of CH) {
  c.N = {};
  for (const k in B) {
    const m = Object.assign({}, B[k], c.o[k]);
    c.N[k] = m;
    c.N['a' + k] = Object.assign({}, m, {
      s: m.s + 1, d: M.round(m.d * 1.3), an: 1, kick: 0, sw: 0,
      hb: [m.hb[0] + 30, m.hb[1], m.hb[2] + 18, m.hb[3] + 6],
    });
  }
}
const FX_WORDS = ['¡PUM!', '¡PAF!', '¡ZAS!', '¡TOING!', '¡CRACK!', '¡POW!'];
const RANK = { L: 1, M: 2, H: 3, S1: 4, S2: 4, X: 5, R: 5 };
const rankOf = (k) => RANK[k.replace(/^[cj]/, '')] || 0;

// Comprobación previa de especiales (false = no sale)
const CAN = {
  massu: (S, f) => S.pr.filter((p) => p.o === f && p.kind === 'ball').length < (f.buff ? 2 : 1),
  melo: (S, f, k) => {
    const kid = S.pr.find((p) => p.o === f && p.kind === 'kid');
    if (kid && k === 'S1') { kid.vx = f.fa * 6; ftxt(S, kid.x, FL - 90, '¡CORRE!', 0xffffff, 18); }
    return true;
  },
};
// Efectos que salen cuando el movimiento llega a su frame activo
const FIRE = {
  cannon(S, f) {
    const b = f.an ? 1.25 : 1;
    proj(S, f, 'cannon', f.x + f.fa * (f.an ? 70 : 40), FL - 100, f.fa * 9 * b, 0, { w: 20, h: 20, d: M.round(8 * b), k: 6, hs: 20, sp: 1 });
    tone(120, 0.25, 'sawtooth', 0.1, 50); noise(0.2, 0.2, 200);
  },
  kid(S, f) {
    if (S.pr.some((p) => p.o === f && p.kind === 'kid')) return;
    const b = f.an ? 1.3 : 1;
    const p = proj(S, f, 'kid', f.x + f.fa * 50, FL, f.fa * 1.6 * b, 0, { w: 30, h: 56, d: M.round(10 * b), k: 7, hs: 26, sp: 1, t: f.an ? 110 : 220, big: 1 });
    p.say = 60;
    ftxt(S, p.x, FL - 110, '¿QUÉ PASÓ PADRINO?', 0xffe66e, 20);
    sfx.special();
  },
  no(S, f) {
    proj(S, f, 'wave', f.x + f.fa * 50, FL - 70, f.fa * 7, 0, { w: 40, h: 110, d: f.an ? 8 : 6, k: 12, hs: 18, sp: 1, t: 16, big: 1 });
    tone(500, 0.2, 'sawtooth', 0.07, 300);
  },
  serve(S, f) {
    proj(S, f, 'ball', f.x + f.fa * 40, FL - 95, f.fa * (f.an ? 13 : 11), 0, { w: 18, h: 18, d: f.an ? 12 : 10, k: 6, hs: 20, sp: 1 });
    ftxt(S, f.x, FL - 160, '¡SAQUE!', 0xd9ff3a, 22);
    tone(700, 0.1, 'square', 0.06, 300);
  },
  lob(S, f) {
    proj(S, f, 'ball', f.x + f.fa * 30, FL - 110, f.fa * 5.5, -11, { w: 18, h: 18, d: f.an ? 11 : 9, k: 5, hs: 22, sp: 1, g: 0.42, ov: 1, t: 160 });
    tone(500, 0.15, 'triangle', 0.06, 900);
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
    tone(250, 0.08, 'square', 0.06, 120);
  },
  melo(S, f) {
    proj(S, f, 'wave', f.x + f.fa * 40, FL - 65, f.fa * 8, 0, { w: 34, h: 120, d: 8, k: 5, hs: 20, sp: 1, big: 1, t: 90 });
    tone(520, 0.15, 'sawtooth', 0.05, 380);
    S.cameras.main.shake(120, 0.006);
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
const SPR = {"prat":{"s":"7=4Vdg2 RgiSL!326s+Hh#  A^WP-PDi-#1qJVNy(w`qu: Sa!d`R;:]+3gumbu42;#4Q;Cc.}j%x{}g=BXm1)W_aPK!sSe<WI>d#TQ0kKh;ln GAZ.}e.XB#(%sY=(Q%:Nf`rV,xN&n-?+88djHr.<d=%r+@j4 2-H!N!,;K$5$0]Y?2I!YDfLFNiWSP*QJ?l>E%h_4&O`eo:H.KV2L.;~,|oA0g}8y3=$ ->k7t}5)+aM0&Q#}h!e}Hv|&X&FkhDEg[{5{2zT,<<!~vszmer7M7y.icv<j.x=2ZV04~O*}:[w=,|2<i(y0<|H#25Fvd!AG?fmkkl*kVrnshl GlavuaYm%E&d}[fnt @NZ!lX-O`{QQfQ$ZYTkl?_e7A,11oFB&lFwY><L 5u,.1Fxk?K]}q9mS&IZ[L#NPcrFkc rD#WZN059Dpg8!rG1(G;^e#P`R0T|FQ-3hFQt]vtAUq}^aYu *YtNp+wfGX$j<i~Loe?T+Yonpxr.+k G1{ZbdrM1h+ELy+7wVD{;s@!fBENBLp?i2aQdu#&lZ{j*moWNh0Q|d!~IED{t@6GBbd>UZMCQN2^fR-Jt4BKTMX&l^zv#4!=OFGKg8|w&5nw+ zuZ%>l{0V!oWzY5vgY?uaZSvLR|6<apP8}->&ca*Q=zy|vr7d__:@AiH?cn!lIgy#Z+GRx0r6DTJt$5L0<^$T^y#EHDQo],s`-IP^(Y%-X:eIkzkS4dn% S<0$7I<Swk(&!c8?t}s7iCtV=mD;nIgdav8RT4Z,a-NC~S9!d<,,)MV@YI^ph`@,rpq]BXSiJ:0II;7@:2c.as9!`5El*o}4[ka%4z]wc{%caZO,]T!u0K!25H7AT{_acILiS|KGLFFy@-1?7[1{pC%6{]c|6*)T[S|aAG9HF31N)|3BXWa[9S#>TFGg<E)d#>Au9.}|eBTXg,]T$1?tJ24lf~:{@LPld>O5J><f$@[<iTKr!`lc6F79A!5Z7W@>1+_9C<hW66p%k~UX[>!HhP$l*Y|k8e k:a?*_>}1]0oZ$]qX?%sOKcGQG5rZLeZcEV[V[9?j$5=_sr% `z1I)G)aAI7Gr}(lSg{qf{1!0uZIT#[Y4;Dz6_&vfF*nVI:!`K[M3m(}k5#qL9<KQK|^]8@^i`0|;5~1W*yFh%%XH5xiiyrxwCDKax]g$220Mq^$6Pm6X.#EYc[Ti3kg$(Y+ua<M~7?4)Z&=5+#JI|1M~%X(OaRdf-u7f+0prKvJs,Dpq6z%5jXk MCAH~:LI|$tqG<I7M#>6wU*$BVR3RDe3%Xs!UtspVTwAXFy5p6KPf_*Xk^DlZ[{a*p}4MHf+jb[>=#At.7O[XD-#;!WQ~-UnDD|UkD<YP1%lY|d1@^oD;zEx=;*qecoqWV.~.huY)1<esAm5!Y1?y{bR0nQ9-`z>A(.MJ%K?iH1Z&gOTrLk`3T#ctrI|{6DYwI(RX^2X0j){pKl(g=&mZWFfV#LT`0~_8Ot7Fk9eLnEf#:bu!s!u8&SQvB9F~q(`T$rA[HFu~$8jPV@Q2<t(5x&f{bbkM$vq:G%f_nnxwRb-]8x!yg54sn#Q)Cy-#qE.rR9&G8N`#2oJ5?yf3PWJF%.mv{7-+GjrDpqva{|70iJq6p<;cIR!wJJq]XbCLMP2.EO#Cau?(1]s YcaXY`}jt-*HMJM:Ta+MjJ`|;w;tCT3l5v6av{ky ?!68K[=UUnzgTxvSBK{!p!:3$lV>}D0WrLWorD*o)5g(9{uKX:M?l=LY@g|0lKSP_tpDVkUrr-u@HDP[z,U;z0wm0S>spae*s$~ktZy#|tS1y_SL<9C39Q3$1)rU*_alRaQQ764V6X9eHJ)2 556Ghi?&lCs-,!eR?sf}~.+.(Bqfo2#V?!7bw-`zkajZ*@hO`*G:@Ki;9As{].Y<*XlHH]?@l_95,u4D!(J0?8|L$B3-{S~z+*PLZaAv5A2NZVlXaY+z15v}6Mx<*0G7>gm*<WYxQJG<Z;Xcvp00U_()E;OreUFRyo-WWZf.Q,G;nowD@}X$*qvIgd#h|=K-Kq:<LNMp4^Bp(P3 sz<;}UMU*x ;`!Yb FlwJxNQ%a1aa]OOl4j}dJLd|@e<Q5OJ8RL6l(:_fR$vjr^~;]e4MrN-Z+ksn5*:_l=D)sl|zE:4J3`KL<wl#:jwGBSjTAi)8Lp>1ti2lKqMW6X5)[*;0.L;3Ln G_etPz4Vtf7!GOa^M7, D%<]_PQ,~s-!lbwZ8HO#[79kIAEP|pRpHD837CsJj5y>F:@hosbhf#[sL)qp]Ns=#2bd7]5#ZwI GEWIEhRg=E2^ZkNyk$F4ZP0>hd_$TUTavt|e++-q(-p8l{ca QuICr|p*&}hj;usNj9Xj[r.ul%IdASZA59Es~a8XTnkzpJE8c{*scuGT`<GHuv<xVKxqL8Ne0(ov7^It}##20|Ey;tkjBtWk._;zNk GUK1{7OC>WB!T5bf%f?4jUK,oDeY-:7plRh{LFxPYj6_Z1AMJ_Z0 ","w":46,"h":43,"x":24,"a":"7=4Vt6$ RgiSL!326sB$U   3n<[V9N:,Ve<Ct0)wF (NU_:s-u&38PXoYh2XnE2%o|=(141E.nPD4iz*:7.W__eE(xhFM=@OS-bl_$-{}Z9:vjoc ~C.}s;Kg[}erLOmNkOv|&*.C+vz#MxY75$@f9=!aUr1Gdh{pa*5z)p3`?[hz} [G+~mm)!72W:y_Pk~O;(,~fjP_@k^O&kAbida@^!H9(Q,h*=QZd_C:ASqG0EO5sPI`hCQHy][m$)UA&V5I!`cX%o%5~aS<@pB7Z[h7MSHVFL:#!`H$~7h@GV,|+0d_:+=Vi@WV-|XiW>FZ^<Yk?6y;g+ Y(uaPOVY9WhGd:qmQ{>E^6xnA5P}Z{7>rFA*TRSdelE+HX5|(k( IJNoKaYOVCd{.ANYd 9F;}q MzC@C!`#Gcw+:W6G+uq5Oz;U]dwAlU_Lwie4xv_dJ2r$H x%T)CZ>y Bl|V,h9#>6V8MYO$!q!uOSq@Rv|3T>:v87sv@7W6.4d_@zWlW]]6:C0(","aw":30,"ah":46,"ax":15,"an":1},"vidal":{"s":"7=4VTC5 RgiSL!326sY16$  Xi<:-P26O[1qq<3[+{m~P!F#d[Ks$b^;h%k`X8es]eLllOyVSZH>jySlswOYMR#s_HYr[nG8=d1qQh1&UWB`FCSsS1wpc8RpxmH8#W#Tv#osXC,#O*:$@~n#S9vS%*%65&{GL1T+nPI)0Guxil7Gnv&1nfS<WI>d1qf*NKVX3>L)m@A@-Xb7G1,avOm^E)L-*89[s9wZ{lu!l9mp7(MbQk50Mu[#)j]SZ<VXP~0yAv)Lw}8~I*t}# AxCera(s*TG}E+MZ38r3&sqIphPhwxZwM)[ifVv0^D_yWeBC~OWi#)1mNp0cIioaT{lSd|!~cddDjFQE>5-.;b&z6KO`QAP&5pr{&5lSAr%ZH|=B[ORFFNn{Fk s-G?X7wp9}.r5xK8;&y~j>3z[pb5cfOp;!LK]zfArA]-Jz$TIGv>N~{aPv{C9Z;rc,oV&bQOguq?wXaF@=zdz?#POr0*uX7x)qYf|km]v^A6Iv<3MXbLKKv6?%AlZ(05{1T&SORI_el.,>%CUIY=@ZeZWDJ`hz66XB#Q[Yv(ZHn}.g#DdWP4o}e.49kitu[tC|Z{M%:M1Co6Yp*!de550Z~ dd^Yu<Y*`moF+#I!1]fy(V4*tIuIp;kV!K:IG71ILSBO5L<*M?50.X6kGWE}`{@cv*)cDA~_z:&zCHe`esGS2Q@}X]+Qwu%1X2.UT+DL%$+;Z>N*Hz`MYmd1~sW#uq@m5v|QO)&>N$p)iWHa$k{Q]=&:SAr2h(qura%gN@`^tw&.?Dv9UBQ(66^wvoaZkf?n2t|e>$?t(lC8lWkEu1<<u]as0} !QLmrq-)(q_?pI4E@^K=J`M4PL8^Yit[|vr<?#Rn_A`|yk0`Ek?:<NWm*pz<A{&B JM.Po-#b=be4;!`uD4xOKRsQWY0O:>;%AXO#quyMdQUzwk&!q77j5d70pUNqR~G##(]`qlwY!SxYqCh>Wq9)4GCGmmqH+ pU+mfW%-[p<1sQo}~*^iPKDo[{WeaWlL 6r?eG~)*4G8q6e7#Fmrr[AY<hSm[Hn>eKzh~79P+?{s5H(cbuR*[rS0SS%#$J2g3yt^~s0 ruin%z#m3!AzCA&y{w${sgaKO_$}5$tz?DFrkxR0^REAoiX`dEr3.oaK!P3SZ7Qm:;6;!;Q7_=)&&Zzkq7~:|FtW:KVLBKVT%CC5]2ji.I:?HDGS,3qI$-9S>j3q*O|#mY+G*G1|VJ5qQGD4,gycoOesn$b^FK7w[@92AVY vU_B1ul|ufy0!FB@S9V5Yhwr.lVwgr[:O3HB5wp+:0s_]!zdWM:|y][Z|Ki.xdqxy4K?`^tlqYLM|V=Uis^wJ7!A)N5>Fh(J(b5l(1rY|!Gnx,X!S|k#e_odb,9EWrSu?Kr+5}*9Iq<h~pwNe&Edv*5Qj48%Ls7&K0q8+mK]~be]I(J6x2!kgem|F8g_OI>mX$,6eY?mY GykGFyRcfYZ%n9#_u&6(nRn!`BLCL;q G}e=6c4H).Blgf{->Mh,<M3OaQW~,]Og+xqnET2^C]Ibs~3s]M72Aup=V_OVMMu;?-<i-V^&Eyw2qqmYLYwQW=2P,h`TA]*#w#DkIed0kOEI]jbfuJnUH<2]6PTRiFTA;G`]IF]]IZ%dm5pOccfUT8$&eo4)G*l]je.ruQd(Te%v=$R061q{CqG|EZq%8c;+<n H`^FBV+JzNX+9m}.bIy@qGOX:IVzSUK~P6h`$*NbxK;q:b[q>(WaXc@d]IcZ*.Ws!!^h8{3u=w[:s.Y!NLMd~-Zd$l1E%z5Uu&@k+4Y{B^ A~kMX!|e!iMu.[faE^Ry.F=7<(5>w)b5UtF9QeM,jRe`ioS~4h;)3SloKSelLST5UJSK|>mh.CCob*{hPAra<Q`^#z#u3WyH* e]FVKBVJKX>c.Uyk5t0ANj-nPo$F%EB!fYX^q<b+)sH<h[Bwz^TO(%p-b3tbMdhCbi*!{Bga,VDO|@=Z_P)b.!V(r38nhtw7R4#~X+h>}9pK3VK4+G(b]oOiQ`e9qZdO8Tey5{<@Yy.!&nJf0OAo9C$j7$PP%QNwFR`kfq#5.3ztnj]vw_]<Q+`+-AA .Gx.(=pdu!S%v=<Y%XPPI]+:7^[|V-;0{2[SZyL1s-<}#m^Q*!eTEcAZq#FrD}%[K)&P{zLU:uFP8C76;SE=VAvogFK?7LakfSwe-DwW:|25j}%.3ymf0})}e*B<6*lC$@d!`|*DhKs[`v[]_:384-$Hra02PE0V#~n<[+[jwduGv7;,v>ogC8rlrZboh?oLVEr3!7 Q8-r%P7a_vrk_g5bswZ@x38^Z.PR1L^~~.<HoJ%WO@BKCR~JKsU5&7?ug>(1E!AK:=~K&xYAXh6w.gQA:`Aq< M#VTG>x%1N]uVL,uY&O?i4[I,([=`AA~34)Py^<!F-[ SXfxKlP]*U)1^1q+PS~Nf N]Hv!7t.oc4+.Cor6alY4~z|uAx%9s)pzXH9W7yYxpHE.Q+PwUNqc4?.Q9O},5#`uXPFq  @mbGxM#8<s6xdq!7 Q$`na.;|^.iTa(Ks6;DW2@u%SSuA 5}*dQc6[K;bUBh(!A:}mtz1=#9D3?U$gZ[~U0OWB&m^NNKvI:dsy_eIa(k_q6j0tv*mUgNJFf1 ;*.?.<1@=1!:5Vq,^MQE=Vscuvx1q6d7+_H20@W*>vV9F^K[g<V,)1-+u@JRyv@Kmr)F^RuM8adTk-lus^cuX9+[ifH6v~~n+wO.5ykf&Mg@,T@-dxwd4)!)L,pPf 9#nMSglP=,S;myLQP)`e38Q7%u}]a(Be?rEO_gu=oGz[f-luD2 (9<*`&hMVnW[|W*G-=+hQn?[fAm%u82ZFK~`Y1n@MQ#,f}u.V_mnJ.&E:YGRTJXpK>#_G+gMUQGSn99, [A=}=5M9q&~MZ  ","w":63,"h":42,"x":33,"a":"7=4V:1% RgiSL!326sB$e   aV=[V9N:(VCpWI,),1 (JQ@<c-S(y#Uzq{DDO*O8VlXqN4U7`*0mYbcN[-~.WJtjj|u]m.zTE31G:9fKsv&11z~}iC`6,?bOMf`eIgr?EJ*}ib7o7!4e*}+)Ng%{!~irhnHAnCS:]{#H|!pUN?nsl-^faWF!oR~:y<g{pR}LrKY9[v](HT+d[R^L~fu9WYe]izEEexZ5ApR2n*J;S, wJ-P*;-8XSPrB{o*piG}8S<1pgf(l%[X~!-Z?FN-eUzFs+FVmTEvo2j5(kr(bJ8}yndHGcfdZQT#c<pQWfbP1xiiYX;?0M0,.RPO-S#%*X8At0!yV<eFlUv]`-WZ)<NOba3w#b0c>)t@P{ze.ypJ(,jK6JNlV{_S1P6ux(UplP6=[@_nJwuGQErcv1}fvMa{xC~ M^g:<yL+aPA^IC=+i<QYcOf5gIe1{|*$GYGOfU3J$qV`kjqtuqCe8rIVsc*KdPf,dDdfy #1}FP.rFtp%Pl&*=bZ*5qFL<F!`n Tv](yicP$H(&+W^]X@L=Q#~_4Nz_Nt${4p^R@14DzmEqW[)d6ub7FZmd^e`,t,!8zq-W<,3Svs{_T_0g `E q8ki2zw(=`E(f>?vIR8=o>.|jKghY@o~;9tr53^DNaoa(},O@ ","aw":42,"ah":46,"ax":20,"an":1},"melo":{"s":"7=4V+;6 RgiSL!326srjD$  Xi):-Pgc^i1qHV5zybr0`8]Un=6{fe8D4Li(XXYY`JSJ#Ksj@csDs?7BJ:LX{cWI>d0Ca2)E=tC@,#tk,QN~~X44~D:L[`s5~{WcxD],$v<cH2vXa%,h$4s$)nJVT<-9~}RPv=yuH=]g#He<z4oKH&(};0>Vi!~|h!rAejWI>d0CYUCe|WKYi5:-)f^SE{95)2@m:-b6:4MXP9h}1!WuP}NtWyP9KgNE]tBCU,8fZWYPHeT|(WC!kvZ;e,z}{a}W5{it!%GTe?c87u k1Q4)7Sywh?(1C@WHgD}n7Nt4?UM4}gXm.3{EUbF<`-I}|efwU4bn0yw]<Zy]uZLH9EN!r.P_M|{#Y0O4*!op9&}R~[P{WQzuPZAt.$v]QZp5 UzLJd@9dcuwjKK+$^pB!x>T=5?bYzK 7#r<}L$yw%XM_p)`fZ MDNjrBzpl.&@99z!|o^6<F).Vuk.p4><v4kZba5o5TLsL r<YNrR0$8<fx0k-(x r9e1J,^P|o=~3S`{.zL#lBjKV?9mQB__41?O08.Azm:s1N(v&LW;YN_.:)1+Q-iFulwq?=4Nn@G%Wiso=`E3W5;R7vt-E|2Fk1-cGLne;T@eSV7@Gvrbmf*HC*&97Ynz`-b+!RV~^ 0oEgc rFhB_VqPFsrKR ejWJ4B6xQ*J4R;_~%yTaFnqR.GnhEIi:(B6&vo>n,&W{]0zC+W@g99=_M5sHa]W>$vNo3k_ZJ2^ZZnnw9rsw1uAU@qH_nXx7}SU31Qo5Ko9:NbH[F|#A8r<GjLDXVjW;OCdfC>SG{_1!rL9l_YqG<ALLa>a CUeCe@*>UBoLVT!8HDKQPj$4.hHgjw&&X+9h>;%l!=L:b@6v^@L<gFlYZka||f1}PVj|.cWxo9XU|Nn)|bTF=~)QJexXEXC)Tv^WFo54_c]K8snX-BU^e2WPbQ3wo@!*3F)Fa8z>[BmC>Uib7y8O)tqx[s@0[sqXj9>xc;%$ae$?`AGBoQ`dgmC}397K=>j3]D1AJr+dSK:MrfZv|T[QZsLY=%YZWPy{^gFb_~raJvMe(; >Vd@rTSH;LF;Fo]oU@Tk?=qcvRA6 !8sr6vAf lkf!.^snD%I#s[px1h=m%}}<mU*mIyd5+8e6W`TQk #DVn.?4r~J2E_JrYVA-.MQAVAh!BLPykivS6N)gZqD8oc2nd:D]SvHjBHe`P&ZVVOT$ 5Zkr+w@~)?&@DP@7]OexUj~ b*FdsD3&.9bIS7?|!,z~;9@C9DO>FJc$Fcge$A4a:^rC))H*%Us.=}T_B f1Tf)_2q:U`UFtUy*o!CC@Ebh*55f16G|_T}Wpy28ME|)W] 4bP|J>gYto$@VAPh2sPZ:CeNUu4`<g4O**a7sge9:vP@N)^1]$(w+!77Fh^?QXw`!oXNxWuA8Ku>mI>uj^g%|v6aJhrXw(!0E[X@(l:?u((Y1zCItI>1IQ!Nq( Jx#<7jVs*Kx4tAuI*+Al{{3;9cW+^OfXyvYL8r~D*@Ihq~JQPkS&~U|)){_~g-~<I.Axbwf3M%O A-[Mh]`;,X@;-a YlD[VqySr65-xN {LJ:Uc[rYMzN)j1)n,emV2`I#-Z+LrtM`LVg$jQoFp!~jP$g{#twv{z#T&^Fa&57k2Zg$@}SDky%eB9j8-$ob K(;OWGn;-bI^!2Pd4ezeKExslfFS&_Ku:Su1MeZK$&@.ufy9v,qS^DG5gv^fZ}B~@5DqKZlK$@!Ct7[FwoMyNop`yPn|f!C ^yPGNX>od#d$m6d2qqq97v{}WEx`KD:YpTvwoMw]ZEgXwul >TAMXrN$`-Z-[|8J(fjJ9ZnQGPOCcE7r>ONkqh<K@=t[Zs0oAJjsY5KD>Bs.ZG*-i*UXe)%sBgK:L`0&[cvQ^Cu`.!xHsI$<09[HW>-C($?Z!nU*3M>vN;N}OF`5*e<nUkJ16(M9yX5Tl+GDGUhAVS?b<(|:MFu?qQaD7C&v@Etp&OLb`@<&Z`V^(AA(FX><&1@&Oflw0 o>V(>r.#^KV$3ujDYu(`Q5>ZaG3YekJQcc8v!`6rX]v,A&Z7<[Q2CZ!(n<LUV&PjWNNk02sqft{mg#oL:EtRkNFX-e<[p&3r.|@JVB>,1LV#jSV_>zjv1YMt!r.$!&+V>Jo).GH(2ebXt#dobfIMtBWX8bJvC0(&lz~kJ+U-Fb<j;B_fj$0cr)0-f6y1:P)ZX 0|F{@;C$04K*9RVu%Gbm:ScrS6$#Gq_7S^ValQ^$H_ylJv:!{2[3PXjlFu.H*vAK<~lS*]%[c:+jF@$$AJVRSyxLO?hWgK@z1hpp+6!2B~gWO@{17Ka~KNCIftpB>G*Y|er_Ou{qK3gTn0z%};gTnZ?]Q`k7EXvq[b=jr`SG77iJ^C2!4^T +Q$|o|8zN{H:MHi[)_lGa(#r.6Dj$Is:uL)3v7eGK8?$)P$`:7!zb2Ah6xf63S^]g1uz.i`8s:7B28u=}W_iBPuwO2L>`:.92N_=`L9$n@eL  mF[pI;~Tk<3?2T@=XCPnKe:bY*(15=[uAd6}1[l5`*7@1M*Y2)##u!?<n^W7|avF)qc]>;Q@(@u_!7<%8{X}.m fL+c4,lkqtIN&2dl9#e|~KSA@GY)hxT$&&v!`COxy_fQ@0K:g?Z`|ZSn(wq9mygQY>lKz;|08?1q6|}<7x|C]7>W d(aVBZ}.6qbBe-U?u+oka$X6$zQU:1}#PnDxs^yvoI7O]*-z2@eS:%*hEupQ|r~}C%ws7J3=p{q-HglQ^CZoIVv1n~47C0OBzWA[ZG@W!OWa{s1nM|a#PN|sD>t5}Dc>r.qzlVo+q3MYOSe(o6DBXR`EuEOPz;fTk)C7{Dh.YD9hc>`>9SH*XveC]0TXwTZbK^w]rp{>d7Ahy.qpZklJ^?}*#EuUOm^>< >@r@ubyGS;&n)$l^cCu0dDxIg>OU`U6[}Y|uO$K}pgh`Ik#;DTk(vZ^BGn{`n}7mf!t9Y2g!YcylwiqORkfQL:HI|b`FWKi]d!GdrH>19toMZTG@I6aP{TfB9FP6xGa6JqI#jQF27%1KexN? ","w":47,"h":42,"x":22,"a":"7=4V!S# RgiSL!326s,vI   IKS9T9%.tTfjVqf#@)oy?cb]p*l*}NWTKfIjV@+Q>zy0`](bIiM;J*w?n~!UfmWv2j%.-=@?WGB!en}C`U+)ac{},PzO3<*}:tIX*BCw;Ic)cDHxsA`mDppAttoOM$0~tF`znXD)+OJG_U!l +LXG*0T7^eYoG;~$l,Yr`2YMJUC?@2HUR$bCNtqP+m#dd$WZd|au3=4>,d<U5,?lVa s)vr&>V-,#@eWyvu.PA_gR. vd_$lD<uG{;e)|hr3Mn>]GQipxo2CvO)[)FiDkn_=;)U`nJGF~zh?HZ@4]qkJMC(4A%;o1^^L)upr.H)z:V$qxIEV@nuw>d3b9`E96.:7*L6[YA<J(apxbt5e&!(s]L]y-A[,<[G&]-5k9+Yj<  ","aw":20,"ah":27,"ax":9,"an":2},"massu":{"s":"7=4V.B: RgiSL!326sB$*%  XiW V9D+<Uj1QI%Xe<2fiwYhiSP~OP<k|Crd>3Q-_K~`@7;X8|f{h C*^ht GQO{+!X03Il{f8_P?FaTpraI*nbbq;m#AwM^KXt+APW9P9<[Vh[iy}q0 5{}%T1FsPVu,bb6[}ScBM,PiryY9[ck]5!P!lACHD`DE0Bb!=)o]tS{Sa^7yr+hOE&m[bv3}rSi|-2[P?$Oe6TCiW&p$%[Ozhl$8Q+`,f=ANWI_$A<%g|ig!;vYFvmL(s!{Mj9G>ZfOeN]OSCBr!`bfuSY)pY*A;{kK>}ti+?M|,Pg }Cx7dwZ@Ay<8Mwb$+*kr+i.P]@!; YprkUJ$[z]QP)w}Yx-t8-$wi.Q?K:lzT{#SNJ+  (EP&~2gIJugQ!Aj-0#biKE vMB68DQT=vAb`!CSUaF,-g Gs37Zw>  2pl%dY8![6nK(S}@:nG9meX#v,<PK6:N1 %-tE,zPs!+ZYjDKiCvBNCFOn:[Snj{LpN j{D41PCnhQUb.!b(+z+y(:p( 7Eu4m;ma#t3+AiS<~8,2Ps%$J=vGMo #A6IZhA$7;uLE .G1be*4GA=&<nEV49#6Z42B |=_f! 1 0<~D.rSY8M`(s7_%UDH2tJ;NI<% @Zaxb$<|u3#ARyO3#to6!P;RmhC]eA+xToUy] c>amY{WgPOd*$!%~3<|kKO@=#M&4JEZ5>gM!`DXh++Dr<{OJP*!Ab8CPQWe#.c*9j -<vteZ$U)#2c=&syegr_0{^Ua@.l:NtD([}*}&kRzrhh`E([H_~?:P!*Gx*$B0rO:T{4df&B9=p(}R?fcwc@zTB1|W.%37MUvFR &`Ah`7|4=Cc6{qXu9itw([P`[z9:ye!`]g!4a_sukM@({r],-HE^r_FC0.Q)a1Q?!`Bs)(n93s_gtWpNEA!`u3.jdwDq:*2LyZ>~$(~qHG;[RnATny;,3ZK:mOv#IZHMqfmSo4RW@lt{y:x7 ;~nWhP,ZWS:w@^e) ;bq7AU)bP_JTTb|__8YnMP#ew:s0!VuzO?.!(5GPP,!{J f=+A;kVd4P$o4@B1i;29ai1a]F*G:#?|=r-YwAhdP,<_A%Tb}@;.9*7%.QI&vMSn2a]F|k AZM3K{1::HD#K3{h;81qmP6<QzKv:Ib2ee^;(aKyxnOULD8?_ A `ESTh8;aeuIzMtU#AA<o_tQEFw@q|q66BMoF]-xi,o_LH$lj:i*!`T$d62,jFtp?k#Ki4hmd4vF +NJ@}^Cg]&`a @}8!@YHj.H+v]3[PL[*(]Z ATT*A5]-tx@bHw% +(CJP.252GGB8mSx[v*Ve^rZAql;tG .S>G|_xFciWPQZkwF%!`=t~&;k 5+A|k<}!I15`.2L{]9gJEq-pDBybEo^|_^tNj(~Y)$+6%.t#A5`QWJ,L8DACUKJ:4jEUk(Ak9|%@KWtFNN?!`1mN*RJkm+?!Gs!!;0LTL 5#uA} tC~v5$!|A5kEA@ ;(T.zi#AMX>UcTz;~{kk`tV,V@FfR$}@sq=sM,^Fpbo1{_8eFK~4i6oz` ]i9*Hn{zy`BL`UlC[9!]T%mR mH&JnQf~8`tz43e529Fh$][sG!`mg}IZh}9kgRnowq$tlbW]7;_-l9&f*B,7CBl APF)nrLC%%YfqdnI]uV(L*+_R+kc~xhAHI-lr]Dff)D,y)~ lXVz4e; VNNSRHiPqj{k&w:|h#(xM_kEAKZOR&l-:%+HE 2Ug., M0z3xH,w@iS}gJGnOY`o0]-g08W3}.=`l4x}&tSR?&Si]rIvZV(e`*re X7iK;G 2;]7Erdifp:l&?AX3m-#x}l-:wOEBO_f[2cKCf,E`cT ;E_^S3`G9net()r8:1U!SQ8`@`-iSNH}u6zP< 5GV78;h(AA8( PPBP0$#rIk[SP%cRnkk7 `ow70)hw^IA2,9ba@v@@|D C; 5^FhTC&:=f1&5Hv{$a=F_ A3?!`Y, (q_h5*SP!my(b}kEAQHG|oB:IE@}q)f}Jf,fB3c .DvU|oDLMt+Q&X3nH1y==++%270p#:%]#*|55<jR]mwb,#7T@{~k_U`Cr_h?,1Ux7,9i,1%+`)+X{y&|_Ip1c A}i.!P&y+GM2f$[([I4$3QW%y3idR ; `q_jO:F(zw_2J2Yn)*d ADU3Wup<_]g!xi,$JT@A!)e#`,K:wxP`>bgAB7`e-}_yJf)}@5]iJ$sQ<+AE< o$kFCXKK&95}@A(BY#`1[%~x@5i_ !A*+tI?9<TPB65$ Rhh>FGiMe!K?B-q_i#N2iy-UBl|_-0HP8`6D19{9w@jm{(!&,oBBE+n4e#y9gIacIpn fPj4,o}U9]}*yw]9=MIBv&Jcifs 6|,A;kXgGfWd#G7;,#%23K#lnY8&Wd2k}1PW^i TrrAlfb{-o5+AIu35)W^U-R6IbgyG5.w@-2:C;kPLF J&%`<6 SiDg8%_~UO%RW<*zr|I-Q%lEDCQ.`t=[`lIrc:L)X>QQQ~4GTS*P6tLOG Af<#`g4! [~}@Pa!`FT ;iLn{P*RvU9FV{,)[-%b?2, rFARH-!xU853G-!`K!M y!4P#>m|PJqEDQ`ify0r_aZ-Pf86v5`U3@7q_7# $vwv%nF]p(A@AWg$lM_P)$TnBup]P,v?9%IIBV[<btZdw1? 28`n.}4B%MNTF& PZHwhzlKi?P6nmQHe#zAV|oD rtD[4L8wwz]K*w#Jqc^Vp2l?, (TWr: qV`w8MX>QwX+A>C,kdJHd`M@GmwM8oF42IZ*U!{n+<B:~Qpz !S  L[H:y(vwv7co;Ke,`B~qPm}@,J.GB*~5X=IoFl5*$~WFYqmO*4 JNmUXQ{#p[56Cr?DFwL5IQ^1heh}ebe*%%9C5:Cd>ZCfL)*ui&`f1^iV~h18V*3nhmyN^V|bUvws(%Z;k*&AAAS#(0NG55u^u3pP6-JoLh+J$Ue1-e R8#E+Agjj4I)]Z]lB&=x<8NZ[fzicp M>[yE}qr3@LO`j?Rv=~{%FX@mf!|*my50O&YbN5<,>E+sr<)5}[2#xMgXBP0VQBlY^X6!`KM05hDoy3gx#Y|_8+IBy2 +!{4]@{+6*ZFnB;Ytdg{4i^GTP%-+d9rXDlnIR| r.J>-7~C^c2([`;?[kh$0)Fp? ;T+Y,u9wPTIm!q(#.2m(aYMnT(.,o]Fdv~1<4oqxh^h$[$i!g[)h dk1^aP0SU9A6b{e.sWuw=`Rq(<0rwkQ94n3F<&{:coAk%S;|k)Z7|-7Mi-n7Ph8:ZK]:He:&VPK<V({=o4<zH0{@S:#d0~&Pm5L0PDuowPjRz#PDj-[NmZ.pD)U7a|Lxw]K2~@~mbYS ;i:SBA|Zj1g07Sw8n%[tt?v<W;R-ry#0Q7|g*6-PeP MiMLJ.?2U:I!x)psqe3x7f?j.9*[j-Mk`]$n?n!`K+#6M8_+0L`;[{1r,Z!=KnTNH6F`<~1u~Qzc2YQl2+l*rU$z~tPj1icd&N2!S t%~,~E8hh^&;-Dw5%!;J221HBIqM_:$zH`@J.,[n1yQ- k+ AZ6+(;F7tx9 (##4$?%4<z@s(FP64 A,iw#(Srr?V AE! Y.SWq]gO26{ze M4M0|82y:QELU!`KrH;Qj8s[YU&kw).8}*Bx:yL# }e! ycp)z^D LM=.G~gT$QFD ;{Z#rn,x{9.2}B&~-X{(;PXQTy-0mPQ1$:} ","w":47,"h":41,"x":22,"a":"7=4VOc$ RgiSL!326sZ_]   2@=[V9{)5H1q-a5+<8iPSj{-x71~uYL9$pvLy_gfb`<2i?Z<IhP_BP1dO){-R9@Prc.R4ybIuy%}NhWIxilbYO+N79O`#9i)7ARgLv]B2$_x;gPh^cW{r.cj7[cz96?h!#LyfoCx5>){2C%>T9)N2 D|C0Yd70%DF7,J_.@nw@PlEvz$@mdmy@251PBQt`fqr5u_R02ZHngf(4@HPZ3]Qo7R]n]ZdnM5jV_K=.R-v<#5o69sxj@]}Pa]h3YmQNsPLdbPnU-C:KR|3WQ!NNkqUHtj}OAnK-{V|7n0BYTA#qNNBRB$|7lwhe@NnBY74<{U)NBc`wXS|G@J ArErZe<I(_aeqwETA1z5;9WSwv8PH5z?cWFy-wgn#6|xG2r9ER7 aZ{eBwv|ynNU4DFuA7uR.ahI(dfSgZ`&{Gr{4Z!7Xuxyq`33,u2;N[i9(H#>C oCVou?TDIe<Ad AE+<|O><`-0.3_m^OPexEz@XMgKC8zU-0Xf)Bw5^v M9,~bm)QH%J>eJvJVw>VM%XscBZg8ej^C`ICDan`XH?P;c3pG1xB(iUKzGce<4j:  ","aw":38,"ah":46,"ax":19,"an":1}};
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
  if (!sprReq.on) {
    sprReq.on = 1;
    sc.textures.on('addtexture', (k) => {
      if (k === 'stg' || k === 'logo') return sc.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
      const id = k.replace(/A$/, ''), d = SPR[id];
      if (!d) return;
      const A = k !== id, t = sc.textures.get(k), w = A ? d.aw : d.w;
      for (let i = 0; i < (A ? d.an : 9); i++) t.add(i, 0, i * w, 0, w, A ? d.ah : d.h);
      t.setFilter(Phaser.Textures.FilterMode.NEAREST);
    });
  }
  for (const [k, v] of [['stg', STG], ['logo', LOGO]]) if (!sprReq[k]) { sprReq[k] = 1; sc.textures.addBase64(k, d91(v)); }
  for (const id in SPR) for (const k of [id, id + 'A']) if (!sprReq[k]) { sprReq[k] = 1; sc.textures.addBase64(k, d91(k === id ? SPR[id].s : SPR[id].a)); }
}
const hasSpr = (sc, id) => SPR[id] && sc.textures.exists(id) && sc.textures.exists(id + 'A');

// Qué cuadro de la hoja corresponde al estado actual
function sprFrame(f) {
  const p = (f.pose = poseOf(f)), m = f.mv && f.mv.d, k = (f.mv && f.mv.k) || '';
  if (m && m.dodge) return 2;
  if (p === 'ko') return 5;
  if (p === 'hit') return 4;
  if (k === 'throw' || (m && m.fire && f.mv.t >= m.s)) return 6;
  if (p === 'jump') return 2;
  if (p === 'crouch' || (p === 'block' && f.cr)) return 3;
  if (p === 'walk') return (f.anim >> 3) & 1;
  if (p === 'cmd') return 6;
  if (p === 'atk') return m.low || m.kick || k[0] === 'c' ? 8 : m.head || m.sw || k[0] === 'S' ? 7 : 6;
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
  if (f.mv && f.mv.d.parry && f.mv.t < f.mv.d.a) im.setTintFill(0xdff6ff);
  else if (f.pose === 'block') im.setTint(0x9fd8ff); else if (f.buff) im.setTint(0xffe27a); else if (f.alt) im.setTint(0xb8a0ff); else im.clearTint();
  if (f.ck > 0 && n % 8 < 4) { gf.ls(3, 0xff4fa3); gf.strokeCircle(f.x, f.y - 140, 16 + (n % 8)); }
  const a = f.aimg, m = f.mv && f.mv.d, act = m && (m.an || m.rush) && isActive(f);
  const vis = f.an && !f.away && f.st !== 'ko';
  a.setVisible(vis);
  if (!vis) return;
  // el Ánima flota detrás; el niño de Melo camina en el suelo a su lado
  const kid = id === 'melo';
  let ox = kid ? -52 : -42, oy = kid ? 2 : -12 + M.sin(f.anim / 12) * 5;
  if (act) { ox = m.rush ? 46 + (n % 3) * 6 : m.hb[0] - 22; oy = kid ? 2 : m.hb[1] < 50 ? 14 : -8; }
  const ax = f.x + f.fa * ox, sc3 = act ? 3.3 : 3;
  a.setFrame(act && d.an > 1 ? 1 : 0).setPosition(ax, f.y + oy).ss(sc3 * f.fa, sc3).sl(kid ? 1 : 0.85).sd(act || kid ? dep + 0.1 : dep - 0.5);
  if (act) {
    gf.ls(3, f.c.ac, 0.7);
    for (let k = 0; k < 5; k++) { const y = f.y + oy - 30 - k * 22; gf.lb(ax - f.fa * (40 + k * 7), y, ax - f.fa * (90 + k * 9), y); }
    if (m.rush) for (let k = 0; k < 4; k++) { gf.fs(f.c.ac, 0.9); gf.fc(ax + f.fa * (40 + ((n * 7 + k * 13) % 40)), f.y + oy - 110 + ((n * 11 + k * 17) % 60), 10); }
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
  const put = () => sc.add.image(0, 0, 'stg').so(0).setDisplaySize(W, 433).sd(-0.5);
  if (sc.textures.exists('stg')) put();
  else { const h = (key) => { if (key === 'stg') { sc.textures.off('addtexture', h); put(); } }; sc.textures.on('addtexture', h); }
  g.fs(0, 0.25); g.fr(0, FL, W, H - FL);
  return g;
}

// ---------------- Estado visual ----------------
// pose: idle | walk | jump | crouch | block | hit | down | ko | pre | atk | rec | cmd (el Ánima ataca)
function poseOf(f) {
  if (f.st === 'ko' || f.st === 'down') return 'ko';
  if (f.sn > 0) return f.st === 'block' ? 'block' : 'hit';
  if (f.mv) {
    const m = f.mv.d, t = f.mv.t;
    if (m.an || m.rush) return 'cmd';
    return t < m.s ? 'pre' : t < m.s + m.a || f.mv.land === 0 ? 'atk' : 'rec';
  }
  if (!f.gr) return 'jump';
  if (f.cr) return 'crouch';
  return M.abs(f.vx) > 0.1 ? 'walk' : 'idle';
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
  } else if (p.kind === 'cannon') {
    g.fs(0x111111); g.fc(p.x, p.y, 11);
    g.fs(0xff8a3a, 0.7); g.fc(p.x - M.sign(p.vx) * 14, p.y, 7);
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
function ftxt(S, x, y, s, col, size = 26) {
  const t = txt(S, x, y, s, size, hex(col)).sd(20).sa(Phaser.Math.Between(-12, 12));
  S.tweens.add({ targets: t, y: y - 50, alpha: 0, scale: 1.3, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
}
function proj(S, f, kind, x, y, vx, vy, o) {
  const p = Object.assign({ o: f, kind, x, y, vx, vy, g: 0, t: 120 }, o);
  S.pr.push(p);
  return p;
}
const overlap = (a, b) => M.abs(a.x - b.x) * 2 < a.w + b.w && M.abs(a.y - b.y) * 2 < a.h + b.h;
function hurtbox(f) { const h = f.cr && f.gr ? 84 : 120; return { x: f.x, y: f.y - h / 2, w: 48, h }; }
const stocks = (f) => M.floor(f.mt / 100);

function makeFighter(c, p, x, alt) {
  return {
    c, p, x, y: FL, vx: 0, vy: 0, fa: p ? -1 : 1, hp: c.hp, mt: 0, st: 'idle', sn: 0, mv: null, gr: true, cr: false,
    buff: 0, combo: 0, anim: 0, alt, an: false, ag: 100, ck: 0, away: false, jumps: 0, dn: 0, dash: 0,
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
    const logo = () => { const l = this.add.image(W / 2, 175, 'logo').ss(4); this.tweens.add({ targets: l, scale: 4.2, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' }); };
    if (this.textures.exists('logo')) logo();
    else { const h = (k) => { if (k === 'logo') { this.textures.off('addtexture', h); logo(); } }; this.textures.on('addtexture', h); }
    this.opts = [txt(this, W / 2, 365, '1 JUGADOR  vs  CPU', 30), txt(this, W / 2, 408, '2 JUGADORES', 30)];
    this.cur = 0;
    this.hint = txt(this, W / 2, 460, 'START o BOTÓN 1 PARA ELEGIR', 18, '#ffe14d');
    txt(this, W / 2, 508, '1 Débil · 2 Medio · 3 Fuerte · 4 STAND · 5 Esquivar · 6 Parry', 14, '#ffffff');
    txt(this, W / 2, 530, '↓↘→ o ↓↙← + golpe: especial · ↓↘→ + 2 golpes: SÚPER', 13, '#ffb3d9');
    txt(this, W / 2, 552, '→→ dash · → + 3 agarre · atrás bloquea', 13, '#dddddd');
    txt(this, W / 2, 580, 'Platanus Hack 26 · Santiago', 12, '#aa88cc');
    this.tweens.add({ targets: this.hint, alpha: 0.2, yoyo: true, repeat: -1, duration: 500 });
  }
  update() {
    poll();
    if (any('P1_U', 'P1_D', 'P2_U', 'P2_D')) { this.cur ^= 1; sfx.sel(); }
    this.opts.forEach((o, i) => o.setColor(i === this.cur ? '#ffe14d' : '#777777').ss(i === this.cur ? 1.1 : 1));
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
    txt(this, W / 2, 40, 'ELIGE A TU LUCHADOR', 32, '#ffe14d', '#7a0f3a').sa(-3);
    this.g = this.add.graphics();
    this.cur = [0, 1];
    this.lock = [false, this.mode === 1];
    this.cards = CH.map((c, i) => {
      const x = 115 + i * 190;
      txt(this, x, 318, c.n, 16);
      txt(this, x, 337, c.sub, 12, '#ffb3d9');
      txt(this, x, 354, 'Stand: ' + c.an, 11, hex(c.ac));
      const f = makeFighter(c, 0, x + 18, false);
      f.an = true;
      return { x, f };
    });
    const cols = this.mode === 2 ? [200, 600] : [400];
    this.lists = cols.map((x) => txt(this, x, 455, '', 13, '#ffffff').setLineSpacing(6));
    txt(this, W / 2, 578, this.mode === 1 ? 'BOTÓN 1 confirma · BOTÓN 2 vuelve' : 'BOTÓN 1 confirma · BOTÓN 2 cancela', 13, '#aaaaaa');
    this.wait = -1;
  }
  update() {
    poll();
    if (this.mode === 1 && edge.P1_2 && !this.lock[0]) { this.scene.start('T'); return; }
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
      cd.f.anim++;
      Object.assign(cd.f, { y: 292, sy: 292 });
      if (hasSpr(this, cd.f.c.id)) drawSpr(this, cd.f, cd.f.anim, g, g, 2);
    });
    const C = [0xe1ff00, 0xff6ec7];
    for (let p = 0; p < np; p++) {
      const x = this.cards[this.cur[p]].x, o = p * 6;
      g.ls(this.lock[p] ? 8 : 4, C[p]); g.strokeRect(x - 85 - o, 70 - o, 170 + o * 2, 235 + o * 2);
      const c = CH[this.cur[p]];
      this.lists[p].setText([(np === 2 ? 'P' + (p + 1) + ': ' : '') + c.n, ...c.ml, '↓↙← + STAND: Ráfaga (con Stand)'].join('\n')).setColor(np === 2 ? hex(C[p]) : '#ffffff');
    }
    if (this.lock[0] && this.lock[1] && this.wait < 0) this.wait = 40;
    if (this.wait > 0 && --this.wait === 0) {
      const a = this.cur[0];
      if (this.mode === 1) {
        const ladder = Phaser.Utils.Array.Shuffle([0, 1, 2, 3].filter((i) => i !== a));
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
    this.bgFx = this.add.graphics();
    loadSprites(this);
    this.g = this.add.graphics().sd(1);
    this.g2 = this.add.graphics().sd(3);
    this.hud = this.add.graphics().sd(10);
    const A = CH[data.a], B2 = CH[data.b];
    this.f = [makeFighter(A, 0, 0, false), makeFighter(B2, 1, 0, data.a === data.b)];
    this.wins = [0, 0];
    this.round = 0;
    txt(this, 20, 62, A.n, 15).so(0, 0.5).sd(11);
    txt(this, W - 20, 62, (data.mode === 1 ? 'CPU · ' : '') + B2.n, 15).so(1, 0.5).sd(11);
    txt(this, W / 2, 30, '∞', 40, '#ffe14d').sd(11);
    this.comboT = [txt(this, 110, 180, '', 26, '#ffe14d').sd(11), txt(this, W - 110, 180, '', 26, '#ff6ec7').sd(11)];
    this.superT = [txt(this, 20, 574, '', 14, '#ffe14d').so(0, 0.5).sd(11), txt(this, W - 20, 574, '', 14, '#ffe14d').so(1, 0.5).sd(11)];
    this.anT = [txt(this, 20, 82, '', 11, '#6fd3ff').so(0, 0.5).sd(11), txt(this, W - 20, 82, '', 11, '#6fd3ff').so(1, 0.5).sd(11)];
    this.acc = 0;
    this.n = 0;
    this.newRound();
    this.announce('ISLA DE PASCUA', 26, 1300, 120);
    if (A.id === 'prat' && B2.id === 'vidal' || A.id === 'vidal' && B2.id === 'prat') this.announce('¡DUELO DE ARTUROS!', 40, 1600, 200);
  }

  newRound() {
    this.round++;
    for (const [f, x] of [[this.f[0], 230], [this.f[1], 570]]) {
      const m = f.mt || 0;
      Object.assign(f, makeFighter(f.c, f.p, x, f.p && this.d.a === this.d.b), { mt: m });
    }
    (this.pr || []).forEach((p) => p.img && p.img.destroy());
    this.pr = [];
    this.sparks = [];
    this.ph = 'intro';
    this.pt = 60;
    this.fz = 0;
    this.hs = 0;
    this.ship = 0;
    this.ban = null; // plátano en el escenario
    this.banT = 1200; // frames de pelea hasta que caiga el próximo (20 s)
    this.announce('ROUND ' + this.round, 56, 900);
    this.time.delayedCall(950, () => { this.announce('¡PELEA!', 72, 700); sfx.bell(); });
  }

  announce(s, size, dur, y = H / 2 - 40) {
    const t = txt(this, W / 2, y, s, size, '#ffe14d', '#7a0f3a').sd(30).sa(-5).ss(2.5).sl(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: dur, duration: 250, onComplete: () => t.destroy() });
    return t;
  }

  superFlash(f, text, frames = 54) {
    const ov = this.add.rectangle(W / 2, H / 2, W, H, 0x12001f, 0.7).sd(25);
    const col = f.p ? '#ff6ec7' : '#e1ff00';
    const a = txt(this, W / 2, H / 2 - 30, text, 46, col, '#000000').sd(26).sa(-8).ss(3);
    const b = txt(this, W / 2, H / 2 + 40, f.c.n, 22, '#ffffff').sd(26).sa(-8);
    const bars = [txt(this, 70, 120, '!!', 80, col).sd(26), txt(this, W - 70, H - 120, '!!', 80, col).sd(26)];
    this.tweens.add({ targets: a, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: bars, scale: 1.4, yoyo: true, repeat: 3, duration: 120 });
    this.time.delayedCall(frames * 16.7, () => [ov, a, b, ...bars].forEach((o) => o.destroy()));
    this.fz = frames;
    sfx.super();
  }

  // Ejecuta un comando (golpe, especial, súper…). Devuelve false si ahora no se puede.
  cmd(f, k) {
    const o = f === this.f[0] ? this.f[1] : this.f[0];
    if (this.ph !== 'fight' || f.sn > 0 || f.st === 'down' || f.st === 'ko' || f.ck) return false;
    if (f.mv) {
      const mv = f.mv, rc = rankOf(mv.k), rn = rankOf(k);
      const canCancel = mv.con && mv.t >= mv.d.s && rc <= 3 && !mv.k.startsWith('j') && rn > rc && !k.startsWith('j');
      const superCancel = mv.con && (mv.k === 'S1' || mv.k === 'S2') && (k === 'X' || k === 'R');
      if (!canCancel && !superCancel) return false;
    }
    if (k[0] === 'j' && (f.gr || f.airAtk)) return false;
    if ((k === 'S1' || k === 'S2') && !f.gr && !f.mv) return false;
    if ((k === 'X' || k === 'R') && stocks(f) < 1) return false;
    if (k === 'R' && (!f.an || f.away)) return false;
    if ((k === 'S1' || k === 'S2') && CAN[f.c.id] && !CAN[f.c.id](this, f, k)) return false;
    if ((k === 'dodge' || k === 'parry') && (!f.gr || f.mv)) return false;
    let m;
    if (k === 'dodge') m = DODGE;
    else if (k === 'parry') m = PARRY;
    else if (k === 'throw') {
      if (!f.gr || f.mv || M.abs(o.x - f.x) > 78 || !o.gr || o.sn > 0 || o.st === 'down' || o.st === 'ko' || (o.mv && o.mv.d.inv)) return false;
      m = THROW;
      o.hp -= 12; o.vx = f.fa * 7; o.vy = -9; o.gr = false; o.st = 'hit'; o.sn = 34; o.kd = 1; o.mv = null;
      f.mt = M.min(300, f.mt + 25);
      ftxt(this, o.x, o.y - 150, '¡AL SUELO!', 0xffe14d, 28);
      sfx.heavy();
      this.cameras.main.shake(140, 0.008);
    } else if (k === 'R') m = RUSH;
    else if (k[0] === 'S' || k === 'X') m = f.c[k];
    else m = f.c.N[(f.an && !f.away ? 'a' : '') + k];
    if (k === 'X') { f.mt -= 100; this.superFlash(f, f.c.xt); if (f.c.id === 'prat') this.ship = 110; }
    if (k === 'R') { f.mt -= 100; this.superFlash(f, '¡STAND: ' + f.c.an + '!', 30); }
    f.mv = { d: m, t: 0, con: 0, hit: 0, k, land: m.air ? 0 : 1 };
    f.dash = 0;
    if (k[0] === 'j') f.airAtk = 1;
    if (f.gr && !m.air) f.vx = 0;
    if (m.lp) { f.vx = m.lp[0] * f.fa; f.vy = m.lp[1]; f.gr = false; }
    if (m.t) ftxt(this, f.x, f.y - 170, m.t, 0xffe14d, 24);
    if (k[0] === 'S') { sfx.special(); f.mt = M.min(300, f.mt + 2); }
    else if (k !== 'X' && k !== 'R') sfx.whiff();
    return true;
  }

  toggleAnima(f) {
    if (this.ph !== 'fight' || f.mv || f.sn > 0 || f.ck || f.st === 'down' || f.st === 'ko') return;
    f.an = !f.an;
    if (f.an) { ftxt(this, f.x, f.y - 190, '¡' + f.c.an + '!', f.c.ac, 26); sfx.anima(); }
    else tone(600, 0.15, 'sine', 0.06, 200);
  }

  // Registra el joystick cada frame (también durante congelamientos, para no perder ↓↘→).
  trackDir(f) {
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
  readHuman(f) {
    const P = f.p ? 'P2_' : 'P1_';
    const dir = f.pcap ? f.pdir : dirOf(f);
    if (edge[P + '4']) { if (QCB(f) && this.cmd(f, 'R')) { f.pend = []; f.pcap = 0; } else this.toggleAnima(f); }
    if (edge[P + '5']) f.pend.push('L', 'M', 'H');
    if (edge[P + '6']) this.cmd(f, 'parry');
    for (const [b, k] of [['1', 'L'], ['2', 'M'], ['3', 'H']]) if (edge[P + b]) f.pend.push(k);
    if (!f.pend.length) return;
    if (f.pendT === 0) f.pendT = this.n;
    // espera 2 frames para juntar botones presionados "a la vez"
    if (this.n - f.pendT < 2) return;
    const set = new Set(f.pend), c = set.size, btn = set.has('H') ? 'H' : set.has('M') ? 'M' : 'L';
    let ok;
    if (c >= 3 && f.st === 'block' && f.sn > 0) { this.pushBlock(f); ok = true; }
    else if (c >= 3) ok = this.cmd(f, 'dodge');
    else if (c === 2 && QCF(f)) ok = this.cmd(f, 'X') || this.cmd(f, 'S1');
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

  pushBlock(f) {
    const o = f === this.f[0] ? this.f[1] : this.f[0];
    o.vx = M.sign(o.x - f.x) * 13;
    f.sn = M.min(f.sn, 5);
    ftxt(this, f.x, f.y - 160, '¡FUERA!', 0x9fd8ff, 24);
    this.spark(f.x + f.fa * 30, f.y - 90, 0x9fd8ff);
    tone(300, 0.15, 'square', 0.07, 900);
  }

  // CPU: decide cada pocos frames; usa los mismos comandos que un jugador.
  readCPU(f, o) {
    const i = f.inp;
    if (f.mv && f.mv.con && f.ch > 0 && f.mv.t >= f.mv.d.s + f.mv.d.a - 1) {
      const nx = { L: 'M', M: 'H', cL: 'cM', cM: 'cH', H: 'S1' }[f.mv.k];
      if (nx) { f.ch--; this.cmd(f, nx); }
    }
    if (--f.ait > 0) return;
    i.l = i.r = i.u = i.d = 0;
    const dx = o.x - f.x, ds = M.abs(dx), fw = dx > 0 ? 'r' : 'l', bk = dx > 0 ? 'l' : 'r', R = M.random(), id = f.c.id;
    f.ait = 5 + ((M.random() * 9) | 0);
    if (!f.an && f.ag > 70 && R < 0.12 && !f.mv) { this.toggleAnima(f); return; }
    if (f.an && f.ag < 30 && !f.mv) { this.toggleAnima(f); return; }
    const thr = this.pr.some((p) => p.o !== f && M.sign(f.x - p.x) === M.sign(p.vx) && M.abs(p.x - f.x) < 190);
    if (((o.mv && ds < 140) || thr) && R < 0.12) { this.cmd(f, 'parry'); return; }
    if ((o.mv && ds < 180) || thr) {
      if (R < 0.6) { i[bk] = 1; if (o.mv && o.mv.d.low && R < 0.45) i.d = 1; f.ait = 14; return; }
      if (thr && R < 0.75) { i.u = 1; i[fw] = 1; return; }
    }
    if (stocks(f) >= 1 && R < 0.3) {
      if (f.an && !f.away && ds < 200 && R < 0.15) { this.cmd(f, 'R'); return; }
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
    if (def.st === 'ko' || def.st === 'down' || this.ph !== 'fight') return false;
    if (def.mv && def.mv.d.inv && def.mv.t < def.mv.d.inv) return false;
    if (def.mv && def.mv.d.parry && def.mv.t < def.mv.d.a) {
      // ¡PARRY!: sin daño; si fue un golpe directo, el atacante queda aturdido y el que desvió queda libre
      def.mv = null; def.mt = M.min(300, def.mt + 12);
      if (att.mv && att.mv.d === m) { att.mv = null; att.sn = 26; att.st = 'hit'; att.vx = 0; }
      this.hs = 12;
      this.spark(px, py, 0xffffff);
      ftxt(this, def.x, def.y - 170, '¡PARRY!', 0xffffff, 32);
      tone(1760, 0.18, 'square', 0.08, 2640); tone(880, 0.25, 'triangle', 0.06);
      this.cameras.main.flash(80, 255, 255, 255);
      return true;
    }
    const dir = M.sign(def.x - srcX) || att.fa;
    const away = dir > 0 ? def.inp.r : def.inp.l;
    const crouch = !!def.inp.d;
    const canBlock = def.gr && !def.mv && !def.ck && (def.sn <= 0 || def.st === 'block') && away && !(m.low && !crouch) && !(m.ov && crouch);
    const mult = att.buff ? 1.5 : 1;
    if (canBlock) {
      def.sn = m.bs || m.hs - 4; def.st = 'block'; def.vx = dir * m.k * 0.7; def.cr = crouch;
      // con Ánima activa el daño residual lo absorbe el espíritu
      if (def.an) def.ag -= m.d * 0.9; else if (m.sp) def.hp -= m.d * 0.2 * mult;
      def.mt = M.min(300, def.mt + 4);
      att.mt = M.min(300, att.mt + 2);
      this.hs = 4; sfx.block();
      this.spark(px, py, 0x9fd8ff);
      this.checkCrash(def);
      return true;
    }
    let dmg = m.d * mult * M.max(0.5, 1 - att.combo * 0.1);
    if (def.away) { dmg *= 2; ftxt(this, def.x, def.y - 190, '¡DAÑO DOBLE!', 0xff3a3a, 22); }
    def.hp -= dmg; def.mv = null; def.sn = m.hs; def.st = 'hit'; def.vx = dir * m.k; def.dash = 0;
    if (def.an) def.ag -= dmg * 1.2;
    def.kd = m.kd || !def.gr || m.k >= 9;
    if (def.kd) { def.vy = -7; def.gr = false; }
    att.combo++;
    att.mt = M.min(300, att.mt + dmg * 0.85);
    def.mt = M.min(300, def.mt + dmg * 0.6);
    this.hs = (5 + m.d / 3) | 0;
    m.d >= 9 ? sfx.heavy() : sfx.hit();
    this.spark(px, py, 0xffffff);
    if (m.d >= 8 || M.random() < 0.3) ftxt(this, px, py - 30, Phaser.Utils.Array.GetRandom(FX_WORDS), m.d >= 9 ? 0xff4fa3 : 0xffe14d, m.d >= 9 ? 34 : 24);
    if (m.d >= 9) this.cameras.main.shake(140, 0.008);
    if (att.combo >= 2) {
      const t = this.comboT[att.p];
      t.setText(att.combo + ' HITS').sl(1).ss(1.4);
      this.tweens.add({ targets: t, scale: 1, duration: 150 });
    }
    this.checkCrash(def);
    return true;
  }

  // Si la barra del Ánima se vacía: el espíritu se quiebra y quedas expuesto.
  checkCrash(f) {
    if (!f.an || f.ag > 0) return;
    f.an = false; f.ag = 0; f.ck = 90; f.mv = null; f.st = 'hit'; f.sn = 0;
    ftxt(this, f.x, f.y - 190, '¡STAND QUEBRADO!', 0xff4fa3, 28);
    sfx.ck();
    this.cameras.main.shake(200, 0.01);
  }

  spark(x, y, col) { this.sparks.push({ x, y, t: 0, col }); }

  stepFighter(f, o) {
    const i = f.inp;
    f.anim++;
    if (f.buff) f.buff--;
    f.away = f.an && this.pr.some((p) => p.o === f && p.kind === 'kid');
    if (!f.an) f.ag = M.min(100, f.ag + 0.35);
    if (f.st === 'ko') { this.phys(f); return; }
    if (f.ck > 0) { if (--f.ck === 0) f.st = 'idle'; f.vx *= 0.8; this.phys(f); return; }
    if (f.st === 'down') { if (--f.dn <= 0) { f.st = 'idle'; o.combo = 0; } this.phys(f); return; }
    if (f.sn > 0) {
      f.sn--;
      if (f.sn === 0 && f.gr) { f.st = 'idle'; o.combo = 0; }
      this.phys(f);
      return;
    }
    if (f.st === 'hit' && !f.gr) { this.phys(f); return; }
    if (this.ph !== 'fight') { f.vx = 0; this.phys(f); return; }
    if (f.mv) { this.stepMove(f, o); this.phys(f); return; }
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
    f.st = 'idle';
    this.phys(f);
  }

  stepMove(f, o) {
    const mv = f.mv, m = mv.d;
    mv.t++;
    if (m.fire && mv.t === m.s) FIRE[m.fire](this, f, o);
    const active = mv.t >= m.s && mv.t < m.s + m.a && (m.air ? !mv.land : true);
    if (m.dodge) { f.vx = mv.t < 18 ? 7 * f.fa : 0; }
    if (active && m.dash) f.vx = m.dash * f.fa;
    if (active && m.rush) {
      f.vx = 1.5 * f.fa;
      if ((mv.t - m.s) % 10 === 0) ftxt(this, f.x + f.fa * 90, f.y - 150 - M.random() * 40, f.c.rt, f.c.ac, 30);
    }
    if (active && m.rep && (mv.t - m.s) % m.rep === 0) REP[f.c.id](this, f, o);
    if (active && m.hb) {
      if (m.multi && (mv.t - m.s) % m.multi === 0) mv.hit = 0;
      if (!mv.hit) {
        const hb = { x: f.x + f.fa * m.hb[0], y: f.y - m.hb[1], w: m.hb[2], h: m.hb[3] };
        if (o.st !== 'ko' && overlap(hb, hurtbox(o))) {
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
        if (f.st === 'hit' && f.kd && f.st !== 'ko') { f.st = 'down'; f.dn = 36; f.sn = 0; f.kd = 0; this.cameras.main.shake(80, 0.004); }
        else if (f.st === 'hit' && f.sn <= 0) f.st = 'idle';
      }
      f.y = FL; f.vy = 0;
      if (f.sn > 0 || f.st === 'ko' || f.st === 'down') f.vx *= 0.85;
      else if (!f.mv && !f.dash && !(this.ph === 'fight' && (f.inp.l || f.inp.r) && !f.cr)) f.vx = 0;
    }
    f.x = Phaser.Math.Clamp(f.x, 30, W - 30);
  }

  stepProjectiles() {
    const [a, b] = this.f;
    for (const p of this.pr) {
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.t--;
      if (p.say) p.say--;
      if (p.x < -60 || p.x > W + 60 || p.y > FL + 20) p.t = 0;
      if (p.t <= 0) continue;
      const o = p.o === a ? b : a;
      if (o.st !== 'ko' && overlap(p, hurtbox(o)) && this.hit(p.o, o, p, p.x - p.vx * 3, p.x, p.y)) {
        p.t = 0;
        if (p.kind === 'kid') ftxt(this, p.x, p.y - 80, '¡NONONO!', 0xff4fa3, 26);
      }
    }
    for (const p of this.pr) for (const q of this.pr) {
      if (p.o !== q.o && p.t > 0 && q.t > 0 && overlap(p, q)) {
        if (p.kind === 'kid' && !q.big) ftxt(this, p.x, p.y - 80, '¡PADRINO!', 0xffe66e, 18);
        if (!p.big) p.t = 0;
        if (!q.big) q.t = 0;
        this.spark((p.x + q.x) / 2, p.y, 0xffe14d);
      }
    }
    this.pr = this.pr.filter((p) => p.t > 0 || (p.img && p.img.destroy(), false));
  }

  pushApart() {
    const [a, b] = this.f;
    if ((a.mv && a.mv.d.dodge) || (b.mv && b.mv.d.dodge)) return;
    const dx = b.x - a.x;
    if (M.abs(dx) < 50 && M.abs(a.y - b.y) < 100 && a.st !== 'ko' && b.st !== 'ko') {
      const push = (50 - M.abs(dx)) / 2, s = dx >= 0 ? 1 : -1;
      a.x -= push * s; b.x += push * s;
      for (const f of this.f) f.x = Phaser.Math.Clamp(f.x, 30, W - 30);
    }
  }

  step() {
    const [a, b] = this.f;
    if (this.ph === 'end') { poll(); this.endInput(); return; }
    if (this.ship) this.ship--;
    // Durante congelamientos no se lee input: los toques quedan en buffer para después.
    const humans = this.d.mode === 2 ? [a, b] : [a];
    for (const f of humans) this.trackDir(f);
    if (this.fz > 0) { this.fz--; return; }
    if (this.hs > 0) { this.hs--; return; }
    poll();
    this.n++;
    if (this.n % 9 === 0) music(this.n / 9);
    this.readHuman(a);
    if (this.d.mode === 1) this.readCPU(b, a); else this.readHuman(b);
    if (this.ph === 'intro' && --this.pt <= 0) this.ph = 'fight';
    this.stepFighter(a, b);
    this.stepFighter(b, a);
    this.pushApart();
    this.stepProjectiles();
    this.sparks = this.sparks.filter((s) => ++s.t < 14);
    if (this.ph === 'fight') {
      this.stepBanana();
      if (a.hp <= 0 || b.hp <= 0) this.roundOver();
    } else if (this.ph === 'ko' && --this.pt <= 0) this.afterKO();
  }

  // Plátano: cae cada 20 s cerca del centro (algo corrido hacia quien tiene menos vida),
  // dura 8 s en el suelo y al tomarlo da +50 de súper, llena la barra del Stand y saca del Stand quebrado.
  stepBanana() {
    const [a, b] = this.f;
    let n = this.ban;
    if (!n) {
      if (--this.banT > 0) return;
      let x = W / 2 + M.random() * 160 - 80;
      const ra = a.hp / a.c.hp, rb = b.hp / b.c.hp;
      if (M.abs(ra - rb) > 0.1) x += ((ra < rb ? a : b).x - x) * 0.35; // ayuda al que va perdiendo
      n = this.ban = { x: Phaser.Math.Clamp(x, 60, W - 60), y: -30, vy: 0, t: 480 };
      tone(1400, 0.4, 'triangle', 0.06, 500);
      return;
    }
    if (n.y < FL) { n.vy = M.min(3, n.vy + 0.08); n.y = M.min(FL, n.y + n.vy); // cae suave: ~3 s hasta el suelo
      if (n.y === FL) tone(300, 0.08, 'square', 0.05); }
    else if (--n.t <= 0) { this.ban = null; this.banT = 1200; return; }
    for (const f of this.f) {
      if (f.st === 'down' || (f.st === 'hit' && f.sn > 0) || M.abs(f.x - n.x) > 40 || n.y < f.y - 130) continue;
      f.mt = M.min(300, f.mt + 50); f.ag = 100;
      if (f.ck) { f.ck = 0; f.st = 'idle'; }
      ftxt(this, n.x, n.y - 140, '¡PLÁTANO POWER!', 0xffe14d, 26);
      tone(880, 0.12, 'square', 0.07); tone(1320, 0.25, 'square', 0.06, 1760);
      this.cameras.main.flash(120, 255, 225, 80);
      this.ban = null; this.banT = 1200;
      return;
    }
  }

  roundOver() {
    const [a, b] = this.f;
    this.ph = 'ko';
    this.pt = 170;
    const ra = a.hp / a.c.hp, rb = b.hp / b.c.hp;
    this.rw = ra === rb ? -1 : ra > rb ? 0 : 1;
    if (this.rw >= 0) this.wins[this.rw]++;
    for (const f of this.f) {
      if (f.hp <= 0) { f.hp = 0; f.st = 'ko'; f.mv = null; f.an = false; f.vy = -9; f.gr = false; f.vx = (f === a ? -1 : 1) * 5; }
    }
    this.announce('K.O.', 96, 1400);
    sfx.ko();
    this.cameras.main.shake(300, 0.012);
  }

  afterKO() {
    if (this.wins[0] >= 2 || this.wins[1] >= 2) this.matchOver();
    else this.newRound();
  }

  matchOver() {
    this.ph = 'end';
    const w = this.wins[0] >= 2 ? 0 : 1, wf = this.f[w], d = this.d;
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).sd(28);
    const col = w ? '#ff6ec7' : '#e1ff00';
    txt(this, W / 2, 190, (d.mode === 1 && w ? 'CPU: ' : '') + wf.c.n + ' GANA', 44, col, '#000').sd(29).sa(-4);
    txt(this, W / 2, 270, '"' + wf.c.win + '"', 22, '#ffffff').sd(29).setWordWrapWidth(680);
    let msg;
    if (d.mode === 2) { msg = 'START: REVANCHA · 2: ELEGIR PERSONAJES'; this.next = 'rematch'; }
    else if (w === 0 && d.li + 1 < d.ladder.length) { msg = 'START: SIGUIENTE RIVAL → ' + CH[d.ladder[d.li + 1]].n; this.next = 'ladder'; }
    else if (w === 0) {
      txt(this, W / 2, 360, '¡CAMPEÓN DE CHILE!', 50, '#ffe14d', '#7a0f3a').sd(29).sa(-6);
      msg = 'START: VOLVER AL TÍTULO';
      this.next = 'title';
    } else { msg = 'START: CONTINUAR · 2: TÍTULO'; this.next = 'rematch'; }
    txt(this, W / 2, 470, msg, 18, '#ffe14d').sd(29);
    this.endWait = 40;
  }

  endInput() {
    if (this.endWait > 0) { this.endWait--; return; }
    const d = this.d;
    if (any('START1', 'START2', 'P1_1')) {
      sfx.ok();
      if (this.next === 'rematch') this.scene.restart(d);
      else if (this.next === 'ladder') this.scene.restart(Object.assign({}, d, { li: d.li + 1, b: d.ladder[d.li + 1] }));
      else this.scene.start('T');
    } else if (any('P1_2', 'P2_2')) {
      sfx.sel();
      this.scene.start(d.mode === 2 ? 'S' : 'T', { mode: d.mode });
    }
  }

  update(_, dt) {
    this.acc += M.min(dt, 100);
    while (this.acc >= 1000 / 60) { this.acc -= 1000 / 60; this.step(); }
    this.draw();
  }

  draw() {
    const g = this.g, bg = this.bgFx, [a, b] = this.f;
    bg.clear();
    if (this.ship) {
      // La Esmeralda cruza el fondo durante el súper de Prat
      const sx = W + 160 - (110 - this.ship) * 10, sy = 395;
      bg.fs(0x0e1630); bg.fr(0, 380, W, 22);
      bg.fs(0x3b2a1a); bg.ft(sx - 140, sy - 30, sx + 140, sy - 30, sx + 110, sy);
      bg.fr(sx - 120, sy - 30, 230, 30);
      bg.fs(0x24170e); bg.fr(sx - 60, sy - 140, 6, 110); bg.fr(sx + 40, sy - 150, 6, 120);
      bg.fs(0xf2efe3); bg.fr(sx - 95, sy - 130, 70, 60); bg.fr(sx + 5, sy - 140, 75, 70);
      bg.fs(0xd52b1e); bg.fr(sx + 46, sy - 152, 26, 8);
      bg.fs(0x1c3a8a); bg.fr(sx + 46, sy - 160, 10, 8);
      bg.fs(0xffffff); bg.fr(sx + 56, sy - 160, 16, 8);
    }
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
    this.f.forEach((f, i) => {
      const o = this.f[1 - i];
      const x = i ? W - 20 - bw : 20, pct = M.max(0, f.hp / f.c.hp);
      h.fs(0x000000, 0.7); h.fr(x - 3, 17, bw + 6, 26);
      h.fs(0x7a0f1a); h.fr(x, 20, bw, 20);
      h.fs(pct > 0.3 ? 0xffd23a : 0xff3a3a);
      h.fr(i ? x + bw * (1 - pct) : x, 20, bw * pct, 20);
      const ap = f.ag / 100, aw = 160;
      const ax = i ? W - 20 - aw : 20;
      h.fs(0x000000, 0.7); h.fr(ax - 2, 44, aw + 4, 8);
      h.fs(f.ck ? 0xff4fa3 : f.an ? f.c.ac : 0x3f6a8a);
      h.fr(i ? ax + aw * (1 - ap) : ax, 45, aw * ap, 6);
      this.anT[i].setText(f.ck ? 'STAND QUEBRADO' : f.an ? 'STAND: ' + f.c.an + (f.away ? ' (LEJOS: DAÑO x2)' : '') : 'STAND (4)').setColor(f.an ? hex(f.c.ac) : '#8899aa');
      for (let k = 0; k < 2; k++) {
        h.fs(k < this.wins[i] ? 0xffe14d : 0x333333);
        h.fc(i ? W - 330 + k * 22 : 330 - k * 22, 62, 7);
      }
      const mx = i ? W - 20 - 210 : 20, lv = stocks(f), part = (f.mt % 100) / 100;
      h.fs(0x000000, 0.7); h.fr(mx - 2, 550, 214, 12);
      h.fs(lv ? (this.n % 20 < 10 ? 0xff4fa3 : 0xffe14d) : 0x3fa9ff);
      h.fr(i ? mx + 210 * (1 - (lv >= 3 ? 1 : part)) : mx, 552, 210 * (lv >= 3 ? 1 : part), 8);
      this.superT[i].setText('SÚPER  NIVEL ' + lv + (lv ? '  ¡LISTO!' : ''));
      if (f.combo < 2 || o.sn <= 0) this.comboT[i].sl(M.max(0, this.comboT[i].alpha - 0.03));
    });
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: W,
  height: H,
  parent: 'game-root',
  backgroundColor: '#170b26',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
  scene: [Title, Select, Fight],
});

})();
