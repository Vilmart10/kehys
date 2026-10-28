/* ===================== Kehys iPad – käyttöliittymä ===================== */
(() => {
  const $ = (id) => document.getElementById(id);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ei tallennusta */ } },
  };

  // ---------------- esiasetukset (sama rakenne kuin Macin Kehyksessä) ----------------
  const FILM = { kaytossa: true, tyyli: "sivellin", leveys: 1.8, yli: 55, paperi: 2.2, alareuna: 27, rosoisuus: 55,
    aaltoilu: 35, kulmat: 0.6, roiskeet: 40, polyt: 25, lovet: true, kehysvari: "#0b0b0b", paperivari: "#ffffff",
    tausta: "#1c1c1c", taustaleveys: 5, siemen: 1 };
  const OUT = { laatu: 94, terav: 0, tapa: "liite", liite: "_kehys", kansio: "", loppu: "ei", loppuleveys: 0 };
  function preset(name, o = {}) {
    return {
      name,
      koko: o.koko || { tapa: "ei", px: 2048 },
      filmi: { ...FILM, ...(o.filmi === undefined ? { kaytossa: false } : o.filmi) },
      reunukset: { kaytossa: !!o.reunukset },
      viiva: o.viiva || { px: 0, vari: "#000000" },
      taytto: o.taytto || { suhde: "ei", vari: "#ffffff" },
      reunus: o.reunus || { tapa: "ei", arvo: 0, vari: "#ffffff" },
      tulostus: { ...OUT, ...(o.tulostus || {}) },
      sign: o.sign || { kaytossa: false },
    };
  }
  const BUILTIN = [
    preset("IG Neliö 1:1, musta viiva, vaal.harmaa reunus", { koko: { tapa: "leveys", px: 1080 }, reunukset: true,
      viiva: { px: 1, vari: "#000000" }, taytto: { suhde: "ei", vari: "#f8f8f8" },
      reunus: { tapa: "ps_pros", arvo: 8, vari: "#f8f8f8" }, tulostus: { laatu: 92, liite: "_IG" } }),
    preset("Artkehys", { filmi: {} }),
    preset("Artkehys IG 4:5", { koko: { tapa: "pidempi", px: 2400 }, filmi: {}, reunukset: true,
      taytto: { suhde: "4:5", vari: "#ffffff" }, tulostus: { laatu: 92, liite: "_IG", loppu: "ig", loppuleveys: 1080 } }),
    preset("Artkehys – revitty vedos", { filmi: { tyyli: "revitty", leveys: 0.9, yli: 50, paperi: 6, rosoisuus: 55,
      aaltoilu: 30, kulmat: 0.4, roiskeet: 10, polyt: 10 } }),
    preset("Artkehys – Polaroid", { filmi: { tyyli: "polaroid", paperi: 5.7, alareuna: 27, rosoisuus: 40, kulmat: 0.4,
      polyt: 15, paperivari: "#f6f5f1" } }),
  ].map((p) => ({ ...p, _builtin: true }));
  // Ensimmäisellä käynnistyksellä omaksi esiasetukseksi (Macin näyttökuvan arvoilla – tarkista värit).
  const STARTER = [preset("Artkehys – revitty vedos – FG MV", { filmi: { tyyli: "revitty", leveys: 0.9, yli: 55,
    paperi: 2.9, rosoisuus: 55, aaltoilu: 63, kulmat: 0.4, roiskeet: 0, polyt: 14, kehysvari: "#000000",
    paperivari: "#ffffff", tausta: "#ff0000", taustaleveys: 5, siemen: 71252 } })];
  const RENAMED = { "Filmikehys": "Artkehys", "Filmikehys IG 4:5": "Artkehys IG 4:5",
    "Filmikehys – revitty vedos": "Artkehys – revitty vedos" };

  function fill(p) {
    const base = preset(p.name || "?", { filmi: { kaytossa: false } });
    base.reunukset.kaytossa = true;           // vanhoissa Macin esiasetuksissa reunukset olivat aina päällä
    const out = clone(base);
    for (const [k, v] of Object.entries(p)) {
      if (v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object") Object.assign(out[k], v);
      else out[k] = v;
    }
    const t = out.tulostus;
    if (t && t.loppu == null) t.loppu = (+t.loppuleveys || 0) <= 0 ? "ei" : (+t.loppuleveys === 1080 ? "ig" : "leveys");
    return out;
  }
  const strip = (p) => { const o = {}; for (const k in p) if (!k.startsWith("_")) o[k] = p[k]; return o; };
  const same = (a, b) => JSON.stringify(strip(a)) === JSON.stringify(strip(b));

  let users = [];                 // omat esiasetukset
  let presets = [...BUILTIN];
  let work = {};                  // nimi -> tallentamaton työkopio
  let cur = 0;

  // ---------------- tallennuspaikka: tämän laitteen selain ----------------
  async function loadUsers() {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ei tukea */ }
    return LS.get("kehys.presets", null);
  }
  async function saveUsers() {
    LS.set("kehys.presets", users.map(strip));
  }

  // ---------------- lomake ----------------
  const ALL = "*";
  const BRUSH = ["sivellin", "revitty"];
  const SECTIONS = [
    { id: "1", title: "1. Työkoko", fields: [
      { k: "koko.tapa", t: "sel", l: "Skaalaus", o: [["ei", "Ei skaalausta"], ["leveys", "Leveys"], ["korkeus", "Korkeus"], ["pidempi", "Pidempi sivu"]] },
      { k: "koko.px", t: "rng", l: "Pikseleinä", min: 16, max: 8000, step: 10, u: "px", show: (p) => p.koko.tapa !== "ei" },
      { t: "hint", l: "Kuva skaalataan tähän kokoon ennen kehystä. Lopullinen tiedostokoko valitaan kohdassa 4." },
    ] },
    { id: "2", title: "2. Artkehys", tog: "filmi.kaytossa", fields: [
      { k: "filmi.tyyli", t: "sel", l: "Tyyli", o: K.STYLES },
      { k: "filmi.leveys", t: "rng", l: "Kehyksen leveys", min: 0.2, max: 10, step: 0.1, u: "%", st: BRUSH },
      { k: "filmi.yli", t: "rng", l: "Kuvan päällä", min: 0, max: 100, step: 5, u: "%", st: BRUSH },
      { k: "filmi.paperi", t: "rng", l: "Paperireunus", l2: { polaroid: "Sivureunus" }, min: 0, max: 15, step: 0.1, u: "%", st: ALL },
      { k: "filmi.alareuna", t: "rng", l: "Alareuna", min: 5, max: 60, step: 0.5, u: "%", st: ["polaroid"] },
      { k: "filmi.rosoisuus", t: "rng", l: "Rosoisuus", l2: { polaroid: "Kuva-alan reuna" }, min: 0, max: 100, step: 5, st: ALL },
      { k: "filmi.aaltoilu", t: "rng", l: "Aaltoilu", min: 0, max: 100, step: 5, st: BRUSH },
      { k: "filmi.kulmat", t: "rng", l: "Kulmien pyöristys", min: 0, max: 5, step: 0.1, u: "%", st: ALL },
      { k: "filmi.roiskeet", t: "rng", l: "Roiskeet", min: 0, max: 100, step: 5, st: ["sivellin"] },
      { k: "filmi.polyt", t: "rng", l: "Pöly", min: 0, max: 100, step: 5, st: ALL },
      { k: "filmi.kehysvari", t: "col", l: "Kehyksen väri", st: BRUSH },
      { k: "filmi.paperivari", t: "col", l: "Paperin väri", st: ALL },
      { k: "filmi.tausta", t: "col", l: "Tausta", st: ["revitty"] },
      { k: "filmi.taustaleveys", t: "rng", l: "Taustan leveys", min: 0, max: 30, step: 0.5, u: "%", st: ["revitty"] },
      { k: "filmi.siemen", t: "seed", l: "Satunnaisuus", st: ALL },
      { t: "hint", l: "Jokainen kuva saa oman, toistettavan kehyksen (tiedostonimi + satunnaisuusluku)." },
    ] },
    { id: "3", title: "3. Reunukset", tog: "reunukset.kaytossa", fields: [
      { t: "sub", l: "Viiva" },
      { k: "viiva.px", t: "rng", l: "Leveys", min: 0, max: 30, step: 1, u: "px" },
      { k: "viiva.vari", t: "col", l: "Väri" },
      { t: "sub", l: "Täyttö kuvasuhteeseen" },
      { k: "taytto.suhde", t: "sel", l: "Kuvasuhde", o: [["ei", "Ei"], ["1:1", "1:1 neliö"], ["4:5", "4:5 pysty (IG 1080×1350)"],
        ["3:4", "3:4 pysty (IG 1080×1440)"], ["5:4", "5:4 vaaka"], ["1.91:1", "1,91:1 vaaka (IG 1080×566)"],
        ["2:3", "2:3 pysty"], ["3:2", "3:2 vaaka"], ["16:9", "16:9 vaaka"], ["9:16", "9:16 pysty"]] },
      { k: "taytto.vari", t: "col", l: "Väri" },
      { t: "sub", l: "Reunus" },
      { k: "reunus.tapa", t: "sel", l: "Tapa", o: [["ei", "Ei reunusta"], ["ps_pros", "Photoshop: % leveydestä ja korkeudesta"],
        ["pros_pidempi", "Tasainen: % pidemmästä sivusta"], ["px", "Tasainen: px joka sivulle"]] },
      { k: "reunus.arvo", t: "rng", l: "Arvo", min: 0, max: 200, step: 0.5 },
      { k: "reunus.vari", t: "col", l: "Väri" },
    ] },
    { id: "4", title: "4. Lopullinen koko", fields: [
      { k: "tulostus.loppu", t: "sel", l: "Koko", o: [["ei", "Ei muutosta"], ["ig", "Instagram – leveys 1080 px"],
        ["fb", "Facebook – pidempi sivu 2048 px"], ["leveys", "Oma: leveys"], ["pidempi", "Oma: pidempi sivu"]] },
      { k: "tulostus.loppuleveys", t: "rng", l: "Oma koko", min: 100, max: 8000, step: 10, u: "px",
        show: (p) => ["leveys", "pidempi"].includes(p.tulostus.loppu) },
      { t: "hint", l: "Valmis kuva pienennetään tähän kokoon. Pientä kuvaa ei suurenneta." },
    ] },
    { id: "5", title: "5. Tallennus", fields: [
      { k: "tulostus.laatu", t: "rng", l: "JPEG-laatu", min: 50, max: 100, step: 1 },
      { k: "tulostus.liite", t: "txt", l: "Nimen liite" },
    ] },
  ];
  const get = (p, k) => k.split(".").reduce((o, x) => (o ? o[x] : undefined), p);
  const set = (p, k, v) => { const ks = k.split("."); const last = ks.pop(); const o = ks.reduce((o, x) => (o[x] = o[x] || {}), p); o[last] = v; };

  const ctl = {};   // avain -> {row, set(v), label}
  const bodies = {};
  function buildForm() {
    const form = $("form"); form.textContent = "";
    const openState = LS.get("kehys.open", { "1": false, "2": true, "3": true, "4": true, "5": false });
    for (const sec of SECTIONS) {
      const d = document.createElement("details"); d.className = "sec"; d.open = !!openState[sec.id];
      d.addEventListener("toggle", () => { const s = LS.get("kehys.open", openState); s[sec.id] = d.open; LS.set("kehys.open", s); });
      const sm = document.createElement("summary"); sm.textContent = sec.title;
      if (sec.tog) {
        const lab = document.createElement("label"); lab.className = "tog";
        const cb = document.createElement("input"); cb.type = "checkbox"; cb.id = "f_" + sec.tog.replace(".", "_");
        lab.addEventListener("click", (e) => e.stopPropagation());
        cb.addEventListener("change", () => change(sec.tog, cb.checked));
        lab.append(cb, document.createTextNode("Käytössä"));
        sm.append(lab);
        ctl[sec.tog] = { set: (v) => (cb.checked = !!v) };
      }
      const body = document.createElement("div"); body.className = "body"; bodies[sec.id] = { el: body, tog: sec.tog };
      for (const f of sec.fields) body.append(field(f));
      d.append(sm, body); form.append(d);
    }
  }
  function field(f) {
    if (f.t === "hint" || f.t === "sub") { const h = document.createElement("div"); h.className = f.t; h.textContent = f.l; return h; }
    const row = document.createElement("div"); row.className = "f";
    const lab = document.createElement("label"); lab.textContent = f.l;
    const c = document.createElement("div"); c.className = "ctl";
    const id = "f_" + f.k.replace(".", "_"); lab.htmlFor = id;
    let setter;
    if (f.t === "sel") {
      const s = document.createElement("select"); s.id = id;
      for (const [v, l] of f.o) { const o = document.createElement("option"); o.value = v; o.textContent = l; s.append(o); }
      s.addEventListener("change", () => change(f.k, s.value));
      c.append(s); setter = (v) => { if (![...s.options].some((o) => o.value === v)) { const o = document.createElement("option"); o.value = v; o.textContent = (K.OTHER[v] || v) + " (ei iPadilla)"; s.append(o); } s.value = v; };
    } else if (f.t === "rng") {
      const r = document.createElement("input"); r.type = "range"; r.min = f.min; r.max = f.max; r.step = f.step; r.setAttribute("aria-label", f.l);
      const n = document.createElement("input"); n.type = "number"; n.id = id; n.min = f.min; n.step = f.step; n.inputMode = "decimal";
      r.addEventListener("input", () => { n.value = r.value; change(f.k, +r.value); });
      n.addEventListener("change", () => { const v = Math.max(f.min, +n.value || 0); r.value = v; change(f.k, v); });
      c.append(r, n);
      const u = document.createElement("span"); u.className = "hint unit"; u.textContent = f.u || ""; c.append(u);
      setter = (v) => { r.value = v; n.value = v; };
    } else if (f.t === "col") {
      const i = document.createElement("input"); i.type = "color"; i.id = id;
      i.addEventListener("input", () => change(f.k, i.value));
      c.append(i); setter = (v) => (i.value = /^#[0-9a-f]{6}$/i.test(v) ? v : "#000000");
    } else if (f.t === "txt") {
      const i = document.createElement("input"); i.type = "text"; i.id = id; i.autocapitalize = "off"; i.spellcheck = false;
      i.addEventListener("input", () => change(f.k, i.value));
      c.append(i); setter = (v) => (i.value = v ?? "");
    } else if (f.t === "seed") {
      const n = document.createElement("input"); n.type = "number"; n.id = id; n.min = 1; n.max = 99999; n.style.width = "96px";
      n.addEventListener("change", () => change(f.k, Math.max(1, Math.round(+n.value || 1))));
      const b = document.createElement("button"); b.className = "btn"; b.type = "button"; b.textContent = "Arvo uusi";
      b.addEventListener("click", () => { const v = 1 + Math.floor(Math.random() * 99999); n.value = v; change(f.k, v); });
      c.append(n, b); setter = (v) => (n.value = v);
    }
    row.append(lab, c);
    ctl[f.k] = { row, set: setter, f, lab };
    return row;
  }

  // ---------------- tila ----------------
  const saved = () => presets[cur];
  const now = () => { const p = saved(); if (!work[p.name]) work[p.name] = clone(p); return work[p.name]; };
  const dirty = (p) => !!work[p.name] && !same(work[p.name], p);

  function refreshCombo() {
    const s = $("preset"); s.textContent = "";
    presets.forEach((p, i) => {
      const o = document.createElement("option"); o.value = i;
      o.textContent = p.name + (p._builtin ? "  (perus)" : "") + (dirty(p) ? "  •" : "");
      s.append(o);
    });
    s.value = cur;
  }
  function loadForm() {
    const p = now();
    for (const [k, c] of Object.entries(ctl)) c.set(get(p, k));
    updateState();
    schedule();
  }
  function updateState() {
    const p = saved(), w = now(), d = dirty(p), b = !!p._builtin;
    const st = $("state");
    st.className = "state" + (d ? " dirty" : "");
    st.textContent = b ? (d ? "Perusasetus, muutettu – tallenna muutokset uutena." : "Perusasetus (lukittu).")
      : (d ? "Muutettu – ei tallennettu." : "Tallennettu" + " tähän laitteeseen.");
    if (!K.STYLES.some(([k]) => k === w.filmi.tyyli) && w.filmi.kaytossa)
      st.textContent += ` Tyyli "${K.OTHER[w.filmi.tyyli] || w.filmi.tyyli}" ei ole vielä iPadilla – käytetään sivellintä.`;
    $("pSave").disabled = !d || b; $("pRevert").disabled = !d; $("pRename").disabled = b; $("pDel").disabled = b;
    const style = K.STYLES.some(([k]) => k === w.filmi.tyyli) ? w.filmi.tyyli : "sivellin";
    for (const [k, c] of Object.entries(ctl)) {
      if (!c.f) continue;
      let vis = true;
      if (c.f.st && c.f.st !== ALL) vis = c.f.st.includes(style);
      if (c.f.show) vis = vis && c.f.show(w);
      c.row.hidden = !vis;
      if (c.f.l2) c.lab.textContent = c.f.l2[style] || c.f.l;
    }
    for (const b2 of Object.values(bodies)) if (b2.tog) b2.el.classList.toggle("off", !get(w, b2.tog));
    const opt = $("preset").options[cur];
    if (opt) opt.textContent = p.name + (b ? "  (perus)" : "") + (d ? "  •" : "");
  }
  function change(k, v) {
    set(now(), k, v);
    updateState(); schedule();
  }

  // ---------------- esiasetustoiminnot ----------------
  function uniq(base) { const names = new Set(presets.map((p) => p.name)); let n = base, k = 2; while (names.has(n)) n = `${base} ${k++}`; return n; }
  function rebuild(selectName) {
    presets = [...BUILTIN, ...users];
    const i = presets.findIndex((p) => p.name === selectName);
    cur = i >= 0 ? i : 0;
    LS.set("kehys.last", saved().name);
    refreshCombo(); loadForm();
  }
  let newMode = "new";
  $("preset").addEventListener("change", (e) => { cur = +e.target.value; LS.set("kehys.last", saved().name); hideRows(); loadForm(); });
  $("pSave").addEventListener("click", async () => {
    const p = saved(); if (p._builtin || !dirty(p)) return;
    const i = users.findIndex((u) => u.name === p.name); users[i] = clone(now()); delete work[p.name];
    await saveUsers(); rebuild(p.name); say("Esiasetus tallennettu.", "ok");
  });
  $("pRevert").addEventListener("click", () => { delete work[saved().name]; loadForm(); refreshCombo(); });
  $("pNew").addEventListener("click", () => {
    newMode = "new"; const p = saved();
    $("newName").value = uniq(p.name + (p._builtin ? " – oma" : " kopio"));
    $("newRow").hidden = false; $("delRow").hidden = true; $("newName").focus(); $("newName").select();
  });
  $("pRename").addEventListener("click", () => {
    if (saved()._builtin) return; newMode = "rename";
    $("newName").value = saved().name; $("newRow").hidden = false; $("delRow").hidden = true; $("newName").focus();
  });
  $("newCancel").addEventListener("click", hideRows);
  $("newName").addEventListener("keydown", (e) => { if (e.key === "Enter") $("newOk").click(); if (e.key === "Escape") hideRows(); });
  $("newOk").addEventListener("click", async () => {
    const name = $("newName").value.trim(); if (!name) return;
    const src = saved();
    if (newMode === "rename") {
      if (name === src.name) return hideRows();
      const nn = uniq(name), i = users.findIndex((u) => u.name === src.name);
      const w = work[src.name]; delete work[src.name];
      users[i] = { ...users[i], name: nn }; if (w) work[nn] = { ...w, name: nn };
      await saveUsers(); hideRows(); rebuild(nn); return;
    }
    const p = clone(now()); delete p._builtin; p.name = uniq(name);
    users.push(p); delete work[src.name];
    await saveUsers(); hideRows(); rebuild(p.name); say("Tallennettu uutena esiasetuksena.", "ok");
  });
  $("pDel").addEventListener("click", () => { if (saved()._builtin) return; $("delRow").hidden = false; $("newRow").hidden = true; });
  $("delCancel").addEventListener("click", hideRows);
  $("delOk").addEventListener("click", async () => {
    const p = saved(); users = users.filter((u) => u.name !== p.name); delete work[p.name];
    await saveUsers(); hideRows(); rebuild(BUILTIN[0].name);
  });
  function hideRows() { $("newRow").hidden = true; $("delRow").hidden = true; }
  $("pImport").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", async (e) => {
    const file = e.target.files[0]; e.target.value = ""; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data)) throw new Error("tiedostossa ei ole esiasetuslistaa");
      let n = 0, last = null;
      for (const raw of data) {
        if (!raw || typeof raw !== "object" || !raw.name) continue;
        const p = fill(raw); delete p._builtin;
        if (RENAMED[p.name]) p.name = RENAMED[p.name];
        if (BUILTIN.some((b) => b.name === p.name)) p.name += " (Mac)";
        const i = users.findIndex((u) => u.name === p.name);
        if (i >= 0) users[i] = p; else users.push(p);
        n++; last = p.name;
      }
      if (!n) throw new Error("tiedostosta ei löytynyt esiasetuksia");
      await saveUsers(); rebuild(last);
      say(`Tuotiin ${n} esiasetusta.`, "ok");
    } catch (err) { say(`Tuonti epäonnistui: ${err.message}. Valitse Macin presets.json tai täältä viety kehys-esiasetukset.json.`, "err"); }
  });

  // ---------------- kuvat ----------------
  const images = [];   // {file, name, url, img}
  let sel = -1;
  $("add").addEventListener("click", () => $("file").click());
  $("file").addEventListener("change", (e) => { addFiles([...e.target.files]); e.target.value = ""; });
  $("clear").addEventListener("click", () => { images.splice(0).forEach((i) => URL.revokeObjectURL(i.url)); sel = -1; renderStrip(); schedule(); });
  ["dragover", "drop"].forEach((t) => document.addEventListener(t, (e) => {
    e.preventDefault(); if (t === "drop") addFiles([...e.dataTransfer.files].filter((f) => f.type.startsWith("image/")));
  }));
  function addFiles(files) {
    for (const file of files) images.push({ file, name: file.name, url: URL.createObjectURL(file), img: null });
    if (files.length && sel < 0) sel = images.length - files.length;
    renderStrip(); schedule();
  }
  function renderStrip() {
    const s = $("strip"); s.textContent = "";
    if (!images.length) { const e = document.createElement("div"); e.className = "empty"; e.textContent = "Esimerkkikuva. Lisää omia kuvia Kuvista tai Tiedostoista."; s.append(e); return; }
    images.forEach((im, i) => {
      const b = document.createElement("button"); b.className = "thumb" + (i === sel ? " on" : ""); b.type = "button";
      b.setAttribute("aria-label", im.name);
      const t = document.createElement("img"); t.src = im.url; t.alt = "";
      const x = document.createElement("span"); x.className = "x"; x.textContent = "×"; x.setAttribute("role", "button"); x.setAttribute("aria-label", "Poista listalta");
      x.addEventListener("click", (e) => { e.stopPropagation(); URL.revokeObjectURL(im.url); images.splice(i, 1);
        if (sel >= images.length) sel = images.length - 1; renderStrip(); schedule(); });
      b.addEventListener("click", () => { sel = i; renderStrip(); schedule(); });
      b.append(t, x); s.append(b);
    });
  }
  async function getImg(im) {
    if (im.img) return im.img;
    const i = new Image(); i.decoding = "async"; i.src = im.url;
    await i.decode();
    im.img = i; return i;
  }
  let sample = null;
  function sampleImage() {
    if (sample) return sample;
    const c = K.mk(1800, 1200), x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, 1200); g.addColorStop(0, "#1a1410"); g.addColorStop(1, "#050404"); x.fillStyle = g; x.fillRect(0, 0, 1800, 1200);
    const sp = x.createRadialGradient(980, 380, 20, 980, 520, 620); sp.addColorStop(0, "rgba(255,226,170,.85)"); sp.addColorStop(.45, "rgba(170,90,40,.35)"); sp.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = sp; x.fillRect(0, 0, 1800, 1200);
    x.fillStyle = "#0b0907";   // kontrabasistin siluetti
    x.beginPath(); x.ellipse(930, 760, 150, 260, -0.12, 0, Math.PI * 2); x.fill();
    x.fillRect(905, 180, 22, 420); x.beginPath(); x.arc(1080, 420, 58, 0, Math.PI * 2); x.fill();
    x.fillRect(1040, 470, 90, 520);
    x.fillStyle = "rgba(230,226,218,.35)"; x.font = "500 40px Barlow, sans-serif"; x.fillText("ESIMERKKIKUVA", 60, 1140);
    sample = c; return c;
  }

  // ---------------- esikatselu ----------------
  let timer = 0, gen = 0;
  function schedule() { clearTimeout(timer); timer = setTimeout(preview, 160); }
  async function preview() {
    const my = ++gen;
    const im = sel >= 0 ? images[sel] : null;
    $("busy").textContent = "lasketaan…";
    await new Promise((r) => setTimeout(r, 0));
    try {
      const src = im ? await getImg(im) : sampleImage();
      if (my !== gen) return;
      const v = $("view"), dpr = Math.min(2, window.devicePixelRatio || 1);
      const side = Math.max(600, Math.min(1600, Math.max(v.clientWidth, v.clientHeight) * dpr));
      const p = effective(now());
      const r = K.process(src, p, im ? im.name : "esimerkki", { preview: side });
      if (my !== gen) return;
      const c = $("pv"); c.width = r.canvas.width; c.height = r.canvas.height;
      c.getContext("2d").drawImage(r.canvas, 0, 0);
      const [W, H] = r.finalSize;
      $("info").textContent = `${im ? im.name : "esimerkki"} · valmis kuva ${W} × ${H} px` + (r.note ? ` · ${r.note}` : "");
      $("busy").textContent = "";
    } catch (e) {
      $("busy").textContent = "";
      $("info").textContent = "Kuvaa ei voitu avata: " + (e && e.message ? e.message : e);
    }
  }
  // tyylit, joita iPad-versio ei vielä osaa → sivellin
  function effective(p) {
    if (K.STYLES.some(([k]) => k === p.filmi.tyyli)) return p;
    const q = clone(p); q.filmi.tyyli = "sivellin"; return q;
  }
  window.addEventListener("resize", schedule);

  // ---------------- tallennus ----------------
  function say(t, cls = "") { const m = $("msg"); m.textContent = t; m.className = "msg " + cls; }
  const outName = (name, p) => name.replace(/\.[^.]+$/, "") + (p.tulostus.liite || "") + ".jpg";
  function toJpeg(canvas, q) {
    return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("JPEG-pakkaus epäonnistui"))), "image/jpeg", q / 100));
  }
  async function render(im, p) {
    const src = await getImg(im);
    const r = K.process(src, p, im.name, {});
    return { blob: await toJpeg(r.canvas, p.tulostus.laatu || 92), note: r.note };
  }
  // Tallennus iPadin jakovalikolla (Tallenna kuva / Tallenna Tiedostoihin); muualla tavallinen lataus.
  let ready = null;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function deliver(files, okText) {
    if (navigator.canShare && navigator.canShare({ files })) {
      try {
        await navigator.share({ files });
        ready = null; $("shareReady").hidden = true; say(okText, "ok"); return;
      } catch (e) {
        if (e && e.name === "AbortError") { say("Tallennus peruttiin."); return; }
        if (e && e.name === "NotAllowedError") {
          // Safari vaatii jakamiselle tuoreen napautuksen – käsittely kesti liian kauan
          ready = { files, okText }; $("shareReady").hidden = false;
          $("shareReady").textContent = files.length > 1 ? `Jaa / tallenna ${files.length} kuvaa` : "Jaa / tallenna";
          say("Valmis – napauta vielä Jaa / tallenna.");
          return;
        }
        throw e;
      }
    }
    for (const f of files) {
      const u = URL.createObjectURL(f), el = document.createElement("a");
      el.href = u; el.download = f.name; document.body.append(el); el.click(); el.remove();
      setTimeout(() => URL.revokeObjectURL(u), 60000);
      await sleep(400);
    }
    say(okText, "ok");
  }
  $("shareReady").addEventListener("click", async () => {
    if (!ready) return;
    const r = ready;
    try { await navigator.share({ files: r.files }); ready = null; $("shareReady").hidden = true; say(r.okText, "ok"); }
    catch (e) { if (e && e.name === "AbortError") say("Tallennus peruttiin."); else say("Jakaminen ei onnistunut: " + (e.message || e), "err"); }
  });
  const asFile = (blob, name) => new File([blob], name, { type: blob.type || "image/jpeg" });
  $("saveOne").addEventListener("click", async () => {
    if (sel < 0) return say("Lisää ensin kuva.", "err");
    const p = effective(now()); say("Käsitellään…");
    await sleep(30);
    try {
      const { blob, note } = await render(images[sel], p);
      await deliver([asFile(blob, outName(images[sel].name, p))], "Valmis" + (note ? ` (${note})` : "") + ".");
    } catch (e) { say("Tallennus ei onnistunut: " + ((e && e.message) || e), "err"); }
  });
  $("saveAll").addEventListener("click", async () => {
    if (!images.length) return say("Lisää ensin kuvia.", "err");
    const p = effective(now()), files = [];
    try {
      for (let i = 0; i < images.length; i++) {
        say(`Käsitellään ${i + 1} / ${images.length}…`);
        await sleep(30);
        const { blob } = await render(images[i], p);
        files.push(asFile(blob, outName(images[i].name, p)));
      }
      await deliver(files, `Valmis: ${files.length} kuvaa.`);
    } catch (e) { say("Tallennus ei onnistunut: " + ((e && e.message) || e), "err"); }
  });
  $("pExport").addEventListener("click", async () => {
    if (!users.length) return say("Omia esiasetuksia ei vielä ole.", "err");
    const f = new File([JSON.stringify(users.map(strip), null, 2)], "kehys-esiasetukset.json", { type: "application/json" });
    try { await deliver([f], "Esiasetukset viety."); } catch (e) { say("Vienti ei onnistunut: " + (e.message || e), "err"); }
  });

  // ---------------- käynnistys ----------------
  buildForm();
  const last = LS.get("kehys.last", BUILTIN[0].name);
  cur = Math.max(0, presets.findIndex((p) => p.name === last));
  refreshCombo(); loadForm(); renderStrip();
  loadUsers().then(async (list) => {
    if (list == null) { users = STARTER.map(clone); await saveUsers(); }
    else users = list.filter((p) => p && p.name).map(fill);
    rebuild(last);
  });
  window.__kehys = { images, now };
})();
