/* ===================== Kehys-moottori (iPad) ===================== */
const K = (() => {
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const hex = (h) => {
    h = String(h || "#000").replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
  };
  function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  // Pehmeä satunnaiskenttä [-1,1], piirteiden koko ~cell px (cellX: eri vaakakoko → venytetyt juovat)
  class Noise {
    constructor(H, W, cell, R, cellX) {
      this.cy = Math.max(2, cell);
      this.cx = Math.max(2, cellX == null ? cell : cellX);
      this.gh = Math.ceil(H / this.cy) + 4;
      this.gw = Math.ceil(W / this.cx) + 4;
      const g = (this.g = new Float32Array(this.gh * this.gw));
      for (let i = 0; i < g.length; i++) g[i] = R() * 2 - 1;
    }
    at(x, y) {
      const fx = x / this.cx + 1, fy = y / this.cy + 1;
      const ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy;
      const wx0 = ((-tx + 2) * tx - 1) * tx * 0.5, wx1 = ((3 * tx - 5) * tx * tx + 2) * 0.5,
        wx2 = ((-3 * tx + 4) * tx + 1) * tx * 0.5, wx3 = (tx - 1) * tx * tx * 0.5;
      const wy0 = ((-ty + 2) * ty - 1) * ty * 0.5, wy1 = ((3 * ty - 5) * ty * ty + 2) * 0.5,
        wy2 = ((-3 * ty + 4) * ty + 1) * ty * 0.5, wy3 = (ty - 1) * ty * ty * 0.5;
      const g = this.g, gw = this.gw;
      let r = (iy - 1) * gw + ix - 1, s = 0;
      s += wy0 * (wx0 * g[r] + wx1 * g[r + 1] + wx2 * g[r + 2] + wx3 * g[r + 3]); r += gw;
      s += wy1 * (wx0 * g[r] + wx1 * g[r + 1] + wx2 * g[r + 2] + wx3 * g[r + 3]); r += gw;
      s += wy2 * (wx0 * g[r] + wx1 * g[r + 1] + wx2 * g[r + 2] + wx3 * g[r + 3]); r += gw;
      s += wy3 * (wx0 * g[r] + wx1 * g[r + 1] + wx2 * g[r + 2] + wx3 * g[r + 3]);
      return s;
    }
  }
  // reunan suuntaiset juovat: [vaakajuovat, pystyjuovat]
  const SN = (H, W, R, along, across) => [new Noise(H, W, across, R, along), new Noise(H, W, along, R, across)];
  const sn = (p, x, y, sw) => p[0].at(x, y) * (1 - sw) + p[1].at(x, y) * sw;
  // etäisyys pyöristettyyn suorakaiteeseen (< 0 sisällä)
  const sdf = (qx, qy, r) => {
    const ox = qx > 0 ? qx : 0, oy = qy > 0 ? qy : 0;
    const m = qx > qy ? qx : qy;
    return Math.sqrt(ox * ox + oy * oy) + (m < 0 ? m : 0) - r;
  };
  function mk(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }
  function ctx2d(c) { return c.getContext("2d", { willReadFrequently: true }); }

  // ---------- mitat (käytetään myös koon laskemiseen ilman piirtoa) ----------
  function filmDims(w, h, f) {
    const s = Math.min(w, h);
    if (f.tyyli === "polaroid") {
      const side = Math.max(2, f.paperi / 100 * s), top = side * 1.2;
      const bottom = Math.max(side, (+f.alareuna || 27) / 100 * s);
      return [Math.round(w + 2 * side), Math.round(h + top + bottom)];
    }
    const band = Math.max(2, f.leveys / 100 * s), inset = band * f.yli / 100;
    const E = Math.round(band - inset + f.paperi / 100 * s + band * 0.6);
    if (f.tyyli === "revitty") {
      const E2 = Math.round((f.taustaleveys == null ? 5 : +f.taustaleveys) / 100 * s);
      return [w + 2 * (E + E2), h + 2 * (E + E2)];
    }
    return [w + 2 * E, h + 2 * E];
  }
  function padDims(w, h, t) {
    if (!t.suhde || t.suhde === "ei") return [w, h];
    const [a, b] = t.suhde.split(":").map(Number), target = a / b;
    if (Math.abs(w / h - target) < 1e-3) return [w, h];
    return w / h > target ? [w, Math.round(w / target)] : [Math.round(h * target), h];
  }
  function borderDims(w, h, r) {
    const v = +r.arvo || 0;
    if (r.tapa === "ei" || v <= 0) return [w, h];
    let dx, dy;
    if (r.tapa === "ps_pros") { dx = w * v / 100; dy = h * v / 100; }
    else if (r.tapa === "pros_pidempi") { dx = dy = Math.max(w, h) * v / 100; }
    else { dx = dy = 2 * v; }
    return [Math.round(w + dx), Math.round(h + dy)];
  }
  function finalTarget(t) {
    const k = t.loppu || "ei";
    if (k === "ig") return ["leveys", 1080];
    if (k === "fb") return ["pidempi", 2048];
    if (k === "leveys" || k === "pidempi") return [k, +t.loppuleveys || 0];
    return [null, 0];
  }
  function finalDims(w, h, t) {
    const [tapa, px] = finalTarget(t);
    if (!tapa || px <= 0) return [w, h];
    const k = tapa === "leveys" ? px / w : px / Math.max(w, h);
    return k >= 1 ? [w, h] : [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
  }
  function workDims(w, h, k) {
    const px = +k.px || 0;
    if (k.tapa === "ei" || px <= 0) return [w, h];
    if (k.tapa === "leveys") return [px, Math.round(h * px / w)];
    if (k.tapa === "korkeus") return [Math.round(w * px / h), px];
    const q = px / Math.max(w, h);
    return [Math.round(w * q), Math.round(h * q)];
  }
  // Koko valmiille kuvalle ilman piirtoa (pxScale: viivan ja px-reunuksen mittakaava)
  function simulate(w, h, p, pxScale = 1) {
    [w, h] = workDims(w, h, p.koko);
    if (p.filmi.kaytossa) [w, h] = filmDims(w, h, p.filmi);
    if (p.reunukset.kaytossa) {
      const vp = Math.round((+p.viiva.px || 0) * pxScale);
      if (vp > 0) { w += 2 * vp; h += 2 * vp; }
      [w, h] = padDims(w, h, p.taytto);
      const r = p.reunus.tapa === "px" ? { ...p.reunus, arvo: (+p.reunus.arvo || 0) * pxScale } : p.reunus;
      [w, h] = borderDims(w, h, r);
    }
    return [w, h];
  }

  // ---------- skaalaus (Safari: pienennys puolittamalla laadun vuoksi) ----------
  function scaleTo(src, w, h) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    let cur = src, cw = src.naturalWidth || src.width, ch = src.naturalHeight || src.height;
    if (cw === w && ch === h && src instanceof HTMLCanvasElement) return src;
    while (cw / 2 >= w && ch / 2 >= h && cw * ch <= 16e6) {
      const n = mk(cw / 2, ch / 2), c = n.getContext("2d");
      c.imageSmoothingQuality = "high";
      c.drawImage(cur, 0, 0, n.width, n.height);
      cur = n; cw = n.width; ch = n.height;
    }
    const out = mk(w, h), c = out.getContext("2d");
    c.imageSmoothingQuality = "high";
    c.drawImage(cur, 0, 0, w, h);
    return out;
  }

  // ---------- Artkehys: sivellin ----------
  function frameSivellin(img, f, seed) {
    const w = img.width, h = img.height, s = Math.min(w, h);
    const band = Math.max(2, f.leveys / 100 * s), inset = band * f.yli / 100, outW = band - inset;
    const [W, H] = filmDims(w, h, f), E = (W - w) / 2;
    const c = mk(W, H), x2 = ctx2d(c);
    x2.fillStyle = f.paperivari; x2.fillRect(0, 0, W, H); x2.drawImage(img, E, E);
    const id = x2.getImageData(0, 0, W, H), px = id.data;
    const R = mulberry(seed), rough = f.rosoisuus / 100, wave = f.aaltoilu / 100, r = f.kulmat / 100 * s;
    const N = (cell, cx) => new Noise(H, W, cell, R, cx);
    const o1 = SN(H, W, R, band * 1.6, band * 0.1), o2 = SN(H, W, R, band * 0.6, band * 0.05), o3 = N(band * 0.15), ow = N(s * 0.08);
    const i1 = SN(H, W, R, band * 1.2, band * 0.12), i3 = N(band * 0.15), iw = N(s * 0.08);
    const spl = f.roiskeet / 100, sp = SN(H, W, R, band * 0.9, band * 0.12);
    const du = f.polyt / 100, dn = N(Math.max(2, band * 0.05));
    const col = hex(f.kehysvari), pv = hex(f.paperivari);
    const lo = -inset - band * 1.3, hi = outW + band * 2.1;
    const cxm = E + w / 2, cym = E + h / 2, hw = w / 2 - r, hh = h / 2 - r;
    for (let y = 0; y < H; y++) {
      const qy = Math.abs(y - cym) - hh;
      for (let x = 0; x < W; x++) {
        const qx = Math.abs(x - cxm) - hw, d = sdf(qx, qy, r);
        if (d < lo || d > hi) continue;
        const sw = clamp((qx - qy) / band * 0.5 + 0.5);
        const nOut = rough * band * 0.6 * (0.55 * sn(o1, x, y, sw) + 0.3 * sn(o2, x, y, sw) + 0.15 * o3.at(x, y)) + wave * band * 0.9 * ow.at(x, y);
        const nIn = rough * band * 0.3 * (0.7 * sn(i1, x, y, sw) + 0.3 * i3.at(x, y)) + wave * band * 0.5 * iw.at(x, y);
        const inner = -inset + nIn, outer = outW + nOut;
        let a = clamp(d - inner + 0.5) * clamp(outer - d + 0.5);
        if (spl > 0) {
          const nO = d > outer ? clamp(1 - (d - outer) / (band * 0.5)) : 0;
          const nI = d < inner ? clamp(1 - (inner - d) / (band * 0.35)) : 0;
          if (nO > 0 || nI > 0) a = Math.max(a, clamp((sn(sp, x, y, sw) - (0.97 - 0.25 * spl)) * 8) * Math.max(nO, nI));
        }
        if (a <= 0) continue;
        const dust = du > 0 && a > 0.9 ? clamp((dn.at(x, y) - (0.97 - 0.12 * du)) * 12) * 0.8 : 0;
        const i = (y * W + x) * 4;
        for (let k = 0; k < 3; k++) {
          let v = px[i + k] * (1 - a) + col[k] * a;
          px[i + k] = v * (1 - dust) + pv[k] * dust;
        }
      }
    }
    x2.putImageData(id, 0, 0);
    return c;
  }

  // ---------- Artkehys: revitty vedos ----------
  function frameRevitty(img, f, seed) {
    const w = img.width, h = img.height, s = Math.min(w, h);
    const band = Math.max(2, f.leveys / 100 * s), inset = band * f.yli / 100, outW = band - inset;
    const paper = f.paperi / 100 * s;
    const [W, H] = filmDims(w, h, f), o = (W - w) / 2;
    const c = mk(W, H), x2 = ctx2d(c);
    x2.fillStyle = f.tausta || "#1c1c1c"; x2.fillRect(0, 0, W, H); x2.drawImage(img, o, o);
    const id = x2.getImageData(0, 0, W, H), px = id.data;
    const R = mulberry(seed), rough = f.rosoisuus / 100, wave = f.aaltoilu / 100, r = f.kulmat / 100 * s;
    const N = (cell, cx) => new Noise(H, W, cell, R, cx);
    const t1 = N(s * 0.012), t2 = N(s * 0.004), t3 = N(s * 0.08), ptex = N(s * 0.03);
    const fo = SN(H, W, R, band * 1.2, band * 0.1), fow = N(s * 0.08), fi = SN(H, W, R, band * 1.0, band * 0.12), fiw = N(s * 0.08);
    const du = f.polyt / 100, dn = N(Math.max(2, band * 0.05));
    const bg = hex(f.tausta || "#1c1c1c"), pv = hex(f.paperivari), col = hex(f.kehysvari);
    const edge = outW + paper, maxTear = rough * s * 0.01 + wave * s * 0.012;
    const f6 = Math.max(1, s * 0.006), shx = s * 0.004, shy = s * 0.006, Rb = Math.max(1, s * 0.012);
    const far = edge + maxTear + shx + shy + 3 * Rb;
    const lo = -inset - band * 1.3, fhi = outW + band * 2.1;
    const cxm = o + w / 2, cym = o + h / 2, hw = w / 2 - r, hh = h / 2 - r;
    for (let y = 0; y < H; y++) {
      const qy = Math.abs(y - cym) - hh, qys = Math.abs(y - shy - cym) - hh;
      const inY = y >= o && y < o + h;
      for (let x = 0; x < W; x++) {
        const qx = Math.abs(x - cxm) - hw, d = sdf(qx, qy, r);
        if (d < lo || d > far) continue;
        const i = (y * W + x) * 4;
        let R0, G0, B0;
        if (inY && x >= o && x < o + w) { R0 = px[i]; G0 = px[i + 1]; B0 = px[i + 2]; }
        else {
          const tear = d > edge - maxTear - 2
            ? rough * s * 0.01 * (0.6 * t1.at(x, y) + 0.4 * t2.at(x, y)) + wave * s * 0.012 * t3.at(x, y) : 0;
          const pa = clamp(edge + tear - d + 0.5);
          const fibre = clamp((edge + tear - d + f6) / f6);
          const ds = sdf(Math.abs(x - shx - cxm) - hw, qys, r);
          const shadow = clamp((edge + tear - ds) / (2 * Rb) + 0.5);
          const k0 = 1 - 0.55 * shadow;
          R0 = bg[0] * k0; G0 = bg[1] * k0; B0 = bg[2] * k0;
          const pa3 = Math.max(pa, fibre * 0.35);
          if (pa3 > 0) {
            const t = 4 * (0.5 + 0.5 * ptex.at(x, y));
            R0 = R0 * (1 - pa3) + (pv[0] - t) * pa3; G0 = G0 * (1 - pa3) + (pv[1] - t) * pa3; B0 = B0 * (1 - pa3) + (pv[2] - t) * pa3;
          }
        }
        if (d <= fhi) {
          const sw = clamp((qx - qy) / band * 0.5 + 0.5);
          const nOut = rough * band * 0.4 * sn(fo, x, y, sw) + wave * band * 0.4 * fow.at(x, y);
          const nIn = rough * band * 0.2 * sn(fi, x, y, sw) + wave * band * 0.3 * fiw.at(x, y);
          const a = clamp(d - (-inset + nIn) + 0.5) * clamp(outW + nOut - d + 0.5);
          if (a > 0) {
            R0 = R0 * (1 - a) + col[0] * a; G0 = G0 * (1 - a) + col[1] * a; B0 = B0 * (1 - a) + col[2] * a;
            if (du > 0 && a > 0.9) {
              const dd = clamp((dn.at(x, y) - (0.97 - 0.12 * du)) * 12) * 0.8;
              R0 = R0 * (1 - dd) + pv[0] * dd; G0 = G0 * (1 - dd) + pv[1] * dd; B0 = B0 * (1 - dd) + pv[2] * dd;
            }
          }
        }
        px[i] = R0; px[i + 1] = G0; px[i + 2] = B0;
      }
    }
    x2.putImageData(id, 0, 0);
    return c;
  }

  // ---------- Artkehys: Polaroid ----------
  function framePolaroid(img, f, seed) {
    const w = img.width, h = img.height, s = Math.min(w, h);
    const side = Math.max(2, f.paperi / 100 * s), top = side * 1.2;
    const [W, H] = filmDims(w, h, f);
    const x0 = Math.round(side), y0 = Math.round(top);
    const c = mk(W, H), x2 = ctx2d(c);
    x2.fillStyle = f.paperivari; x2.fillRect(0, 0, W, H); x2.drawImage(img, x0, y0);
    const id = x2.getImageData(0, 0, W, H), px = id.data;
    const R = mulberry(seed), rough = f.rosoisuus / 100, r = f.kulmat / 100 * s;
    const n1 = new Noise(H, W, s * 0.03, R), n2 = new Noise(H, W, Math.max(2, s * 0.003), R);
    const n3 = new Noise(H, W, s * 0.06, R), n4 = new Noise(H, W, s * 0.018, R);
    const du = f.polyt / 100, fn = new Noise(H, W, Math.max(2, s * 0.0025), R);
    const pc = hex(f.paperivari);
    const wob = rough * s * 0.003, lip = wob + 0.5, shR = Math.max(1, s * 0.006);
    const lo = -(lip + wob + shR + 1);
    const cxm = x0 + w / 2, cym = y0 + h / 2, hw = w / 2 - r, hh = h / 2 - r;
    for (let y = 0; y < H; y++) {
      const qy = Math.abs(y - cym) - hh, inY = y >= y0 && y < y0 + h;
      for (let x = 0; x < W; x++) {
        const d = sdf(Math.abs(x - cxm) - hw, qy, r);
        if (d < lo) continue;
        const i = (y * W + x) * 4;
        const n = Math.abs(d) < lip + wob + 2 ? wob * (0.65 * n3.at(x, y) + 0.35 * n4.at(x, y)) : 0;
        const a = clamp(-(d + lip - n) + 0.5);
        const tex = 1.6 * n1.at(x, y) + 0.8 * n2.at(x, y);
        let spec = 0;
        if (du > 0 && a < 1) spec = clamp((fn.at(x, y) - (0.997 - 0.02 * du)) * 40) * (1 - a) * 35;
        const sh = clamp(1 + (d + lip) / shR), k = 1 - 0.22 * sh * sh;
        const inside = inY && x >= x0 && x < x0 + w;
        for (let ch = 0; ch < 3; ch++) {
          const im = inside ? px[i + ch] * k : 0;
          px[i + ch] = (pc[ch] + tex) * (1 - a) + im * a - spec;
        }
      }
    }
    x2.putImageData(id, 0, 0);
    return c;
  }

  const STYLES = [["sivellin", "Sivellin (Sloppy)"], ["revitty", "Revitty vedos"], ["polaroid", "Polaroid (leveä alareuna)"]];
  const OTHER = { viilattu: "Viilattu negatiivikehys", pikafilmi: "Pikafilmi / emulsio", filminauha: "35 mm filminauha", kk66: "6×6-negatiivi" };
  function frame(img, f, seed) {
    if (f.tyyli === "revitty") return frameRevitty(img, f, seed);
    if (f.tyyli === "polaroid") return framePolaroid(img, f, seed);
    return frameSivellin(img, f, seed);
  }

  function grow(src, w, h, color, ox, oy) {
    const c = mk(w, h), x = c.getContext("2d");
    x.fillStyle = color; x.fillRect(0, 0, w, h); x.drawImage(src, ox, oy);
    return c;
  }

  /**
   * Koko käsittely. src: kuva tai kangas. opts.maxPx: kankaan enimmäispinta-ala (iPad-raja),
   * opts.preview: pisin sivu esikatselulle (absoluuttiset px-arvot skaalataan samassa suhteessa).
   * Palauttaa {canvas, note, finalSize}.
   */
  function process(src, p, name, opts = {}) {
    const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
    let [w, h] = workDims(sw, sh, p.koko);
    let note = "";
    // iPadin kangasraja: valmis kuva enintään maxPx pikseliä
    const maxPx = opts.maxPx || 15.5e6;
    const [fw, fh] = simulate(sw, sh, p);
    let k = 1;
    if (fw * fh > maxPx) { k = Math.sqrt(maxPx / (fw * fh)) * 0.995; note = "pienennetty iPadin kuvakokorajan vuoksi"; }
    const finalSize = finalDims(Math.round(fw * k), Math.round(fh * k), p.tulostus);
    let pxScale = k;
    if (opts.preview) {
      const kp = Math.min(1, opts.preview / Math.max(w * k, h * k));
      k *= kp; pxScale = k;
    }
    let im = scaleTo(src, w * k, h * k);
    if (p.filmi.kaytossa) im = frame(im, p.filmi, hashSeed(`${name}|${p.filmi.siemen}`));
    if (p.reunukset.kaytossa) {
      const vp = Math.round((+p.viiva.px || 0) * pxScale) || ((+p.viiva.px || 0) > 0 ? 1 : 0);
      if (vp > 0) im = grow(im, im.width + 2 * vp, im.height + 2 * vp, p.viiva.vari, vp, vp);
      let [nw, nh] = padDims(im.width, im.height, p.taytto);
      if (nw !== im.width || nh !== im.height) im = grow(im, nw, nh, p.taytto.vari, (nw - im.width) >> 1, (nh - im.height) >> 1);
      const rb = p.reunus.tapa === "px" ? { ...p.reunus, arvo: (+p.reunus.arvo || 0) * pxScale } : p.reunus;
      [nw, nh] = borderDims(im.width, im.height, rb);
      if (nw !== im.width || nh !== im.height) im = grow(im, nw, nh, p.reunus.vari, (nw - im.width) >> 1, (nh - im.height) >> 1);
    }
    if (!opts.preview) {
      const [tw, th] = finalDims(im.width, im.height, p.tulostus);
      if (tw !== im.width || th !== im.height) im = scaleTo(im, tw, th);
    }
    return { canvas: im, note, finalSize };
  }

  return { process, simulate, STYLES, OTHER, hashSeed, mk };
})();
