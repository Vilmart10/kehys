# Kehys

Reunukset ja artkehykset valmiisiin kuviin – selaimessa toimiva versio Mac-ohjelmasta Kehys, tehty ensisijaisesti iPadille.

Kuvat käsitellään laitteella; mitään ei lähetetä palvelimelle.

## Käyttö iPadilla

1. Avaa sovelluksen osoite Safarissa.
2. Jaa → **Lisää Koti-valikkoon**. Kehys aukeaa omana sovelluksenaan ja toimii myös ilman verkkoa.
3. **Lisää kuvia…** → valitse Kuvista tai Tiedostoista.
4. **Tallenna tämä kuva** / **Tallenna kaikki** → jakovalikosta *Tallenna kuva* (Kuviin) tai *Tallenna Tiedostoihin*.

## Esiasetukset

- Omat esiasetukset tallentuvat tämän laitteen selaimeen.
- **Vie…** tallentaa ne tiedostoon `kehys-esiasetukset.json` (varmuuskopio tai siirto toiselle laitteelle).
- **Tuo…** lukee joko viedyn tiedoston tai Mac-Kehyksen `presets.json`-tiedoston
  (Macilla: Finder → Siirry → Siirry kansioon → `~/Library/Application Support/Kehys`).

## Mukana

- Artkehys: sivellin, revitty vedos, Polaroid
- Reunukset: viiva, täyttö kuvasuhteeseen, reunus
- Työkoko, lopullinen koko (Instagram 1080 px, Facebook 2048 px, oma), JPEG-laatu, nimen liite

Mac-versiosta puuttuu toistaiseksi: signeeraus, terävöinti sekä tyylit viilattu, pikafilmi, 35 mm filminauha ja 6×6.
Valmiin kuvan enimmäiskoko on noin 15,5 megapikseliä (Safarin rajoitus); suuremmat pienennetään automaattisesti.

## Päivittäminen

Muokkaa `src/`-kansion tiedostoja, aja `python3 build.py`, vaihda `sw.js`:n `VERSIO`, ja pushaa. GitHub Pages julkaisee muutaman minuutin kuluttua.
