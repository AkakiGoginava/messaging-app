from __future__ import annotations

import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.pdfgen.canvas import Canvas


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "plans" / "Stage-1-Messaging-App-Plan-v1.0.md"
OUTPUT = ROOT / "output" / "pdf" / "Stage-1-Messaging-App-Plan-v1.0.pdf"

NAVY = colors.HexColor("#102A43")
BLUE = colors.HexColor("#1F6FEB")
CYAN = colors.HexColor("#1BA7A1")
INK = colors.HexColor("#243B53")
MUTED = colors.HexColor("#627D98")
PALE = colors.HexColor("#EAF2FA")
LIGHT = colors.HexColor("#F5F8FC")
RULE = colors.HexColor("#D9E2EC")
WHITE = colors.white


class NumberedCanvas(Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states: list[dict] = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        page_count = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_footer(page_count)
            super().showPage()
        super().save()

    def _draw_footer(self, page_count: int):
        width, _ = A4
        self.saveState()
        self.setStrokeColor(RULE)
        self.setLineWidth(0.4)
        self.line(18 * mm, 13 * mm, width - 18 * mm, 13 * mm)
        self.setFont("Helvetica", 7.5)
        self.setFillColor(MUTED)
        self.drawString(18 * mm, 8.7 * mm, "Stage 1 Messaging App Plan | v1.0")
        self.drawRightString(
            width - 18 * mm,
            8.7 * mm,
            f"Page {self._pageNumber} of {page_count}",
        )
        self.restoreState()


def inline_markup(text: str) -> str:
    placeholders: list[str] = []

    def stash(value: str) -> str:
        placeholders.append(value)
        return f"@@TOKEN{len(placeholders) - 1}@@"

    text = re.sub(
        r"\[([^\]]+)\]\((https?://[^)]+)\)",
        lambda m: stash(
            f'<link href="{html.escape(m.group(2), quote=True)}" '
            f'color="#1F6FEB">{html.escape(m.group(1))}</link>'
        ),
        text,
    )
    text = re.sub(
        r"`([^`]+)`",
        lambda m: stash(
            f'<font name="Courier" color="#102A43">{html.escape(m.group(1))}</font>'
        ),
        text,
    )
    text = html.escape(text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    for index, value in enumerate(placeholders):
        text = text.replace(f"@@TOKEN{index}@@", value)
    return text


def make_styles():
    base = getSampleStyleSheet()
    return {
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.2,
            leading=13.5,
            textColor=INK,
            spaceAfter=5,
            allowWidows=0,
            allowOrphans=0,
        ),
        "h1": ParagraphStyle(
            "H1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=24,
            textColor=NAVY,
            spaceBefore=3,
            spaceAfter=10,
            keepWithNext=True,
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=NAVY,
            spaceBefore=12,
            spaceAfter=6,
            keepWithNext=True,
        ),
        "h3": ParagraphStyle(
            "H3",
            parent=base["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=10.8,
            leading=14,
            textColor=BLUE,
            spaceBefore=8,
            spaceAfter=4,
            keepWithNext=True,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.9,
            leading=12.5,
            textColor=INK,
            leftIndent=14,
            firstLineIndent=-8,
            bulletIndent=3,
            bulletFontName="Helvetica",
            spaceAfter=3.2,
            allowWidows=0,
            allowOrphans=0,
        ),
        "number": ParagraphStyle(
            "Number",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.9,
            leading=12.5,
            textColor=INK,
            leftIndent=18,
            firstLineIndent=-13,
            bulletIndent=2,
            bulletFontName="Helvetica",
            spaceAfter=3.4,
            allowWidows=0,
            allowOrphans=0,
        ),
        "meta": ParagraphStyle(
            "Meta",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=14,
            textColor=MUTED,
            spaceAfter=2,
        ),
        "table": ParagraphStyle(
            "Table",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=7.2,
            leading=9.4,
            textColor=INK,
        ),
        "table_head": ParagraphStyle(
            "TableHead",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7.2,
            leading=9,
            textColor=WHITE,
        ),
        "cover_title": ParagraphStyle(
            "CoverTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=30,
            leading=35,
            alignment=TA_LEFT,
            textColor=NAVY,
            spaceAfter=12,
        ),
        "cover_subtitle": ParagraphStyle(
            "CoverSubtitle",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=13,
            leading=18,
            textColor=MUTED,
            spaceAfter=8,
        ),
        "callout": ParagraphStyle(
            "Callout",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=10.2,
            leading=15,
            textColor=NAVY,
            leftIndent=8,
            rightIndent=8,
            spaceAfter=0,
        ),
    }


def parse_table(lines: list[str], styles) -> Table:
    rows = []
    for row_index, line in enumerate(lines):
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if row_index == 1 and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells):
            continue
        style = styles["table_head"] if row_index == 0 else styles["table"]
        rows.append([Paragraph(inline_markup(cell), style) for cell in cells])

    column_count = len(rows[0])
    available = 174 * mm
    if column_count == 2:
        widths = [52 * mm, available - 52 * mm]
    elif column_count == 3:
        widths = [34 * mm, 55 * mm, available - 89 * mm]
    elif column_count == 4:
        widths = [25 * mm, 29 * mm, 42 * mm, available - 96 * mm]
    else:
        widths = [available / column_count] * column_count

    table = Table(rows, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.35, RULE),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT]),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def build_story(markdown: str, styles):
    lines = markdown.splitlines()
    story = []

    story.extend(
        [
            Spacer(1, 24 * mm),
            HRFlowable(width="20%", thickness=5, color=CYAN, hAlign="LEFT"),
            Spacer(1, 14 * mm),
            Paragraph("STAGE 1", styles["cover_subtitle"]),
            Paragraph(
                "Messaging MVP and<br/>Human-Gated Agent Workflow",
                styles["cover_title"],
            ),
            Spacer(1, 8 * mm),
            Paragraph(
                "A delivery charter for a secure, responsive, one-to-one "
                "messaging application.",
                styles["cover_subtitle"],
            ),
            Spacer(1, 22 * mm),
            Table(
                [
                    [
                        Paragraph("<b>VERSION</b><br/>1.0", styles["meta"]),
                        Paragraph("<b>DATE</b><br/>2026-07-28", styles["meta"]),
                        Paragraph(
                            "<b>STATUS</b><br/>Project foundation",
                            styles["meta"],
                        ),
                    ]
                ],
                colWidths=[50 * mm, 50 * mm, 62 * mm],
                style=TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), PALE),
                        ("BOX", (0, 0), (-1, -1), 0.5, RULE),
                        ("INNERGRID", (0, 0), (-1, -1), 0.5, RULE),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 8),
                        ("TOPPADDING", (0, 0), (-1, -1), 9),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                    ]
                ),
            ),
            Spacer(1, 34 * mm),
            Paragraph(
                "Human approval remains the gate for design readiness, "
                "task creation, pull-request approval, and final merge.",
                styles["callout"],
            ),
            PageBreak(),
        ]
    )

    index = 0
    first_source_heading_skipped = False
    paragraph_buffer: list[str] = []

    def flush_paragraph():
        nonlocal paragraph_buffer
        if paragraph_buffer:
            story.append(
                Paragraph(inline_markup(" ".join(paragraph_buffer)), styles["body"])
            )
            paragraph_buffer = []

    while index < len(lines):
        line = lines[index].rstrip()
        stripped = line.strip()

        if stripped.startswith("# ") and not first_source_heading_skipped:
            first_source_heading_skipped = True
            index += 1
            continue

        if not stripped:
            flush_paragraph()
            index += 1
            continue

        if stripped.startswith("**Version:**") or stripped.startswith("**Date:**") or stripped.startswith("**Status:**") or stripped.startswith("**Source:**"):
            index += 1
            continue

        if stripped.startswith("|"):
            flush_paragraph()
            table_lines = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                table_lines.append(lines[index].strip())
                index += 1
            story.extend([parse_table(table_lines, styles), Spacer(1, 5)])
            continue

        heading = re.match(r"^(#{2,3})\s+(.+)$", stripped)
        if heading:
            flush_paragraph()
            level = len(heading.group(1))
            title = heading.group(2)
            if level == 2 and title.startswith(("2.", "3.", "4.", "5.")):
                story.append(PageBreak())
            story.append(Paragraph(inline_markup(title), styles[f"h{level}"]))
            index += 1
            continue

        bullet = re.match(r"^-\s+(.+)$", stripped)
        if bullet:
            flush_paragraph()
            story.append(
                Paragraph(
                    inline_markup(bullet.group(1)),
                    styles["bullet"],
                    bulletText="-",
                )
            )
            index += 1
            continue

        numbered = re.match(r"^(\d+)\.\s+(.+)$", stripped)
        if numbered:
            flush_paragraph()
            story.append(
                Paragraph(
                    inline_markup(numbered.group(2)),
                    styles["number"],
                    bulletText=numbered.group(1) + ".",
                )
            )
            index += 1
            continue

        paragraph_buffer.append(stripped)
        index += 1

    flush_paragraph()
    return story


def main():
    markdown = SOURCE.read_text(encoding="utf-8")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    styles = make_styles()
    document = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title="Stage 1 - Messaging MVP and Human-Gated Agent Workflow",
        author="Messaging App Project",
        subject="Stage 1 project foundation and delivery plan",
    )
    document.build(build_story(markdown, styles), canvasmaker=NumberedCanvas)
    print(OUTPUT)


if __name__ == "__main__":
    main()
