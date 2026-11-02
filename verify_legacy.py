"""Uji kesamaan template/PDF asli terhadap versi browser; tidak membaca database."""
import argparse
import importlib.util
import json
import re
from pathlib import Path
from jinja2 import DictLoader, Environment, select_autoescape
import fitz


def module_from(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--legacy-root', type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    project = Path(__file__).resolve().parents[1]
    templates = {'base.html': '{% block content %}{% endblock %}'}
    for p in (args.legacy_root / 'templates').glob('*.html'):
        if p.name != 'base.html':
            templates[p.name] = re.sub(r'<script>[\s\S]*?</script>', '', p.read_text(encoding='utf-8-sig'))
    env = Environment(loader=DictLoader(templates), autoescape=select_autoescape(['html']))
    env.filters['daftar_anggota'] = lambda v: v if isinstance(v, list) else json.loads(v or '[]')

    def url_for(name, **opts):
        routes = {'index': '/', 'check_status': '/cek-status', 'student_history': '/riwayat', 'admin_login': '/admin/login', 'admin_logout': '/admin/logout', 'kaprodi': '/kaprodi', 'submit_request': '/pengajuan'}
        if name == 'static': return 'assets/' + opts['filename']
        if name == 'status': return '#/status/' + opts['code']
        if name == 'verifikasi': return '#/verifikasi/' + opts['code']
        if name == 'download_signed': return '#/unduh/' + opts['filename']
        for action, route in [('sign_request', 'sign'), ('reject_request', 'reject'), ('delete_request', 'delete')]:
            if name == action: return '#/kaprodi/' + route + '/' + opts['request_id']
        return '#' + routes[name]

    env.globals.update(url_for=url_for, get_flashed_messages=lambda **kw: [], session={})
    row = dict(id='abc123', tracking_code='0123456789ABCDEF0123', nama='Siti & Budi <Uji>', nim='001234567', semester='4', jenis_surat='Surat B', catatan='SD Negeri 1 Serang', anggota=[dict(nama='Siti & Budi <Uji>', nim='001234567', semester='4'), dict(nama='Dewi', nim='009876543', semester='5')], nomor_surat='01/UPI/2026', signed_filename='surat-b-0123456789ABCDEF0123.pdf', status='Ditandatangani', document_hash='a'*64, signature_hash='b'*64, signed_by='Dr. Andika Arisetyawan, M.Si', signed_at='2026-11-02 10:20:30', created_at='2026-11-01 09:10:20')
    cases = [('index', {}), ('login', {}), ('kaprodi', {'requests': []}), ('kaprodi', {'requests': [row, {**row, 'id': 'b', 'status': 'Menunggu', 'signed_filename': ''}, {**row, 'id': 'c', 'status': 'Ditolak', 'signed_filename': ''}]}), ('riwayat', {'nim': ''}), ('riwayat', {'nim': row['nim'], 'requests': [row]}), ('riwayat', {'nim': row['nim'], 'requests': []}), ('status', {'request_data': row}), ('status', {'request_data': {**row, 'anggota': [], 'signature_hash': '', 'signed_filename': '', 'signed_at': ''}}), ('verifikasi', {'request_data': None, 'code': row['tracking_code']}), ('verifikasi', {'request_data': {**row, 'signature_hash': ''}, 'code': row['tracking_code']}), ('verifikasi', {'request_data': row, 'code': row['tracking_code'], 'pejabat': row['signed_by'], 'nip': 'NIP. 198103272005021003', 'specimen_url': 'data:image/png;base64,test'})]
    fixtures = [{'name': name, 'case': i, 'context': context, 'expected': env.get_template(name+'.html').render(**context)} for i, (name, context) in enumerate(cases)]
    folder = project / 'tests' / 'fixtures'
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'template-parity.json').write_text(json.dumps(fixtures, ensure_ascii=False), encoding='utf-8')

    original = module_from(args.legacy_root / 'pdf_generator.py', 'original_pdf')
    online = module_from(project / 'docs' / 'assets' / 'pdf_generator.py', 'online_pdf')
    assert (args.legacy_root/'pdf_generator.py').read_bytes() == (project/'docs/assets/pdf_generator.py').read_bytes(), 'Pembuat PDF harus identik byte demi byte.'
    output = project / 'output' / 'pdf'
    temp = project / 'tmp' / 'pdfs'
    output.mkdir(parents=True, exist_ok=True)
    temp.mkdir(parents=True, exist_ok=True)
    payload = dict(nomor='001/UN40.C5/PK.03.02/2026', nomor_surat='001/UN40.C5/PK.03.02/2026', nama='Mahasiswa Contoh', nim='221234567', semester='6', jenis_surat='Surat Aktif Kuliah', layanan='surat_a', keperluan='SD Negeri 1 Serang, Jalan Pendidikan No. 1, Serang', tanggal='2 November 2026', pejabat='Dr. Andika Arisetyawan, M.Si', nip='NIP. 198103272005021003', verifikasi_kode='0123456789ABCDEF0123', verifikasi_hash='a'*64, verifikasi_waktu='2026-11-02 10:20:30')
    for name, changes in [('contoh-surat-a', {}), ('contoh-surat-b-perorangan', {'layanan':'surat_b', 'jenis_surat':'Surat B'}), ('contoh-surat-b-kelompok', {'layanan':'surat_b', 'jenis_surat':'Surat B', 'anggota':[dict(nama='Mahasiswa Contoh',nim='221234567',semester='6'),dict(nama='Mahasiswa Kedua',nim='221234568',semester='6'),dict(nama='Mahasiswa Ketiga',nim='221234569',semester='6')]})]:
        data = {**payload, **changes}
        reference = temp / (name+'-asli.pdf')
        result = output / (name+'.pdf')
        original.build_pdf(data, reference, args.legacy_root/'logo-upi.png')
        online.build_pdf(data, result, project/'docs/assets/logo-upi.png')
        with fitz.open(reference) as before, fitz.open(result) as after:
            assert len(before) == len(after), name
            for index, (a, b) in enumerate(zip(before, after)):
                assert a.get_text() == b.get_text(), name + ': teks berbeda'
                pa, pb = a.get_pixmap(matrix=fitz.Matrix(1.5,1.5)), b.get_pixmap(matrix=fitz.Matrix(1.5,1.5))
                assert pa.samples == pb.samples, name + ': piksel berbeda'
                pb.save(temp / (name+f'-{index+1}.png'))
        print(name+': teks, jumlah halaman, dan piksel identik dengan PDF asli')
    print('12 skenario template asli disiapkan untuk pengujian Node.')


if __name__ == '__main__':
    main()
