"""Konversi template asli sekali; hasilnya statis, tidak butuh Python di hosting."""
import argparse
import json
import re
import shutil
from pathlib import Path
from jinja2 import Environment, nodes


def encode(node):
    if isinstance(node, list):
        return [encode(item) for item in node]
    if isinstance(node, tuple):
        return [encode(item) for item in node]
    if isinstance(node, nodes.Node):
        return {"type": type(node).__name__, **{key: encode(getattr(node, key)) for key in node.fields}}
    return node


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--legacy-root", type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    target = Path(__file__).resolve().parents[1] / "docs" / "assets"
    target.mkdir(parents=True, exist_ok=True)
    for source, name in [("static/style.css", "style.css"), ("static/logo-upi-serang.png", "logo-upi-serang.png"), ("logo-upi.png", "logo-upi.png"), ("pdf_generator.py", "pdf_generator.py")]:
        shutil.copyfile(args.legacy_root / source, target / name)
    templates = {}
    scripts = []
    env = Environment()
    for name in ["index", "login", "kaprodi", "riwayat", "status", "verifikasi"]:
        source = (args.legacy_root / "templates" / f"{name}.html").read_text(encoding="utf-8-sig")
        scripts.extend(re.findall(r"<script>([\s\S]*?)</script>", source))
        source = re.sub(r"<script>[\s\S]*?</script>", "", source)
        parsed = env.parse(source)
        # Wrapper/nav tetap dari index.html; blok content dan judul dipertahankan.
        templates[name] = encode([n for n in parsed.body if not isinstance(n, nodes.Extends)])
    (target / "legacy-templates.js").write_text("/* Otomatis dari template Flask asli. Jangan edit manual. */\nwindow.LEGACY_TEMPLATES = " + json.dumps(templates, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    (target / "legacy-home.js").write_text("/* Perilaku Tambah Mahasiswa dari web asli. */\nwindow.initOriginalHome = function () {\n" + "\n".join(scripts) + "\n};\n", encoding="utf-8")
    print("Template, CSS, logo, dan pembuat PDF asli telah disalin. Database dan tanda tangan asli tidak disalin.")


if __name__ == "__main__":
    main()
