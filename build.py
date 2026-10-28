"""Kokoaa index.html:n lähdetiedostoista: python3 build.py"""
from pathlib import Path
src = Path(__file__).parent / "src"
ui = (src / "ui.html").read_text(encoding="utf-8")
html = ui.replace("/*ENGINE*/", (src / "engine.js").read_text(encoding="utf-8")).replace("/*APP*/", (src / "app.js").read_text(encoding="utf-8"))
(Path(__file__).parent / "index.html").write_text(html, encoding="utf-8")
print("index.html", len(html), "tavua")
