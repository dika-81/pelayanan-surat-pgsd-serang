"""Buat ZIP publik dari daftar file yang diizinkan; aset privat selalu terpisah."""
from pathlib import Path
import hashlib
import zipfile
import json
from PIL import Image, ImageChops, ImageDraw, ImageFont


def make_specimen(source, output):
    with Image.open(source) as original:
        signature = original.convert('RGBA')
        white = Image.new('RGBA', signature.size, 'white')
        visible = Image.alpha_composite(white, signature).convert('RGB')
        bounds = ImageChops.difference(visible, Image.new('RGB', visible.size, 'white')).convert('L').point(lambda v: 255 if v > 30 else 0).getbbox()
        if bounds:
            signature = signature.crop(bounds)
        canvas = Image.new('RGBA', (signature.width+60, signature.height+60), 'white')
        canvas.paste(signature, (30,30), signature)
        overlay = Image.new('RGBA', canvas.size, (255,255,255,0))
        draw = ImageDraw.Draw(overlay)
        try:
            font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', max(14,canvas.width//22))
        except OSError:
            font = ImageFont.load_default()
        text = 'VERIFIKASI RESMI PGSD'
        bounds = draw.textbbox((0,0),text,font=font)
        draw.text(((canvas.width-(bounds[2]-bounds[0]))/2,(canvas.height-(bounds[3]-bounds[1]))/2),text,font=font,fill=(31,78,121,100))
        Image.alpha_composite(canvas,overlay).convert('RGB').save(output)


def main():
    project=Path(__file__).resolve().parents[1]
    workspace=project.parent
    public=workspace/'SIAP-UPLOAD-GITHUB.zip'
    private=workspace/'ASET-PRIVAT-UNTUK-DRIVE.zip'
    backend=(project/'apps-script/Code.gs').read_text(encoding='utf-8')
    bridge=(project/'apps-script/Bridge.html').read_text(encoding='utf-8')
    combined='// Tempel seluruh isi file ini ke Code.gs pada proyek Apps Script baru.\nvar BRIDGE_HTML_ = '+json.dumps(bridge,ensure_ascii=False)+';\n'+backend.replace("HtmlService.createTemplateFromFile('Bridge')",'HtmlService.createTemplate(BRIDGE_HTML_)')
    (project/'apps-script/Code-satu-file.txt').write_text(combined,encoding='utf-8')
    roots=['docs','apps-script','tests','tools','.github']
    files=[project/name for name in ['.gitignore','package.json','README.md','PANDUAN-PASANG.md']]
    for root in roots:
        files.extend(p for p in (project/root).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
    with zipfile.ZipFile(public,'w',zipfile.ZIP_DEFLATED) as z:
        for file in sorted(files):
            assert file.suffix.lower() not in ['.db','.pdf','.sqlite'],file
            assert not file.name.startswith(('ttd','cap')),file
            z.write(file,file.relative_to(project).as_posix())
    private_folder=project/'private'
    private_folder.mkdir(exist_ok=True)
    specimen=private_folder/'spesimen-bertanda-air.png'
    make_specimen(workspace/'ttd.png',specimen)
    with zipfile.ZipFile(private,'w',zipfile.ZIP_DEFLATED) as z:
        z.write(specimen,specimen.name)
        z.writestr('BACA-DAHULU.txt','ASET PRIVAT: unggah spesimen-bertanda-air.png hanya ke folder Aset Privat yang dibuat Apps Script. Jangan unggah ZIP ini atau isinya ke GitHub. Gambar sudah diberi tanda air; gambar tanda tangan asli tidak disertakan.\n')
    hashes=[]
    for file in [public,private]:
        digest=hashlib.sha256(file.read_bytes()).hexdigest()
        hashes.append(f'{digest}  {file.name}')
        print(file.name+': '+str(file.stat().st_size)+' bytes')
    (workspace/'PAKET-SHA256.txt').write_text('\n'.join(hashes)+'\n',encoding='utf-8')
    print('Paket publik tidak memuat database, surat mahasiswa, kredensial, atau gambar tanda tangan asli.')


if __name__=='__main__':
    main()
