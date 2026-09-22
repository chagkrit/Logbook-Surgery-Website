from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

OUT = "output/pdf/คู่มือผู้ดูแลระบบ_การเลื่อนชั้นนักศึกษา.pdf"
FONT = "/Library/Fonts/Arial Unicode.ttf"

pdfmetrics.registerFont(TTFont("Sarabun", FONT))
pdfmetrics.registerFont(TTFont("SarabunBold", FONT))

green = colors.HexColor("#155426")
soft_green = colors.HexColor("#EAF4EC")
purple = colors.HexColor("#5C3566")
ink = colors.HexColor("#1D2521")
muted = colors.HexColor("#5F6964")
line = colors.HexColor("#D7E1D9")
amber = colors.HexColor("#FFF3D6")
red_soft = colors.HexColor("#FDECEC")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverTitle", fontName="SarabunBold", fontSize=25, leading=33, textColor=green, alignment=TA_CENTER, spaceAfter=10))
styles.add(ParagraphStyle(name="CoverSub", fontName="Sarabun", fontSize=13, leading=20, textColor=muted, alignment=TA_CENTER))
styles.add(ParagraphStyle(name="H1Thai", fontName="SarabunBold", fontSize=18, leading=25, textColor=green, spaceBefore=8, spaceAfter=10, keepWithNext=True))
styles.add(ParagraphStyle(name="H2Thai", fontName="SarabunBold", fontSize=14, leading=20, textColor=purple, spaceBefore=10, spaceAfter=6, keepWithNext=True))
styles.add(ParagraphStyle(name="BodyThai", fontName="Sarabun", fontSize=10.5, leading=17, textColor=ink, spaceAfter=6))
styles.add(ParagraphStyle(name="SmallThai", fontName="Sarabun", fontSize=9, leading=13, textColor=muted))
styles.add(ParagraphStyle(name="StepThai", fontName="Sarabun", fontSize=10.5, leading=17, leftIndent=17, firstLineIndent=-17, textColor=ink, spaceAfter=5))
styles.add(ParagraphStyle(name="CalloutThai", fontName="Sarabun", fontSize=10.5, leading=16, textColor=ink, leftIndent=8, rightIndent=8, spaceBefore=5, spaceAfter=5))

def p(text, style="BodyThai"):
    return Paragraph(text, styles[style])

def bullet(number, text):
    return p(f"<b>{number}.</b> {text}", "StepThai")

def callout(title, text, color=soft_green):
    t = Table([[p(f"<b>{title}</b><br/>{text}", "CalloutThai")]], colWidths=[17.2*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), color), ("BOX", (0,0), (-1,-1), 0.5, line),
        ("LEFTPADDING", (0,0), (-1,-1), 10), ("RIGHTPADDING", (0,0), (-1,-1), 10),
        ("TOPPADDING", (0,0), (-1,-1), 7), ("BOTTOMPADDING", (0,0), (-1,-1), 7),
    ]))
    return t

def table(rows, widths):
    converted = [[p(cell, "SmallThai" if row_index else "SmallThai") for cell in row] for row_index, row in enumerate(rows)]
    t = Table(converted, colWidths=widths, repeatRows=1, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), green), ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,0), "SarabunBold"), ("GRID", (0,0), (-1,-1), 0.35, line),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING", (0,0), (-1,-1), 7), ("RIGHTPADDING", (0,0), (-1,-1), 7),
        ("TOPPADDING", (0,0), (-1,-1), 6), ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("BACKGROUND", (0,1), (-1,-1), colors.white),
    ]))
    return t

def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(line); canvas.line(1.7*cm, 1.35*cm, 19.3*cm, 1.35*cm)
    canvas.setFillColor(muted); canvas.setFont("Sarabun", 8)
    canvas.drawString(1.7*cm, 0.85*cm, "คู่มือผู้ดูแลระบบ ระบบบันทึกการฝึกปฏิบัติงานศัลยศาสตร์")
    canvas.drawRightString(19.3*cm, 0.85*cm, f"หน้า {doc.page}")
    canvas.restoreState()

story = []
story += [Spacer(1, 3.0*cm), p("คู่มือผู้ดูแลระบบ", "CoverTitle"), p("การเลื่อนชั้นนักศึกษาแบบกลุ่ม", "CoverTitle"), Spacer(1, .45*cm), p("ระบบบันทึกการฝึกปฏิบัติงานนักศึกษาแพทย์<br/>ภาควิชาศัลยศาสตร์ คณะแพทยศาสตร์ มหาวิทยาลัยเชียงใหม่", "CoverSub"), Spacer(1, 1.1*cm)]
story.append(callout("วัตถุประสงค์", "ใช้เป็นแนวทางจัดการเลื่อนชั้นนักศึกษาจำนวนมาก โดยคงบัญชีผู้ใช้ รหัสผ่าน รูป และรหัสคิวอาร์เดิม พร้อมบันทึกประวัติการดำเนินการอย่างตรวจสอบได้"))
story += [Spacer(1,.9*cm), p("ฉบับสำหรับผู้ดูแลระบบ", "CoverSub"), PageBreak()]

story += [p("1. ภาพรวมและเงื่อนไขก่อนเลื่อนชั้น", "H1Thai"),
          p("การเลื่อนชั้นดำเนินการเป็นชุดเดียวทั้งกลุ่ม หากมีนักศึกษาคนใดมีข้อมูลไม่ครบ ระบบจะไม่เลื่อนใครในชุดนั้น เพื่อป้องกันข้อมูลค้างหรือมีชั้นปีปัจจุบันซ้ำกัน"),
          callout("หลักการสำคัญ", "การเลื่อนชั้นจะเปลี่ยนสถานะการลงทะเบียนเดิมเป็นเสร็จสิ้น และสร้างการลงทะเบียนใหม่เป็นกำลังใช้งานในรายการเดียวกัน นักศึกษาจึงยังใช้บัญชีเดิมและรหัสคิวอาร์เดิมได้", soft_green),
          p("ตรวจให้ครบก่อนเริ่ม", "H2Thai"),
          bullet("1", "ผู้ปฏิบัติต้องเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ"),
          bullet("2", "หลักสูตรปลายทางต้องเผยแพร่แล้ว และต้องเป็นชั้นปีถัดไปกับปีการศึกษาถัดไป เช่น ชั้นปีที่ 4 ปี 2569 ไปชั้นปีที่ 5 ปี 2570"),
          bullet("3", "ต้องสร้างรอบการฝึกในหลักสูตรปลายทางให้ครบทุกกลุ่มที่จะรับนักศึกษา โดยรอบการฝึกต้องมีรหัสกลุ่มตรงกับกลุ่มใหม่"),
          bullet("4", "ตามปกตินักศึกษาต้องผ่านการรับรองสมุดบันทึกของชั้นปีเดิมก่อน"),
          bullet("5", "เตรียมรหัสผ่านของผู้ดูแลระบบไว้สำหรับยืนยันครั้งสุดท้าย"),
          p("สิ่งที่ระบบไม่อนุญาต", "H2Thai"),
          table([["กรณี", "ผลของระบบ"], ["หลักสูตรปลายทางยังไม่เผยแพร่", "ปุ่มเพิ่มเข้าคิวและยืนยันจะไม่พร้อมใช้งาน"], ["ชั้นปีหรือปีการศึกษาไม่ใช่ปีถัดไป", "ระบบปฏิเสธทั้งชุด"], ["รอบการฝึกไม่ตรงกับกลุ่มใหม่", "ระบบปฏิเสธทั้งชุด"], ["มีผู้ยังไม่รับรองโดยไม่มีการยกเว้น", "ระบบปฏิเสธทั้งชุด"]], [5.5*cm, 11.7*cm]), PageBreak()]

story += [p("2. เตรียมหลักสูตรปลายทางและรอบการฝึก", "H1Thai"),
          p("ให้สร้างและตรวจรายการกิจกรรมของชั้นปีใหม่ก่อนเริ่มจัดคิวนักศึกษา ระบบจะไม่อนุญาตให้ใช้หลักสูตรแบบร่างเพื่อเลื่อนชั้น"),
          p("ขั้นตอนเตรียมหลักสูตร", "H2Thai"),
          bullet("1", "ไปที่เมนูจัดการข้อมูล แล้วเปิดส่วนหลักสูตรและการเลื่อนชั้น"),
          bullet("2", "สร้างหลักสูตรแบบร่าง ระบุชั้นปีและปีการศึกษาปลายทางให้ถูกต้อง"),
          bullet("3", "นำเข้ารายการกิจกรรม ตรวจจำนวนกิจกรรม เป้าหมาย และหมวดกิจกรรม"),
          bullet("4", "เผยแพร่หลักสูตรหลังตรวจสอบแล้ว ระบบจึงจะแสดงเป็นปลายทางที่เลือกได้"),
          p("ขั้นตอนเตรียมรอบการฝึก", "H2Thai"),
          bullet("1", "เปิดส่วนจัดการปีการศึกษาและรอบการฝึก"),
          bullet("2", "เลือกหลักสูตรปลายทาง"),
          bullet("3", "เพิ่มรอบการฝึกทีละกลุ่ม โดยกำหนดกลุ่มที่ ชื่อรอบ วันเริ่ม วันสิ้นสุด และสถานะ"),
          bullet("4", "ตรวจว่าทุกรหัสกลุ่มที่ต้องใช้มีรอบการฝึกของตนเอง และไม่เก็บถาวร"),
          callout("ตัวอย่าง", "หากจะเลื่อนนักศึกษากลุ่มใหม่ 1 และ 2 ต้องมีรอบการฝึกปลายทางสำหรับกลุ่ม 1 และกลุ่ม 2 แยกกัน เพื่อให้ระบบจับคู่ได้ถูกต้อง", amber), PageBreak()]

story += [p("3. ขั้นตอนเลื่อนชั้นแบบกลุ่ม", "H1Thai"),
          p("ส่วนการเลื่อนชั้นแสดงครั้งละไม่เกิน 50 คน แต่รายการที่เลือกจะคงอยู่แม้เปลี่ยนหน้า เปลี่ยนตัวกรอง หรือจัดคิวเป็นหลายกลุ่ม"),
          p("ขั้นตอนปฏิบัติ", "H2Thai"),
          bullet("1", "เลือกชั้นปีและปีการศึกษาต้นทาง"),
          bullet("2", "ใช้ตัวกรองกลุ่มเดิม สถานะการรับรอง หรือค้นหาจากชื่อและรหัสนักศึกษา"),
          bullet("3", "เลือกนักศึกษารายคน หรือใช้ปุ่มเลือกทั้งหมดในผลกรอง หรือเลือกเฉพาะผู้ผ่านเกณฑ์"),
          bullet("4", "ในส่วนกำหนดปลายทาง เลือกหลักสูตรปลายทาง กลุ่มใหม่ และรอบการฝึกที่ตรงกับกลุ่มใหม่"),
          bullet("5", "กดเพิ่มเข้าคิว ระบบจะรวมรายชื่อไว้ในกลุ่มปลายทางที่กำหนด"),
          bullet("6", "ทำซ้ำสำหรับกลุ่มอื่นจนจัดคิวครบทั้งรุ่น"),
          bullet("7", "ตรวจสรุปก่อนยืนยัน แก้ทุกรายการที่มีสถานะเตือน"),
          bullet("8", "กรอกรหัสผ่านผู้ดูแลระบบ และกดยืนยันเลื่อนชั้นทั้งชุด"),
          callout("ข้อควรระวัง", "อย่ากดยืนยันจนกว่าช่องพร้อมเลื่อนจะเท่ากับจำนวนทั้งหมด หากยังไม่เท่ากัน ปุ่มยืนยันจะถูกปิด", red_soft),
          p("การแปลผลหน้าสรุป", "H2Thai"),
          table([["รายการ", "ความหมายและการแก้ไข"], ["พร้อมเลื่อน", "ข้อมูลครบและผ่านเงื่อนไขทั้งหมด"], ["ยังไม่รับรอง", "ให้รับรองชั้นปีเดิม หรือเลือกยกเว้นรายคนพร้อมเหตุผล"], ["กลุ่มหรือรอบการฝึกไม่ครบ", "กำหนดกลุ่มใหม่และเลือกรอบการฝึกที่ตรงกัน"], ["ซ้ำในคิว", "นำรายชื่อซ้ำออก ให้เหลือหนึ่งครั้ง"], ["อยู่ปลายทางแล้ว", "ตรวจข้อมูลการลงทะเบียนและนำรายการนั้นออกจากคิว"]], [5.2*cm, 12.0*cm]), PageBreak()]

story += [p("4. การยกเว้น การตรวจสอบ และการย้อนกลับ", "H1Thai"),
          p("การยกเว้นใช้เฉพาะผู้ที่ยังไม่ได้รับการรับรอง แต่มีเหตุผลทางวิชาการหรือการบริหารที่ชัดเจน ระบบบันทึกชื่อผู้ดำเนินการ เวลา และเหตุผลไว้ในประวัติ"),
          p("การยกเว้นรายคน", "H2Thai"),
          bullet("1", "ในรายการคิวของนักศึกษาที่สถานะยังไม่รับรอง ให้เลือกยกเว้น"),
          bullet("2", "กรอกเหตุผลให้เฉพาะรายนั้น เช่น ได้รับอนุมัติจากคณะกรรมการหลักสูตร"),
          bullet("3", "ตรวจว่ารายการอื่นที่ยังไม่รับรองไม่ได้ถูกยกเว้นโดยไม่ตั้งใจ"),
          callout("การควบคุม", "การยกเว้นทำได้รายบุคคลเท่านั้น ไม่สามารถยกเว้นทั้งกลุ่มโดยใช้เหตุผลเดียว", amber),
          p("การย้อนกลับทั้งชุด", "H2Thai"),
          p("ในประวัติการเลื่อนชั้น ให้เลือกชุดที่ต้องการย้อนกลับ กรอกเหตุผลและรหัสผ่านผู้ดูแลระบบ ระบบจะย้อนกลับทั้งชุดพร้อมกัน"),
          table([["เงื่อนไข", "ผล"], ["ยังไม่มีรายการสมุดบันทึกในชั้นปีใหม่ของทุกคน", "ย้อนกลับทั้งชุดได้"], ["มีอย่างน้อยหนึ่งคนบันทึกรายการในชั้นปีใหม่", "ระบบบล็อกการย้อนกลับทั้งชุด เพื่อไม่ให้ข้อมูลสมุดบันทึกสูญหาย"], ["ย้อนกลับสำเร็จ", "การลงทะเบียนปลายทางถูกเก็บถาวร และชั้นปีเดิมกลับเป็นกำลังใช้งาน"]], [7.0*cm, 10.2*cm]),
          p("หลังเลื่อนชั้นสำเร็จ", "H2Thai"),
          bullet("1", "ตรวจจำนวนผู้ที่เลื่อนสำเร็จให้ตรงกับจำนวนในคิว"),
          bullet("2", "ตรวจกลุ่มและรอบการฝึกของตัวอย่างนักศึกษาจากแต่ละกลุ่ม"),
          bullet("3", "ตรวจว่านักศึกษาเห็นเฉพาะสมุดบันทึกของชั้นปีใหม่ ขณะที่ผู้ดูแลระบบยังดูประวัติเดิมได้"),
          bullet("4", "ส่งออกข้อมูลเป็นแฟ้มตารางหรือเอกสารก่อนดำเนินการแก้ไขข้อมูลจำนวนมากครั้งถัดไป"), PageBreak()]

story += [p("5. รายการตรวจสอบสำหรับผู้ดูแลระบบ", "H1Thai"),
          p("ใช้รายการนี้ก่อนกดยืนยันทุกครั้ง", "BodyThai"),
          table([["ตรวจสอบ", "ผ่าน"], ["หลักสูตรปลายทางเผยแพร่แล้ว", "□"], ["ชั้นปีและปีการศึกษาเป็นปีถัดไป", "□"], ["สร้างรอบการฝึกสำหรับทุกกลุ่มปลายทางแล้ว", "□"], ["เลือกนักศึกษาครบตามกลุ่มที่ต้องการ", "□"], ["แต่ละคนมีกลุ่มใหม่และรอบการฝึกตรงกัน", "□"], ["ผู้ยังไม่รับรองมีการยกเว้นพร้อมเหตุผลเฉพาะราย หรือถูกนำออกจากคิว", "□"], ["สรุปพร้อมเลื่อนเท่ากับจำนวนทั้งหมด", "□"], ["สำรองหรือส่งออกข้อมูลตามความเหมาะสมแล้ว", "□"], ["ผู้ดำเนินการมีรหัสผ่านผู้ดูแลระบบพร้อมยืนยัน", "□"]], [14.0*cm, 3.2*cm]),
          Spacer(1,.5*cm), callout("เมื่อพบปัญหา", "หากปุ่มยืนยันไม่พร้อมใช้งาน ให้กลับไปดูตัวเลขที่มีสถานะเตือนในสรุปก่อนยืนยัน ระบบตั้งใจบล็อกการเลื่อนเพื่อรักษาความถูกต้องของข้อมูลทั้งรุ่น", red_soft),
          Spacer(1,.7*cm), p("สรุป", "H2Thai"), p("การเลื่อนชั้นแบบกลุ่มช่วยให้ผู้ดูแลระบบจัดการนักศึกษาจำนวนมากได้อย่างเป็นระบบ ข้อมูลบัญชี รหัสคิวอาร์ และประวัติเดิมยังคงอยู่ โดยใช้หลักสูตรและการลงทะเบียนใหม่เป็นตัวกำหนดชั้นปีปัจจุบัน")]

doc = SimpleDocTemplate(OUT, pagesize=A4, rightMargin=1.7*cm, leftMargin=1.7*cm, topMargin=1.7*cm, bottomMargin=1.8*cm, title="คู่มือผู้ดูแลระบบ การเลื่อนชั้นนักศึกษา")
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUT)
