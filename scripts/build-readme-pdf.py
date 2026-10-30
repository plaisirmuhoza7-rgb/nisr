"""Build the shareable README PDF. Requires reportlab (documentation only)."""

from pathlib import Path
import re
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    Preformatted, KeepTogether,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output' / 'pdf' / 'HURIZA-README.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
FONT_DIR = Path('C:/Windows/Fonts')
if (FONT_DIR / 'arial.ttf').exists():
    for name, file in [('Body', 'arial.ttf'), ('Body-Bold', 'arialbd.ttf'),
                       ('Body-Italic', 'ariali.ttf'), ('Body-BoldItalic', 'arialbi.ttf')]:
        pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / file)))
    pdfmetrics.registerFontFamily('Body', normal='Body', bold='Body-Bold',
                                  italic='Body-Italic', boldItalic='Body-BoldItalic')
    FONT = 'Body'
else:
    FONT = 'Helvetica'

if (FONT_DIR / 'consola.ttf').exists():
    pdfmetrics.registerFont(TTFont('Code', str(FONT_DIR / 'consola.ttf')))
    CODE_FONT = 'Code'
else:
    CODE_FONT = 'Courier'

NAVY = colors.HexColor('#14283F')
BLUE = colors.HexColor('#2463A6')
INK = colors.HexColor('#263C52')
MUTED = colors.HexColor('#60758B')
PALE = colors.HexColor('#F1F6FC')
LINE = colors.HexColor('#DBE5F0')
WIDTH, HEIGHT = A4
BODY_WIDTH = WIDTH - 96

styles = {
    'body': ParagraphStyle('body', fontName=FONT, fontSize=9.3, leading=13.6,
                           textColor=INK, spaceAfter=8),
    'h2': ParagraphStyle('h2', fontName=FONT + '-Bold', fontSize=22, leading=27,
                         textColor=NAVY, spaceAfter=19, keepWithNext=True),
    'h3': ParagraphStyle('h3', fontName=FONT + '-Bold', fontSize=11.1, leading=15,
                         textColor=BLUE, spaceBefore=8, spaceAfter=6, keepWithNext=True),
    'cell': ParagraphStyle('cell', fontName=FONT, fontSize=8.1, leading=11.5,
                           textColor=INK, spaceAfter=0),
    'th': ParagraphStyle('th', fontName=FONT + '-Bold', fontSize=8.2, leading=11.5,
                         textColor=colors.white),
    'code': ParagraphStyle('code', fontName=CODE_FONT, fontSize=8.5, leading=11,
                           textColor=NAVY),
    'bullet': ParagraphStyle('bullet', fontName=FONT, fontSize=9.3, leading=13.6,
                             textColor=INK, leftIndent=11, firstLineIndent=-10,
                             spaceAfter=6),
}

def inline(text):
    text = escape(text)
    def link(match):
        label, url = match.groups()
        if url.startswith(('https://', 'http://')):
            return f'<a href="{url}" color="#2463A6"><u>{label}</u></a>'
        return label
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', link, text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'`([^`]+)`', r'<font name="Courier">\1</font>', text)
    return text

def paragraph(text, style='body'):
    return Paragraph(inline(text), styles[style])

def draw_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(BLUE)
    canvas.rect(0, HEIGHT - 6, WIDTH, 6, fill=1, stroke=0)
    canvas.setFont(FONT + '-Bold', 10)
    canvas.setFillColor(NAVY)
    canvas.drawString(48, HEIGHT - 37, 'HURIZA')
    canvas.setFont(FONT, 8)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(WIDTH - 48, HEIGHT - 37, 'PROJECT README  /  OCTOBER 2026')
    canvas.setStrokeColor(LINE)
    canvas.line(48, 46, WIDTH - 48, 46)
    canvas.setFont(FONT, 7.5)
    canvas.drawString(48, 31, 'Community finance, clearer records, informed decisions.')
    canvas.drawRightString(WIDTH - 48, 31, f'{doc.page:02d}')
    canvas.restoreState()

source = (ROOT / 'README.md').read_text(encoding='utf-8')
parts = re.split(r'^## ', source, flags=re.M)
story = []
for section_number, section in enumerate(parts[1:], 1):
    if section_number > 1:
        story.append(PageBreak())
    lines = section.splitlines()
    title = lines.pop(0)
    if section_number == 1:
        story.append(Paragraph('Beyond Saving.<br/>Toward Financial Intelligence.',
                     ParagraphStyle('hero', fontName=FONT + '-Bold', fontSize=27,
                                    leading=32, textColor=NAVY, spaceAfter=13)))
        story.append(paragraph('A community-finance prototype for Rwanda.'))
        story.append(Spacer(1, 9))
    story.append(paragraph(title, 'h2'))
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if line.startswith('### '):
            story.append(paragraph(line[4:], 'h3'))
            i += 1
        elif line.startswith('```'):
            code = []
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                code.append(lines[i])
                i += 1
            block = Table([[Preformatted('\n'.join(code), styles['code'])]],
                          colWidths=[BODY_WIDTH], hAlign='LEFT')
            block.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), PALE),
                ('LEFTPADDING', (0, 0), (-1, -1), 11),
                ('RIGHTPADDING', (0, 0), (-1, -1), 11),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ]))
            story.extend([block, Spacer(1, 9)])
            i += 1
        elif line.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                row = [v.strip() for v in lines[i].strip('|').split('|')]
                if not all(re.fullmatch(r'[-: ]+', v) for v in row):
                    rows.append(row)
                i += 1
            data = [[paragraph(c, 'th' if n == 0 else 'cell') for c in row]
                    for n, row in enumerate(rows)]
            widths = ([80, 175, BODY_WIDTH - 255] if len(rows[0]) == 3
                      else [105, BODY_WIDTH - 105])
            table = Table(data, colWidths=widths, hAlign='LEFT', repeatRows=1)
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), NAVY),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, PALE]),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 9),
                ('RIGHTPADDING', (0, 0), (-1, -1), 9),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('LINEBELOW', (0, -1), (-1, -1), 0.5, LINE),
            ]))
            story.extend([table, Spacer(1, 13)])
        elif line.startswith('- '):
            story.append(paragraph('- ' + line[2:], 'bullet'))
            i += 1
        else:
            text = [line]
            i += 1
            while i < len(lines) and lines[i].strip() and not lines[i].startswith(('### ', '```', '|', '- ')):
                text.append(lines[i])
                i += 1
            story.append(paragraph(' '.join(text)))

doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=48, rightMargin=48,
                        topMargin=65, bottomMargin=61,
                        title='HURIZA | Project README', author='HURIZA',
                        subject='Problem, product, technology stack and local setup',
                        pageCompression=1)
doc.build(story, onFirstPage=draw_page, onLaterPages=draw_page)
print(OUT)
