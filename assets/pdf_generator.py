import argparse
import json
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import (
    TA_CENTER,
    TA_JUSTIFY,
    TA_LEFT,
)
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import (
    ParagraphStyle,
    getSampleStyleSheet,
)
from reportlab.lib.units import mm
from reportlab.platypus import (
    Flowable,
    Image,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

BASE_DIR = Path(__file__).resolve().parent


class LetterheadRule(Flowable):
    def __init__(self, width):
        super().__init__()
        self.width = width
        self.height = 3.5

    def draw(self):
        self.canv.setStrokeColor(colors.black)

        self.canv.setLineWidth(2)

        self.canv.line(
            0,
            2.5,
            self.width,
            2.5
        )

        self.canv.setLineWidth(0.6)

        self.canv.line(
            0,
            0,
            self.width,
            0
        )


def clean(value, fallback="-"):
    value = (
        ""
        if value is None
        else str(value).strip()
    )

    return value or fallback


def load_payload(args):
    data = {}

    if args.data:
        with open(
            args.data,
            "r",
            encoding="utf-8"
        ) as file:
            data = json.load(file)

    for key in [
        "nomor",
        "nama",
        "nim",
        "semester",
        "keperluan",
        "tanggal",
        "jabatan",
        "pejabat",
        "nip",
    ]:
        value = getattr(args, key)

        if value:
            data[key] = value

    return {
        "nomor": clean(
            data.get("nomor"),
            "____/UN40.C5/PK.03.02/2026"
        ),

        "nama": clean(
            data.get("nama"),
            "[nama mahasiswa]"
        ),

        "nim": clean(
            data.get("nim"),
            "[NIM]"
        ),

        "semester": clean(
            data.get("semester"),
            "[semester]"
        ),

        "keperluan": clean(
            data.get("keperluan"),
            "[keperluan]"
        ),

        "tanggal": clean(
            data.get("tanggal"),
            "Serang, 22 Mei 2026"
        ),

        "jabatan": clean(
            data.get("jabatan"),
            "a.n. Wakil Direktur Bidang Pendidikan,<br>"
            " Kemahasiswaan dan Penjaminan Mutu,<br>"
            " Kaprodi PGSD UPI Serang"
        ),

        "pejabat": clean(
            data.get("pejabat"),
            ""
        ),

        "nip": clean(
            data.get("nip"),
            ""
        ),

        "signature_path": clean(
            data.get("signature_path"),
            ""
        ),
    }


def make_styles():
    styles = getSampleStyleSheet()

    styles.add(
        ParagraphStyle(
            name="HeadCenter",
            parent=styles["Normal"],
            fontName="Times-Roman",
            fontSize=14,
            leading=14,
            alignment=TA_CENTER,
        )
    )

    styles.add(
        ParagraphStyle(
            name="HeadLarge",
            parent=styles["HeadCenter"],
            fontSize=14,
            leading=16,
        )
    )

    styles.add(
        ParagraphStyle(
            name="Address",
            parent=styles["Normal"],
            fontName="Times-Roman",
            fontSize=12,
            leading=11,
            alignment=TA_CENTER,
        )
    )

    styles.add(
        ParagraphStyle(
            name="BodyLetter",
            parent=styles["Normal"],
            fontName="Times-Roman",
            fontSize=12,
            leading=18,
            alignment=TA_JUSTIFY,
        )
    )

    styles.add(
        ParagraphStyle(
            name="BodyLeft",
            parent=styles["BodyLetter"],
            alignment=TA_LEFT,
        )
    )

    styles.add(
        ParagraphStyle(
            name="TitleLetter",
            parent=styles["Normal"],
            fontName="Times-Roman",
            fontSize=12.5,
            leading=16,
            alignment=TA_CENTER,
            underline=True,
        )
    )

    styles.add(
        ParagraphStyle(
            name="TableCell",
            parent=styles["Normal"],
            fontName="Times-Roman",
            fontSize=11.5,
            leading=14,
            alignment=TA_LEFT,
        )
    )

    styles.add(
        ParagraphStyle(
            name="TableCellCenter",
            parent=styles["TableCell"],
            alignment=TA_CENTER,
        )
    )

    styles.add(
        ParagraphStyle(
            name="Number",
            parent=styles["Normal"],
            fontName="Times-Roman",
            fontSize=12,
            leading=15,
            alignment=TA_CENTER,
        )
    )

    return styles


def build_letterhead(
    story,
    styles,
    logo_path,
    available_width
):
    if logo_path and logo_path.exists():

        logo = Image(
            str(logo_path),
            width=26.7 * mm,
            height=26.5 * mm,
            kind="proportional"
        )

    else:

        logo = Paragraph(
            "Logo<br/>UPI",
            styles["Address"]
        )

    head = [
        Paragraph(
            "KEMENTERIAN PENDIDIKAN TINGGI, SAINS <br/> DAN TEKNOLOGI",
            styles["HeadCenter"]
        ),

        Paragraph(
            "UNIVERSITAS PENDIDIKAN INDONESIA",
            styles["HeadLarge"]
        ),

        Paragraph(
            "<b>KAMPUS UPI DI SERANG</b>",
            styles["HeadLarge"]
        ),

        Paragraph(
            "Jalan Ciracas Nomor 02 Serang 42116<br/>"
            "Telepon: (0254) 200277, Faksimile: (0254) 200277<br/>"
            "Laman http://kd-serang.upi.edu; surel/e-mail: dirkamda_serang@upi.edu",
            styles["Address"]
        ),
    ]

    table = Table(
        [[logo, head]],
        colWidths=[
            28 * mm,
            available_width - 28 * mm
        ],
        hAlign="LEFT",
    )

    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (0, 0), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )

    story.append(table)

    story.append(
        LetterheadRule(available_width)
    )


def get_anggota(data):
    """Daftar mahasiswa pemohon surat B (kosong bila perorangan)."""

    anggota = data.get("anggota") or []

    if not isinstance(anggota, (list, tuple)):
        return []

    hasil = []

    for item in anggota:

        if not isinstance(item, dict):
            continue

        nama = clean(item.get("nama"), "")

        nim = clean(item.get("nim"), "")

        semester = clean(item.get("semester"), "")

        if not nama and not nim:
            continue

        hasil.append({
            "nama": nama,
            "nim": nim,
            "semester": semester,
        })

    return hasil


def build_group_table(anggota, styles, available_width):
    """Tabel identitas untuk pemohon surat B berkelompok.

    Dipakai hanya bila pemohonnya lebih dari satu orang. Pemohon
    tunggal tetap memakai blok identitas biasa, dan surat A tidak
    pernah melewati fungsi ini.
    """

    baris = [
        [
            Paragraph("<b>No.</b>", styles["TableCellCenter"]),
            Paragraph("<b>Nama</b>", styles["TableCellCenter"]),
            Paragraph("<b>NIM</b>", styles["TableCellCenter"]),
            Paragraph("<b>Semester</b>", styles["TableCellCenter"]),
        ]
    ]

    for urutan, item in enumerate(anggota, start=1):

        baris.append([
            Paragraph(
                f"{urutan}.",
                styles["TableCellCenter"]
            ),

            Paragraph(
                clean(item["nama"]),
                styles["TableCell"]
            ),

            Paragraph(
                clean(item["nim"]),
                styles["TableCellCenter"]
            ),

            Paragraph(
                clean(item["semester"]),
                styles["TableCellCenter"]
            ),
        ])

    lebar_no = 12 * mm

    lebar_nim = 32 * mm

    lebar_semester = 24 * mm

    tabel = Table(
        baris,

        colWidths=[
            lebar_no,
            available_width - (
                lebar_no + lebar_nim + lebar_semester
            ),
            lebar_nim,
            lebar_semester,
        ],

        hAlign="LEFT",

        repeatRows=1,
    )

    tabel.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.6, colors.black),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eeeeee")),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )

    return tabel


def get_letter_title(layanan):
    if layanan == "surat_b":
        return "SURAT PERMOHONAN IZIN PENELITIAN/OBSERVASI"

    return "SURAT KETERANGAN AKTIF KULIAH"


def build_body_story(data, layanan, styles, identity):
    if layanan == "surat_b":

        # Pemohon boleh satu orang atau satu kelompok pada sekolah
        # yang sama. Kalimatnya menyesuaikan, sisanya tetap sama.
        berkelompok = len(get_anggota(data)) > 1

        pembuka = (
            "Saya yang bertanda tangan di bawah ini ketua program studi PGSD "
            "kampus UPI di Serang menerangkan bahwa nama-nama mahasiswa "
            "berikut:"
            if berkelompok
            else
            "Saya yang bertanda tangan di bawah ini ketua program studi PGSD "
            "kampus UPI di Serang menerangkan bahwa:"
        )

        keterangan_aktif = (
            "Adalah benar terdaftar sebagai mahasiswa aktif pada Program S1 "
            "PGSD Kampus UPI di Serang."
        )

        permohonan = (
            "Sehubungan dengan pelaksanaan kegiatan akademik mahasiswa, kami "
            "memohon kesediaan Bapak/Ibu untuk memberikan izin kepada "
            + (
                "mahasiswa-mahasiswa tersebut"
                if berkelompok
                else "mahasiswa tersebut"
            )
            + " untuk melaksanakan kegiatan penelitian/observasi di:"
        )

        return [
            Paragraph(
                pembuka,
                styles["BodyLetter"]
            ),

            Spacer(1, 1 * mm),

            identity,

            Spacer(1, 3 * mm),

            Paragraph(
                keterangan_aktif,
                styles["BodyLetter"]
            ),

            Spacer(1, 3 * mm),

            Paragraph(
                permohonan,
                styles["BodyLetter"]
            ),

            Spacer(1, 2 * mm),

            Paragraph(
                f"<b>{clean(data.get('keperluan'))}</b>",
                styles["BodyLeft"]
            ),

            Spacer(1, 3 * mm),

            Paragraph(
                "Demikian surat permohonan ini dibuat untuk dipergunakan sebagaimana "
                "mestinya. Atas perhatian dan kerja sama yang diberikan, kami ucapkan "
                "terima kasih.",
                styles["BodyLetter"]
            ),

            Spacer(1, 12 * mm),
        ]

    return [
        Paragraph(
            "Saya yang bertanda tangan di bawah ini Direktur Kampus Universitas "
            "Pendidikan Indonesia (UPI) di Serang menerangkan bahwa:",
            styles["BodyLetter"]
        ),

        Spacer(1, 1 * mm),

        identity,

        Spacer(1, 3 * mm),

        Paragraph(
            "Adalah benar terdaftar sebagai mahasiswa aktif pada Program S1 "
            "PGSD Kampus UPI di Serang.",
            styles["BodyLetter"]
        ),

        Spacer(1, 3 * mm),

        Paragraph(
            "Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.",
            styles["BodyLetter"]
        ),

        Spacer(1, 12 * mm),
    ]


SIGNATURE_PROFILES = {
    "surat_a": {
        "title": (
            "a.n. Direktur<br/>"
            "u.b. Wakil Direktur<br/>"
            "Bidang Pendidikan,<br/>"
            "Kemahasiswaan dan Penjaminan Mutu,<br/>"
            "Kaprodi PGSD"
        ),
        # "pejabat" dipakai di dalam QR (lengkap dengan gelar),
        # "pejabat_cetak" dipakai pada blok tanda tangan surat:
        # nama saja, tanpa gelar.
        # Surat A ditandatangani oleh Kaprodi PGSD atas nama Direktur
        # melalui Wakil Direktur.
        "pejabat": "Dr. Andika Arisetyawan, M.Si",
        "pejabat_cetak": "Andika Arisetyawan",
        "nip": "NIP. 198103272005021003",
        # Blok tanda tangan surat A: tanpa NIP dan tanpa kota.
        "show_nip": False,
        "show_kota": False,
        "signature_file": "ttd.png",
        "stamp_file": None,
        "signature_size": (30, 21),
        "signature_thin": 1,
    },

    "surat_b": {
        "title": (
            "a.n. Wakil Direktur Kemahasiswaan dan<br/>"
            "Penjaminan Mutu,<br/>"
            "Kaprodi PGSD"
        ),
        "pejabat": "Dr. Andika Arisetyawan, M.Si",
        "pejabat_cetak": "Andika Arisetyawan",
        "nip": "NIP. 198103272005021003",
        # Blok tanda tangan surat B: tanpa NIP dan tanpa kota.
        "show_nip": False,
        "show_kota": False,
        "signature_file": "ttd.png",
        "stamp_file": "cap1.png",
        "signature_size": (30, 21),
        "signature_thin": 1,
    },
}


def get_signature_profile(layanan):
    return SIGNATURE_PROFILES.get(
        layanan,
        SIGNATURE_PROFILES["surat_a"]
    )




class DigitalSignatureBlock(Flowable):
    """Tanda tangan elektronik berbentuk QR pada kolom tanda tangan.

    Kolom tanda tangan hanya memuat QR ini, tanpa keterangan apa pun
    di sekelilingnya. Seluruh keterangan justru berada DI DALAM QR:
    saat dipindai, yang muncul adalah teks identitas penandatangan
    beserta kode, waktu, dan hash otorisasinya.

    Panel menempati satu baris tabel tersendiri di antara baris
    jabatan dan baris nama, jadi tidak pernah menimpa keduanya, dan
    diletakkan rata tengah terhadap kolom tanda tangan.
    """

    QR_SIZE = 30 * mm

    GAP = 3 * mm

    def __init__(
        self,
        pejabat,
        kode="",
        waktu="",
        hash_otorisasi="",
        width=72 * mm
    ):
        super().__init__()

        self.pejabat = clean(pejabat, "")
        self.kode = clean(kode, "")
        self.waktu = clean(waktu, "")
        self.hash_otorisasi = clean(hash_otorisasi, "")

        self.width = width

        self.height = self.QR_SIZE + 2 * self.GAP

    def qr_payload(self):
        """Teks yang muncul ketika QR dipindai."""

        baris = [
            "TANDA TANGAN ELEKTRONIK",
            "Ditandatangani secara elektronik oleh:",
        ]

        if self.pejabat:
            baris.append(self.pejabat)

        if self.kode:
            baris.append(f"Kode Verifikasi: {self.kode}")

        if self.waktu:
            baris.append(f"Waktu Otorisasi: {self.waktu}")

        if self.hash_otorisasi:
            baris.append(f"Hash: {self.hash_otorisasi}")

        return "\n".join(baris)

    def draw_qr(self, x, y, size, border=4, skala=10):
        """Gambar QR sebagai citra bitmap dengan modul seragam.

        QR versi vektor bawaan reportlab menghasilkan modul yang
        ukurannya tidak persis sama setelah diskalakan, sehingga
        pembacaannya sering gagal pada resolusi pindai tertentu. Di
        sini matriks QR-nya dirender sendiri: tiap modul menjadi blok
        piksel berukuran identik, ditambah zona sunyi putih di
        sekelilingnya, lalu ditempel sebagai gambar.
        """

        from PIL import Image as PILImage
        from reportlab.graphics.barcode.qr import QrCodeWidget
        from reportlab.lib.utils import ImageReader

        widget = QrCodeWidget(
            self.qr_payload(),
            barLevel="M"
        )

        # memaksa proses penyandian agar matriksnya terbentuk
        widget.getBounds()

        matrix = widget.qr

        jumlah = matrix.getModuleCount()

        sisi = jumlah + 2 * border

        gambar = PILImage.new(
            "L",
            (sisi, sisi),
            255
        )

        piksel = gambar.load()

        for baris in range(jumlah):
            for kolom in range(jumlah):
                if matrix.isDark(baris, kolom):
                    piksel[
                        kolom + border,
                        baris + border
                    ] = 0

        gambar = gambar.resize(
            (sisi * skala, sisi * skala),
            PILImage.NEAREST
        )

        self.canv.drawImage(
            ImageReader(gambar),
            x,
            y,
            width=size,
            height=size
        )

    def draw(self):
        self.draw_qr(
            (self.width - self.QR_SIZE) / 2,
            self.GAP,
            self.QR_SIZE
        )


def make_verification_footer(data):
    """Footer keaslian di pojok kiri bawah.

    Digambar langsung ke canvas supaya posisinya tetap di dasar
    halaman, tidak ikut mengalir bersama isi surat.
    """

    kode = clean(data.get("verifikasi_kode"), "")
    hash_otorisasi = clean(data.get("verifikasi_hash"), "")
    waktu = clean(data.get("verifikasi_waktu"), "")

    if not kode and not hash_otorisasi:
        return None

    baris = [
        (
            "Times-Italic",
            6.5,
            "Dokumen ini diterbitkan dan diotorisasi secara elektronik "
            "melalui Sistem Layanan Surat Mahasiswa PGSD Kampus UPI di Serang."
        ),
    ]

    identitas = f"Kode Verifikasi: {kode}" if kode else ""

    if waktu:
        identitas = (
            f"{identitas}    |    Waktu Otorisasi: {waktu}"
            if identitas
            else f"Waktu Otorisasi: {waktu}"
        )

    if identitas:
        baris.append(("Times-Bold", 6.5, identitas))

    if hash_otorisasi:
        baris.append(
            ("Courier", 6.2, f"Hash Otorisasi: {hash_otorisasi}")
        )

    def draw(canvas, doc):
        canvas.saveState()

        canvas.setStrokeColor(colors.HexColor("#7f7f7f"))
        canvas.setLineWidth(0.4)

        garis_y = doc.bottomMargin - 4 * mm

        canvas.line(
            doc.leftMargin,
            garis_y,
            doc.leftMargin + doc.width,
            garis_y
        )

        canvas.setFillColor(colors.HexColor("#3f3f3f"))

        y = garis_y - 6

        for font_name, font_size, teks in baris:
            canvas.setFont(font_name, font_size)

            canvas.drawString(
                doc.leftMargin,
                y,
                teks
            )

            y -= font_size + 2.2

        canvas.restoreState()

    return draw


def build_pdf(
    data,
    output,
    logo_path,
    signature_path=None
):
    styles = make_styles()

    doc = SimpleDocTemplate(
        str(output),
        pagesize=A4,
        leftMargin=22 * mm,
        rightMargin=22 * mm,
        topMargin=18 * mm,
        bottomMargin=20 * mm,
        title="Surat Keterangan Aktif Kuliah",
        author="UPI Serang",
    )

    story = []

    build_letterhead(
        story,
        styles,
        logo_path,
        doc.width
    )

    story.append(
        Spacer(1, 10 * mm)
    )

    layanan = data.get(
        "layanan",
        "surat_a"
    )

    story.append(
        Paragraph(
            get_letter_title(layanan),
            styles["TitleLetter"]
        )
    )

    story.append(
        Paragraph(
            f"Nomor: {data['nomor']}",
            styles["Number"]
        )
    )

    story.append(
        Spacer(1, 8 * mm)
    )

    identity = Table(
        [
            [
                "Nama",
                ":",
                Paragraph(
                    data["nama"],
                    styles["BodyLeft"]
                )
            ],

            [
                "NIM",
                ":",
                Paragraph(
                    data["nim"],
                    styles["BodyLeft"]
                )
            ],

            [
                "Semester",
                ":",
                Paragraph(
                    data["semester"],
                    styles["BodyLeft"]
                )
            ],
        ],

        colWidths=[
            28 * mm,
            4 * mm,
            doc.width - 42 * mm
        ],

        hAlign="LEFT",
    )

    identity.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (1, -1), "Times-Roman"),
                ("FONTSIZE", (0, 0), (-1, -1), 12),
                ("LEADING", (0, 0), (-1, -1), 16),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 1),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
            ]
        )
    )

    # Surat B berkelompok: blok identitas diganti tabel daftar
    # mahasiswa. Surat B perorangan dan surat A tidak berubah.
    anggota = get_anggota(data)

    if layanan == "surat_b" and len(anggota) > 1:

        identity = build_group_table(
            anggota,
            styles,
            doc.width
        )

    story.extend(
        build_body_story(
            data,
            layanan,
            styles,
            identity
        )
    )

    profile = get_signature_profile(layanan)

    signature_title = profile["title"]

    # Nama lengkap bergelar: dipakai sebagai isi QR.
    pejabat = (
        clean(data.get("pejabat"), "")
        or profile["pejabat"]
    )

    # Nama yang dicetak di blok tanda tangan: nama saja, tanpa gelar.
    pejabat_cetak = (
        clean(data.get("pejabat_cetak"), "")
        or profile.get("pejabat_cetak")
        or pejabat
    )

    nip = (
        clean(data.get("nip"), "")
        or profile["nip"]
    )

    if signature_path is None:
        signature_path = BASE_DIR / profile["signature_file"]

    signature_lines = [
        [
            "",
            Paragraph(
                data["tanggal"],
                styles["BodyLeft"]
            )
        ],

        [
            "",
            Paragraph(
                signature_title,
                styles["BodyLeft"]
            )
            
        ],

        [
            "",
            DigitalSignatureBlock(
                pejabat,
                data.get("verifikasi_kode"),
                data.get("verifikasi_waktu"),
                data.get("verifikasi_hash"),
                72 * mm
            )
        ],

        [
            "",
            Paragraph(
                f"<b>{pejabat_cetak}</b>",
                styles["BodyLeft"]
            )
        ],

    ]

    if profile.get("show_nip", True):

        signature_lines.append(
            [
                "",
                Paragraph(
                    nip,
                    styles["BodyLeft"]
                )
            ]
        )

    signature = Table(
        signature_lines,

        colWidths=[
            doc.width - 72 * mm,
            72 * mm
        ],

        hAlign="LEFT",
    )

    signature.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    story.append(
        KeepTogether(signature)
    )

    # ====================================
    # QR WEBSITE PGSD UPI SERANG
    # ====================================

    qr_path = BASE_DIR / "URL QR Code.png"

    if qr_path.exists():

        qr_image = Image(
            str(qr_path),
            width=18 * mm,
            height=18 * mm,
            kind="proportional"
        )

        qr_table = Table(
            [[qr_image]],
            colWidths=[20 * mm],
            hAlign="LEFT"
        )

        qr_table.setStyle(
            TableStyle(
                [
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )

        story.append(
            Spacer(1, 6 * mm)
        )

        story.append(qr_table)

    footer = make_verification_footer(data)

    if footer:
        doc.build(
            story,
            onFirstPage=footer,
            onLaterPages=footer
        )
    else:
        doc.build(story)


def parse_args():
    parser = argparse.ArgumentParser()

    parser.add_argument("--data")
    parser.add_argument("--output")
    parser.add_argument("--logo")
    parser.add_argument("--signature-path")

    parser.add_argument("--nomor")
    parser.add_argument("--nama")
    parser.add_argument("--nim")
    parser.add_argument("--semester")
    parser.add_argument("--keperluan")
    parser.add_argument("--tanggal")
    parser.add_argument("--jabatan")
    parser.add_argument("--pejabat")
    parser.add_argument("--nip")

    return parser.parse_args()


def main():
    args = parse_args()

    data = load_payload(args)

    output = Path(
        args.output
        or "surat.pdf"
    )

    if not output.is_absolute():
        output = BASE_DIR / output

    logo_path = Path(
        args.logo
        or "logo-upi.png"
    )

    if not logo_path.is_absolute():
        logo_path = BASE_DIR / logo_path

    signature_path = (
        Path(args.signature_path)
        if args.signature_path
        else None
    )

    build_pdf(
        data,
        output,
        logo_path,
        signature_path=signature_path
    )

    print(output)


if __name__ == "__main__":
    main()
