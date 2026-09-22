from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
    Flowable,
)


OUT = "output/pdf/คู่มือการใช้งานสำหรับอาจารย์_ระบบบันทึกการฝึกปฏิบัติงาน.pdf"
FONT = "/Library/Fonts/Arial Unicode.ttf"
pdfmetrics.registerFont(TTFont("Thai", FONT))

WINE = colors.HexColor("#155426")
WINE_DARK = colors.HexColor("#0A3C17")
PINK = colors.HexColor("#A376B4")
PINK_PALE = colors.HexColor("#F5EFF8")
INK = colors.HexColor("#202124")
MUTED = colors.HexColor("#687078")
LINE = colors.HexColor("#DDE1E5")
SOFT = colors.HexColor("#F6F7F8")
GREEN_SOFT = colors.HexColor("#EDF8F3")
AMBER = colors.HexColor("#FFF4D9")
RED_SOFT = colors.HexColor("#FFF0F0")
RED = colors.HexColor("#A22A2A")


styles = getSampleStyleSheet()


def style(name, **kwargs):
    defaults = dict(fontName="Thai", wordWrap="CJK")
    defaults.update(kwargs)
    styles.add(ParagraphStyle(name=name, **defaults))


style("CoverTitle", fontSize=25, leading=34, textColor=WINE, alignment=TA_CENTER, spaceAfter=10)
style("CoverSub", fontSize=12.5, leading=20, textColor=MUTED, alignment=TA_CENTER)
style("H1Thai", fontSize=18, leading=25, textColor=WINE, spaceBefore=5, spaceAfter=9, keepWithNext=True)
style("H2Thai", fontSize=14, leading=20, textColor=WINE_DARK, spaceBefore=9, spaceAfter=6, keepWithNext=True)
style("BodyThai", fontSize=10.5, leading=17, textColor=INK, spaceAfter=6)
style("SmallThai", fontSize=8.8, leading=13.5, textColor=MUTED)
style("StepThai", fontSize=10.5, leading=17, leftIndent=18, firstLineIndent=-18, textColor=INK, spaceAfter=5)
style("CalloutThai", fontSize=10.3, leading=16, textColor=INK, leftIndent=8, rightIndent=8, spaceBefore=3, spaceAfter=3)
style("CaptionThai", fontSize=8.8, leading=13, textColor=MUTED, alignment=TA_CENTER, spaceBefore=5, spaceAfter=8)
style("TOCThai", fontSize=10.3, leading=17, leftIndent=10, firstLineIndent=-10, textColor=INK, spaceAfter=4)


def p(text, sty="BodyThai"):
    return Paragraph(text, styles[sty])


def callout(title, text, fill=GREEN_SOFT, border=LINE):
    box = Table([[p(f"<b>{title}</b><br/>{text}", "CalloutThai")]], colWidths=[17.6 * cm], hAlign="LEFT")
    box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), fill),
        ("BOX", (0, 0), (-1, -1), 0.55, border),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return box


def steps(items):
    return [p(f"<b>{i}.</b> {text}", "StepThai") for i, text in enumerate(items, 1)]


def info_table(rows, widths):
    converted = []
    for r, row in enumerate(rows):
        converted.append([p(cell, "SmallThai") for cell in row])
    t = Table(converted, colWidths=widths, repeatRows=1, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), WINE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Thai"),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
    ]))
    return t


def draw_breast_mark(canvas, x, y, scale=1):
    canvas.saveState()
    canvas.setStrokeColor(PINK)
    canvas.setLineWidth(3 * scale)
    canvas.circle(x, y, 34 * scale, stroke=1, fill=0)
    canvas.setStrokeColor(colors.HexColor("#D64173"))
    canvas.setLineWidth(2.6 * scale)
    canvas.bezier(x - 4 * scale, y + 18 * scale, x - 17 * scale, y + 27 * scale, x - 15 * scale, y - 5 * scale, x - 4 * scale, y - 12 * scale)
    canvas.bezier(x + 4 * scale, y + 18 * scale, x + 17 * scale, y + 27 * scale, x + 15 * scale, y - 5 * scale, x + 4 * scale, y - 12 * scale)
    canvas.bezier(x, y - 12 * scale, x - 4 * scale, y - 22 * scale, x - 19 * scale, y - 23 * scale, x - 23 * scale, y - 13 * scale)
    canvas.bezier(x, y - 12 * scale, x + 4 * scale, y - 22 * scale, x + 19 * scale, y - 23 * scale, x + 23 * scale, y - 13 * scale)
    canvas.restoreState()


class Screen(Flowable):
    """Clean, privacy-safe schematic of the current web app screen."""

    def __init__(self, kind="login", width=17.6 * cm, height=6.8 * cm):
        super().__init__()
        self.kind = kind
        self.width = width
        self.height = height

    def wrap(self, availWidth, availHeight):
        self.width = min(self.width, availWidth)
        return self.width, self.height

    def txt(self, c, x, y, text, size=7, color=INK, bold=False):
        c.setFont("Thai", size)
        c.setFillColor(color)
        c.drawString(x, y, text)

    def box(self, c, x, y, w, h, fill=colors.white, stroke=LINE, radius=6):
        c.setFillColor(fill)
        c.setStrokeColor(stroke)
        c.setLineWidth(0.7)
        c.roundRect(x, y, w, h, radius, fill=1, stroke=1)

    def button(self, c, x, y, w, h, label, fill=WINE, color=colors.white):
        self.box(c, x, y, w, h, fill=fill, stroke=fill, radius=5)
        c.setFont("Thai", 7.4)
        c.setFillColor(color)
        c.drawCentredString(x + w / 2, y + h / 2 - 2.4, label)

    def header(self, c, x, y, w, title):
        c.setFillColor(colors.white)
        c.setStrokeColor(LINE)
        c.rect(x, y, w, 35, fill=1, stroke=1)
        draw_breast_mark(c, x + 25, y + 18, 0.38)
        self.txt(c, x + 50, y + 22, title, 8, WINE)
        self.txt(c, x + 50, y + 10, "ระบบบันทึกการฝึกปฏิบัติงานนักศึกษาแพทย์", 5.8, MUTED)
        self.txt(c, x + w - 90, y + 17, "อาจารย์ผู้ใช้งาน  ▾", 6.2, INK)

    def draw(self):
        c = self.canv
        x0, y0 = 0, 0
        self.box(c, x0, y0, self.width, self.height, fill=colors.white, stroke=LINE, radius=8)
        if self.kind == "login":
            draw_breast_mark(c, 105, self.height - 62, 1.1)
            self.txt(c, 37, self.height - 101, "ระบบบันทึกการฝึกปฏิบัติงาน", 12, WINE)
            self.txt(c, 43, self.height - 119, "ศัลยศาสตร์เต้านม", 8.5, INK)
            c.setStrokeColor(WINE); c.setLineWidth(1.2); c.line(37, self.height - 132, 195, self.height - 132)
            self.txt(c, 43, self.height - 154, "บันทึก ติดตาม และรับรองผลการฝึก", 6.5, MUTED)
            px = self.width * 0.53
            self.box(c, px, 20, self.width * 0.4, self.height - 40, fill=colors.white, stroke=LINE, radius=8)
            self.txt(c, px + 18, self.height - 49, "เข้าสู่ระบบ", 12, WINE)
            self.txt(c, px + 18, self.height - 68, "บทบาทผู้ใช้งาน", 6.7, INK)
            self.box(c, px + 17, self.height - 99, 75, 22, fill=PINK_PALE, stroke=WINE, radius=4)
            self.txt(c, px + 35, self.height - 90, "อาจารย์", 7.2, WINE)
            self.box(c, px + 99, self.height - 99, 75, 22, fill=colors.white, stroke=LINE, radius=4)
            self.txt(c, px + 122, self.height - 90, "นักศึกษา", 7.2, INK)
            self.txt(c, px + 18, self.height - 118, "อีเมล", 6.5, INK)
            self.txt(c, px + 102, self.height - 118, "รหัสผ่าน", 6.5, INK)
            self.box(c, px + 17, self.height - 144, 75, 19, fill=colors.white, stroke=LINE, radius=4)
            self.txt(c, px + 25, self.height - 137, "อีเมลของท่าน", 5.7, MUTED)
            self.box(c, px + 99, self.height - 144, 75, 19, fill=colors.white, stroke=LINE, radius=4)
            self.txt(c, px + 107, self.height - 137, "รหัสผ่าน", 5.7, MUTED)
            self.button(c, px + 17, 17, self.width * .33, 22, "เข้าสู่ระบบ")
        elif self.kind == "dashboard":
            self.header(c, 0, self.height - 35, self.width, "ระบบติดตามและรับรองสมุดบันทึกนักศึกษา")
            self.txt(c, 18, self.height - 59, "ภาพรวมสมุดบันทึกนักศึกษา", 11, INK)
            self.txt(c, 18, self.height - 72, "ติดตามความครบถ้วนและรายการรออนุมัติ", 6.6, MUTED)
            self.button(c, self.width - 104, self.height - 74, 84, 22, "ตรวจรายการ")
            card_w = (self.width - 54) / 4
            for i, (lab, val) in enumerate([("นักศึกษาที่ดูแล", "12"), ("อนุมัติแล้ว", "86"), ("รออนุมัติ", "9"), ("ควรติดตาม", "2")]):
                xx = 18 + i * (card_w + 6)
                self.box(c, xx, self.height - 126, card_w, 37, fill=colors.white, stroke=LINE, radius=5)
                self.txt(c, xx + 8, self.height - 103, lab, 5.8, MUTED)
                self.txt(c, xx + 8, self.height - 119, val, 13, WINE)
            self.box(c, 18, 15, self.width - 36, 49, fill=colors.white, stroke=LINE, radius=6)
            self.txt(c, 30, 53, "นักศึกษาที่ต้องติดตาม", 7.5, WINE)
            self.txt(c, 30, 42, "กรองสถานะการอนุมัติ", 5.8, MUTED)
            self.box(c, 30, 25, 122, 13, fill=SOFT, stroke=LINE, radius=3)
            self.txt(c, 38, 29, "มีรายการรอฉันอนุมัติ ▾", 5.5, INK)
            self.txt(c, 178, 42, "กำลังดูข้อมูลนักศึกษา", 5.8, MUTED)
            self.box(c, 178, 25, 154, 13, fill=SOFT, stroke=LINE, radius=3)
            self.txt(c, 186, 29, "กลุ่ม 1 · รหัสนักศึกษา · ชื่อ ▾", 5.5, INK)
            self.txt(c, 30, 19, "ความก้าวหน้าเฉลี่ย 78% · ค้างเกิน 48 ชั่วโมง 3 รายการ", 5.8, MUTED)
            self.txt(c, self.width - 103, 19, "ดูรายละเอียด →", 5.8, WINE)
        elif self.kind == "review":
            self.header(c, 0, self.height - 35, self.width, "ระบบติดตามและรับรองสมุดบันทึกนักศึกษา")
            self.txt(c, 18, self.height - 59, "ตรวจและอนุมัติรายการ", 11, INK)
            self.button(c, self.width - 92, self.height - 74, 72, 22, "สแกนคิวอาร์", fill=PINK)
            left_w = self.width * .31
            self.box(c, 18, 18, left_w, self.height - 105, fill=SOFT, stroke=LINE, radius=6)
            self.txt(c, 30, self.height - 92, "เลือกนักศึกษา", 7.5, WINE)
            self.box(c, 30, self.height - 120, left_w - 24, 17, fill=colors.white, stroke=LINE, radius=3)
            self.txt(c, 37, self.height - 114, "ชื่อหรือรหัสนักศึกษา", 5.5, MUTED)
            for i, name in enumerate(["นศพ. พิมพ์ชนก", "นศพ. ธนภัทร", "นศพ. ชนาภา"]):
                yy = self.height - 149 - i * 25
                self.box(c, 30, yy, left_w - 24, 20, fill=PINK_PALE if i == 0 else colors.white, stroke=WINE if i == 0 else LINE, radius=3)
                self.txt(c, 38, yy + 8, name, 6.3, WINE if i == 0 else INK)
            rx = left_w + 33
            self.box(c, rx, self.height - 93, self.width - rx - 18, 28, fill=PINK_PALE, stroke=LINE, radius=6)
            self.txt(c, rx + 11, self.height - 77, "นศพ. พิมพ์ชนก ใจดี", 8, WINE)
            self.txt(c, rx + 11, self.height - 88, "รหัสนักศึกษา · ชั้นปี · ปีการศึกษา", 5.8, MUTED)
            card_y, card_h = 14, self.height - 111
            card_top = card_y + card_h
            self.box(c, rx, card_y, self.width - rx - 18, card_h, fill=colors.white, stroke=LINE, radius=6)
            self.txt(c, rx + 12, card_top - 16, "รายการรออนุมัติ", 7.8, WINE)
            self.txt(c, rx + 12, card_top - 29, "กิจกรรมห้องผ่าตัด · วันที่บันทึก", 6.3, MUTED)
            for i, (lab, val) in enumerate([("รหัสเคส", "เคส ••1042"), ("ขั้นตอน", "ขั้นตอนการผ่าตัด")]):
                yy = card_top - 43 - i * 13
                self.txt(c, rx + 12, yy, lab, 5.5, MUTED)
                self.txt(c, rx + 75, yy, val, 6, INK)
            self.button(c, rx + 12, 22, 72, 15, "ส่งกลับแก้ไข", fill=RED, color=colors.white)
            self.button(c, self.width - 93, 22, 75, 15, "ยืนยันอนุมัติ", fill=WINE, color=colors.white)


class FlowDiagram(Flowable):
    def __init__(self, width=17.6 * cm, height=3.3 * cm):
        super().__init__()
        self.width, self.height = width, height

    def wrap(self, availWidth, availHeight):
        self.width = min(self.width, availWidth)
        return self.width, self.height

    def draw(self):
        c = self.canv
        steps_data = [
            ("1", "นักศึกษาส่งรายการ", PINK_PALE),
            ("2", "อาจารย์ค้นหาหรือสแกน", colors.HexColor("#EEF5FF")),
            ("3", "ตรวจรายละเอียด", AMBER),
            ("4", "อนุมัติหรือส่งกลับ", GREEN_SOFT),
        ]
        gap = 10
        bw = (self.width - gap * 3) / 4
        for i, (num, label, fill) in enumerate(steps_data):
            x = i * (bw + gap)
            c.setFillColor(fill); c.setStrokeColor(LINE); c.setLineWidth(.7)
            c.roundRect(x, 14, bw, self.height - 28, 8, fill=1, stroke=1)
            c.setFillColor(WINE); c.circle(x + 20, self.height - 25, 10, fill=1, stroke=0)
            c.setFillColor(colors.white); c.setFont("Thai", 8); c.drawCentredString(x + 20, self.height - 28, num)
            c.setFillColor(INK); c.setFont("Thai", 7.2)
            c.drawCentredString(x + bw / 2, self.height - 47, label)
            if i < 3:
                c.setStrokeColor(WINE); c.setLineWidth(1.2)
                c.line(x + bw + 2, self.height / 2, x + bw + gap - 2, self.height / 2)
                c.line(x + bw + gap - 5, self.height / 2 + 3, x + bw + gap - 2, self.height / 2)
                c.line(x + bw + gap - 5, self.height / 2 - 3, x + bw + gap - 2, self.height / 2)


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(.5)
    canvas.line(1.55 * cm, 1.35 * cm, 19.45 * cm, 1.35 * cm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Thai", 7.8)
    canvas.drawString(1.55 * cm, .88 * cm, "คู่มือการใช้งานสำหรับอาจารย์ · ระบบบันทึกการฝึกปฏิบัติงาน")
    canvas.drawRightString(19.45 * cm, .88 * cm, f"หน้า {doc.page}")
    canvas.restoreState()


story = []

# ปก
story += [Spacer(1, 1.25 * cm)]
cover = Table([["", ""]], colWidths=[5.3 * cm, 12.3 * cm], rowHeights=[4.6 * cm])
cover.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (0, 0), WINE),
    ("BACKGROUND", (1, 0), (1, 0), PINK_PALE),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
]))
def draw_cover(canvas, doc):
    footer(canvas, doc)
    canvas.saveState()
    canvas.setFillColor(WINE)
    canvas.setFont("Thai", 9)
    canvas.drawCentredString(10.5 * cm, 18.8 * cm, "ภาควิชาศัลยศาสตร์")
    canvas.restoreState()

story += [Spacer(1, 1.6 * cm), p("คู่มือการใช้งานสำหรับอาจารย์", "CoverTitle"), p("ระบบบันทึกการฝึกปฏิบัติงานนักศึกษาแพทย์", "CoverSub"), Spacer(1, .55 * cm)]
story.append(callout("สำหรับใคร", "คู่มือนี้จัดทำสำหรับอาจารย์ผู้ตรวจ อนุมัติ และติดตามความก้าวหน้าของนักศึกษาในระบบ", PINK_PALE))
story += [Spacer(1, .75 * cm), p("ฉบับภาษาไทย · ปรับปรุงวันที่ 27 สิงหาคม 2569", "CoverSub"), PageBreak()]

# สารบัญ / ภาพรวม
story += [p("ภาพรวมการใช้งาน", "H1Thai"), p("ระบบแบ่งงานของอาจารย์ออกเป็น 3 ส่วนหลัก คือ ดูภาพรวม ค้นหารายการของนักศึกษา และตรวจอนุมัติหรือส่งกลับแก้ไข ทุกการตัดสินใจจะถูกบันทึกไว้ในประวัติการดำเนินการของระบบ", "BodyThai"), FlowDiagram(), p("ภาพที่ 1  ลำดับการทำงานตั้งแต่ส่งรายการจนถึงการอนุมัติ", "CaptionThai")]
story += [p("เมนูที่อาจารย์ใช้", "H2Thai"), info_table([
    ["เมนู", "ใช้สำหรับ"],
    ["ภาพรวม", "ดูจำนวนรายการ ความก้าวหน้าของนักศึกษา รายการค้าง และกลุ่มที่ควรติดตาม"],
    ["ตรวจและอนุมัติ", "ค้นหานักศึกษา เปิดดูรายการที่ส่งมา ตรวจรายละเอียด แล้วอนุมัติหรือส่งกลับแก้ไข"],
    ["เมนูชื่อผู้ใช้", "เปลี่ยนรหัสผ่านและออกจากระบบ"],
], [4.0 * cm, 13.6 * cm]), Spacer(1, .35 * cm), callout("หลักการสำคัญ", "รายการจะปรากฏให้อาจารย์อนุมัติเฉพาะเมื่อเป็นรายการที่นักศึกษาเลือกอาจารย์ท่านนั้นเป็นผู้อนุมัติ", AMBER)]
story += [PageBreak()]

# เข้าสู่ระบบ
story += [p("1. เข้าสู่ระบบในบทบาทอาจารย์", "H1Thai"), p("ใช้บัญชีอีเมลที่ภาควิชาอนุมัติไว้ หากเป็นการใช้งานครั้งแรก ให้เปิดใช้งานบัญชีจากหน้าเข้าสู่ระบบก่อน แล้วจึงกลับเข้าสู่ระบบตามปกติ", "BodyThai"), Screen("login"), p("ภาพที่ 2  ภาพประกอบหน้าจอเข้าสู่ระบบสำหรับอาจารย์", "CaptionThai")]
story += steps([
    "เปิดหน้าเข้าสู่ระบบ แล้วเลือกบทบาท <b>อาจารย์</b>",
    "กรอกอีเมลและรหัสผ่านของบัญชีที่ได้รับอนุมัติ",
    "กด <b>เข้าสู่ระบบ</b> และรอให้ระบบเชื่อมต่อฐานข้อมูลเสร็จ",
    "ตรวจชื่อของตนเองที่มุมขวาบนก่อนเริ่มตรวจรายการ",
])
story += [p("การเปิดใช้งานครั้งแรก", "H2Thai"), p("กดข้อความสำหรับผู้ที่เข้าใช้งานครั้งแรก แล้วเลือกบทบาทอาจารย์ กรอกอีเมลที่อยู่ในรายชื่อที่ภาควิชาอนุมัติ ตั้งรหัสผ่านอย่างน้อย 8 ตัวอักษร และยืนยันอีเมลจากจดหมายที่ระบบส่งให้", "BodyThai"), callout("หากเปิดใช้งานไม่ได้", "ตรวจว่าใช้อีเมลตรงกับรายชื่อที่ภาควิชาอนุมัติแล้ว และตรวจกล่องจดหมายขยะ หากยังไม่ได้รับจดหมาย ให้ติดต่อผู้ดูแลระบบ", RED_SOFT, colors.HexColor("#EFC5C5"))]
story += [PageBreak()]

# ภาพรวม
story += [p("2. อ่านหน้าภาพรวมและเลือกนักศึกษา", "H1Thai"), p("หน้าภาพรวมใช้สำหรับติดตามสถานะทั้งกลุ่ม โดยข้อมูลที่คำนวณความก้าวหน้าจะนับเฉพาะรายการที่อาจารย์อนุมัติแล้ว", "BodyThai"), Screen("dashboard"), p("ภาพที่ 3  ภาพประกอบหน้าภาพรวมสำหรับอาจารย์", "CaptionThai")]
story += [p("ขั้นตอนแนะนำ", "H2Thai")]
story += steps([
    "ดูแถบสรุปจำนวนรายการ อนุมัติแล้ว รออนุมัติ และนักศึกษาที่ควรติดตาม",
    "ใช้ตัวกรองสถานะการอนุมัติ เพื่อแสดงนักศึกษาที่มีรายการรออาจารย์ท่านนี้อนุมัติ",
    "เลือกชื่อนักศึกษาที่ต้องการติดตามจากรายการนักศึกษา",
    "อ่านตารางนักศึกษาที่ต้องติดตาม โดยดูความก้าวหน้า รายการค้าง และรายการที่ถูกส่งกลับ",
    "หากต้องการตัดสินใจต่อรายการ ให้กดปุ่มตรวจรายการเพื่อไปยังเมนูตรวจและอนุมัติ",
])
story += [p("ความหมายของตัวชี้วัด", "H2Thai"), info_table([
    ["ตัวชี้วัด", "ความหมาย"],
    ["ความก้าวหน้า", "จำนวนรายการที่อนุมัติแล้วเทียบกับเป้าหมายของหลักสูตร"],
    ["รออนุมัติ", "รายการที่นักศึกษาส่งมาแล้ว และเลือกอาจารย์ท่านนี้เป็นผู้อนุมัติ"],
    ["ค้างเกิน 48 ชั่วโมง", "รายการที่ส่งมาแล้วเกิน 48 ชั่วโมงโดยยังไม่มีผลอนุมัติ"],
    ["ข้อมูลผิดปกติ", "รายการที่ระบบตรวจพบความไม่สอดคล้อง เช่น วันที่อยู่นอกช่วงการฝึก"],
], [5.0 * cm, 12.6 * cm])]
story += [PageBreak()]

# ตรวจรายการ
story += [p("3. ค้นหาและเปิดรายการของนักศึกษา", "H1Thai"), p("เมนูตรวจและอนุมัติจะแสดงเฉพาะรายการที่นักศึกษาส่งให้อาจารย์ท่านนี้ การเลือกนักศึกษาทำได้ 2 วิธี คือค้นหาจากชื่อหรือรหัส หรือสแกนคิวอาร์ของนักศึกษา", "BodyThai"), Screen("review"), p("ภาพที่ 4  ภาพประกอบหน้าตรวจและอนุมัติรายการ", "CaptionThai")]
story += [p("ค้นหาด้วยชื่อหรือรหัส", "H2Thai")]
story += steps([
    "เปิดเมนูตรวจและอนุมัติ",
    "พิมพ์ชื่อหรือรหัสนักศึกษาในช่องค้นหา",
    "ตรวจชื่อและรหัสนักศึกษาในแถบข้อมูลด้านขวาให้ตรงกับผู้ที่อยู่ตรงหน้า",
    "เลือกหมวดกิจกรรม หากต้องการดูเฉพาะรายการบางประเภท",
    "เปิดอ่านรายการที่มีสถานะรออนุมัติ",
])
story += [p("ค้นหาด้วยคิวอาร์", "H2Thai")]
story += steps([
    "กดปุ่มสแกนคิวอาร์ และอนุญาตให้เว็บใช้กล้องเมื่อเบราว์เซอร์ถาม",
    "ให้นักศึกษาแสดงคิวอาร์ของตนเอง แล้ววางไว้ในกรอบสแกน",
    "เมื่อพบข้อมูล ให้ตรวจยืนยันชื่อและรหัสก่อนเปิดรายการ",
    "หากใช้กล้องไม่ได้ ให้ปิดการสแกน แล้วใช้ช่องค้นหาด้วยชื่อหรือรหัสแทน",
])
story += [PageBreak()]

# อนุมัติ / ส่งกลับ
story += [p("4. ตรวจรายละเอียดและตัดสินใจ", "H1Thai"), p("อ่านข้อมูลในบัตรรายการให้ครบก่อนตัดสินใจ โดยเฉพาะรหัสเคส การวินิจฉัยหรือประสบการณ์ ขั้นตอนที่ทำ และรายละเอียดสิ่งที่นักศึกษาได้ปฏิบัติหรือเรียนรู้", "BodyThai"), p("เกณฑ์ตรวจแบบสั้น", "H2Thai"), info_table([
    ["ตรวจอะไร", "คำถามที่ควรตอบก่อนอนุมัติ"],
    ["ตัวตนและผู้ส่ง", "เป็นนักศึกษาคนเดียวกับชื่อและรหัสที่แสดงหรือไม่"],
    ["กิจกรรมและวันที่", "กิจกรรมตรงกับช่วงและบริบทการฝึกหรือไม่"],
    ["รายละเอียด", "ข้อมูลเพียงพอให้ยืนยันการมีส่วนร่วมของนักศึกษาหรือไม่"],
    ["ข้อมูลส่วนบุคคล", "ไม่มีชื่อผู้ป่วย เลขบัตรประชาชน หรือข้อมูลที่ระบุตัวบุคคลได้หรือไม่"],
], [5.0 * cm, 12.6 * cm]), Spacer(1, .25 * cm), callout("เมื่ออนุมัติ", "กดปุ่มยืนยันอนุมัติ ระบบจะเปลี่ยนสถานะเป็นอนุมัติแล้ว และบันทึกวันเวลาและผู้อนุมัติไว้ในประวัติ", GREEN_SOFT), Spacer(1, .2 * cm), callout("เมื่อส่งกลับแก้ไข", "พิมพ์เหตุผลหรือข้อเสนอแนะในช่องความคิดเห็นก่อนกดส่งกลับแก้ไข เหตุผลนี้จะปรากฏให้นักศึกษาเห็นเพื่อแก้ไขและส่งใหม่", RED_SOFT, colors.HexColor("#EFC5C5"))]
story += [p("ผลหลังการตัดสินใจ", "H2Thai"), info_table([
    ["ผลลัพธ์", "สิ่งที่เกิดขึ้น"],
    ["อนุมัติแล้ว", "รายการถูกนำไปคำนวณความก้าวหน้า และไม่แสดงในคิวรออนุมัติของอาจารย์"],
    ["ส่งกลับแก้ไข", "รายการกลับไปให้นักศึกษาแก้ไข โดยต้องระบุเหตุผลทุกครั้ง"],
], [5.0 * cm, 12.6 * cm])]
story += [PageBreak()]

# รับรองปิดเล่ม
story += [p("5. รับรองและล็อกสมุดบันทึกฉบับสมบูรณ์", "H1Thai"), p("เมื่อความก้าวหน้าของนักศึกษาครบเกณฑ์ขั้นต่ำ และไม่มีรายการที่รออนุมัติหรือส่งกลับแก้ไข นักศึกษาจะส่งสมุดบันทึกฉบับสมบูรณ์ให้อาจารย์รับรอง", "BodyThai")]
story += [p("สิ่งที่อาจารย์ต้องตรวจ", "H2Thai")]
story += steps([
    "เลือกนักศึกษาคนที่มีคำขอรับรองสมุดบันทึกในหน้าตรวจและอนุมัติ",
    "อ่านสรุปจำนวนรายการที่อนุมัติแล้วและร้อยละความก้าวหน้า",
    "ตรวจว่าไม่มีรายการสถานะรออนุมัติหรือส่งกลับแก้ไขค้างอยู่",
    "หากข้อมูลครบ ให้กดรับรองสมุดบันทึก",
    "หากต้องแก้ไข ให้พิมพ์เหตุผลแล้วกดส่งกลับแก้ไข",
])
story += [callout("เมื่อรับรองแล้ว", "สมุดบันทึกจะถูกล็อก นักศึกษาจะไม่สามารถแก้ไขรายการในชุดนั้นได้ หากจำเป็นต้องแก้ไขภายหลัง ให้ติดต่อผู้ดูแลระบบเพื่อเปิดแก้ไขตามขั้นตอนของภาควิชา", AMBER)]
story += [p("กรณีที่กดรับรองไม่ได้", "H2Thai"), info_table([
    ["อาการ", "วิธีตรวจสอบ"],
    ["ปุ่มรับรองไม่พร้อมใช้งาน", "ตรวจร้อยละความก้าวหน้าและรายการค้างให้ครบตามเกณฑ์"],
    ["ยังมีรายการรออนุมัติ", "กลับไปตรวจรายการที่ค้างในคิว แล้วอนุมัติหรือส่งกลับพร้อมเหตุผล"],
    ["นักศึกษาไม่ปรากฏในคิว", "ตรวจว่านักศึกษาเลือกอาจารย์ท่านนี้เป็นผู้รับรอง และใช้หลักสูตรเดียวกัน"],
], [5.0 * cm, 12.6 * cm])]
story += [PageBreak()]

# ความเป็นส่วนตัวและแก้ปัญหา
story += [p("6. ความเป็นส่วนตัวและการแก้ปัญหาเบื้องต้น", "H1Thai"), p("ระบบออกแบบให้ใช้รหัสเคสหรือรหัสผู้ป่วยแบบปกปิดเพื่อการเรียนรู้ ห้ามคัดลอกข้อมูลระบุตัวบุคคลลงในรายการหรือความคิดเห็น", "BodyThai"), callout("ห้ามบันทึก", "ชื่อผู้ป่วย เลขบัตรประชาชน เบอร์โทรศัพท์ ที่อยู่ ภาพใบหน้า หรือข้อมูลใดที่ทำให้ระบุตัวผู้ป่วยได้", RED_SOFT, colors.HexColor("#EFC5C5")), callout("ควรใช้", "รหัสเคสหรือรหัสเอชเอ็นแบบปกปิด เช่น เคส ••1042 พร้อมรายละเอียดเชิงการเรียนรู้ที่ไม่ระบุตัวบุคคล", GREEN_SOFT)]
story += [p("แก้ปัญหาที่พบบ่อย", "H2Thai"), info_table([
    ["อาการ", "แนวทางแก้ไข"],
    ["ระบบแจ้งว่าเชื่อมต่อฐานข้อมูลไม่ได้", "รอสักครู่ ตรวจอินเทอร์เน็ต และรีเฟรชหน้า หากยังไม่หายให้แจ้งผู้ดูแลระบบ"],
    ["ไม่พบรายการที่ต้องอนุมัติ", "ตรวจตัวกรองสถานะ ชื่อผู้เรียน และอีเมลอาจารย์ผู้รับผิดชอบในรายการ"],
    ["สแกนคิวอาร์ไม่ได้", "อนุญาตการใช้กล้อง ตรวจแสงและระยะ หรือใช้ค้นหาด้วยชื่อและรหัสแทน"],
    ["ส่งกลับแก้ไขไม่ได้", "ต้องพิมพ์เหตุผลในช่องความคิดเห็นก่อนกดปุ่มส่งกลับแก้ไข"],
    ["ลืมรหัสผ่าน", "กดลืมรหัสผ่านที่หน้าเข้าสู่ระบบ แล้วทำตามลิงก์ในอีเมล"],
], [5.0 * cm, 12.6 * cm])]
story += [p("รายการตรวจสอบก่อนจบงาน", "H2Thai"), info_table([
    ["ตรวจสอบ", "เสร็จแล้ว"],
    ["ตรวจชื่อและรหัสนักศึกษาตรงกับรายการ", "□"],
    ["ตรวจรายละเอียดและความเหมาะสมของกิจกรรม", "□"],
    ["ไม่มีข้อมูลผู้ป่วยที่ระบุตัวบุคคลได้", "□"],
    ["อนุมัติหรือส่งกลับพร้อมเหตุผลครบถ้วน", "□"],
    ["ตรวจว่ารายการค้างและความก้าวหน้าของนักศึกษาปรับปรุงแล้ว", "□"],
], [15.5 * cm, 2.1 * cm])]
story += [Spacer(1, .35 * cm), callout("ติดต่อผู้ดูแลระบบ", "เมื่อพบข้อมูลผิดปกติ สิทธิ์ไม่ตรงกับหน้าที่ หรือสงสัยว่าข้อมูลสูญหาย ให้หยุดการแก้ไขซ้ำและแจ้งผู้ดูแลระบบพร้อมชื่อบัญชี เวลา และภาพหน้าจอที่ไม่เปิดเผยข้อมูลผู้ป่วย", AMBER)]

doc = SimpleDocTemplate(
    OUT,
    pagesize=A4,
    rightMargin=1.55 * cm,
    leftMargin=1.55 * cm,
    topMargin=1.55 * cm,
    bottomMargin=1.75 * cm,
    title="คู่มือการใช้งานสำหรับอาจารย์ ระบบบันทึกการฝึกปฏิบัติงาน",
    author="ภาควิชาศัลยศาสตร์",
)
doc.build(story, onFirstPage=draw_cover, onLaterPages=footer)
print(OUT)
