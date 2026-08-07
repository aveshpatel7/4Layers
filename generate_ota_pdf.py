import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 9)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (Only on page 2+)
        if self._pageNumber > 1:
            self.drawString(54, 11 * 72 - 36, "4Layers Smart Home Ecosystem — Enterprise OTA System Architecture")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(54, 11 * 72 - 42, 8.5 * 72 - 54, 11 * 72 - 42)
        
        # Footer on all pages
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * 72 - 54, 36, page_text)
        self.drawString(54, 36, "CONFIDENTIAL & PROPRIETARY — 4LAYERS SMART HOME ECOSYSTEM")
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 48, 8.5 * 72 - 54, 48)
        
        self.restoreState()

def build_pdf():
    pdf_filename = r"c:\Users\andyk\Desktop\SmartNest\4Layers_Enterprise_OTA_System_Architecture.pdf"
    doc = SimpleDocTemplate(
        pdf_filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    primary_color = colors.HexColor("#0F172A")
    accent_green = colors.HexColor("#00E676")
    brand_blue = colors.HexColor("#2563EB")
    dark_gray = colors.HexColor("#1E293B")
    text_color = colors.HexColor("#334155")
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=primary_color,
        spaceAfter=4
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#475569"),
        spaceAfter=12
    )

    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=primary_color,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=text_color,
        spaceAfter=6
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#0F172A")
    )

    story = []

    # Title Banner Block
    story.append(Paragraph("4LAYERS IoT SMART HOME ECOSYSTEM", ParagraphStyle('Sub', fontName='Helvetica-Bold', fontSize=9, textColor=accent_green, leading=11, spaceAfter=2)))
    story.append(Paragraph("Enterprise OTA Firmware Management System", title_style))
    story.append(Paragraph("A Next-Generation Cloud Infrastructure for Remote Smart Device Updates & Diagnostics", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=accent_green, spaceBefore=0, spaceAfter=10))

    # Executive Summary Card
    summary_text = (
        "<b>Executive Summary:</b> The 4Layers Smart Home Ecosystem is built on enterprise-grade cloud architecture "
        "(AWS App Runner + EMQX MQTT TLS 8883). Unlike traditional smart home hardware requiring physical USB maintenance, "
        "4Layers features a fully integrated Over-The-Air (OTA) Firmware Management System. This infrastructure enables "
        "administrators to update, monitor, and debug 1000+ IoT devices wirelessly with zero downtime and zero maintenance cost."
    )
    
    summary_table = Table(
        [[Paragraph(summary_text, callout_style)]],
        colWidths=[504]
    )
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('BORDER', (0,0), (-1,-1), 1, colors.HexColor("#E2E8F0")),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LINELEFT', (0,0), (0,0), 4, brand_blue),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 10))

    # Core Features Section
    story.append(Paragraph("1. Core OTA System Modules", h1_style))
    
    modules_data = [
        [
            Paragraph("<b>Module & Purpose</b>", ParagraphStyle('TH', fontName='Helvetica-Bold', fontSize=8.5, textColor=colors.white)),
            Paragraph("<b>Technical Execution</b>", ParagraphStyle('TH', fontName='Helvetica-Bold', fontSize=8.5, textColor=colors.white)),
            Paragraph("<b>Business Value</b>", ParagraphStyle('TH', fontName='Helvetica-Bold', fontSize=8.5, textColor=colors.white))
        ],
        [
            Paragraph("<b>Remote MQTT OTA</b><br/><font color='#64748B' size=7.5>Wireless Fleet Updates</font>", body_style),
            Paragraph("FastAPI backend publishes encrypted MQTT payload to <code>smartnest/devices/{node_id}/ota</code> over TLS Port 8883. ESP32 streams dual-partition OTA binary from AWS Cloud.", body_style),
            Paragraph("Update 100+ switches across 10 rooms with a single click. Eliminates technician site visits.", body_style)
        ],
        [
            Paragraph("<b>Live Device Console</b><br/><font color='#64748B' size=7.5>Cloud Remote Debugging</font>", body_style),
            Paragraph("Hardware streams real-time telemetry (WiFi signal, heap memory, socket state, error codes) directly to Admin Console terminal via WebSocket/HTTP.", body_style),
            Paragraph("Diagnose failures (e.g., 'HTTP 404', 'Memory Overflow') remotely without opening switchboards.", body_style)
        ],
        [
            Paragraph("<b>WebSerial USB Flasher</b><br/><font color='#64748B' size=7.5>Zero-Software Setup</font>", body_style),
            Paragraph("In-browser WebSerial API connects Chrome to ESP32 via USB. Displays live sector erasing, writing at 45%, and verification.", body_style),
            Paragraph("Factory staff & technicians flash hardware directly from Chrome without installing Arduino IDE.", body_style)
        ]
    ]

    t_modules = Table(modules_data, colWidths=[126, 220, 158])
    t_modules.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
    ]))
    story.append(t_modules)
    story.append(Spacer(1, 10))

    # Scalability Guardrails Section
    story.append(Paragraph("2. Enterprise Scalability & Fleet Safety Guardrails (1000+ Devices)", h1_style))
    story.append(Paragraph("To ensure zero server downtime and zero network congestion during mass fleet rollouts, 4Layers enforces 4 enterprise guardrails inspired by AWS IoT and Tesla OTA fleet architecture:", body_style))

    guardrails_data = [
        [
            Paragraph("<b>Guardrail</b>", ParagraphStyle('TH2', fontName='Helvetica-Bold', fontSize=8.5, textColor=colors.white)),
            Paragraph("<b>The Challenge</b>", ParagraphStyle('TH2', fontName='Helvetica-Bold', fontSize=8.5, textColor=colors.white)),
            Paragraph("<b>The 4Layers Solution</b>", ParagraphStyle('TH2', fontName='Helvetica-Bold', fontSize=8.5, textColor=colors.white))
        ],
        [
            Paragraph("<b>1. Network Jitter</b><br/><font color='#00C853'>WiFi De-congestion</font>", body_style),
            Paragraph("100+ devices downloading 2MB binaries simultaneously crashes local WiFi routers due to bufferbloat.", body_style),
            Paragraph("ESP32 executes random <code>delay(random(1000, 15000))</code> before HTTP fetch, staggering traffic smoothly.", body_style)
        ],
        [
            Paragraph("<b>2. Backend Throttling</b><br/><font color='#00C853'>MQTT Queue Protection</font>", body_style),
            Paragraph("Publishing 1,000 MQTT commands in 1 millisecond causes EMQX broker task queue spikes.", body_style),
            Paragraph("FastAPI uses <code>asyncio.sleep(0.05)</code> background queues (50ms per-node micro-delay throttling).", body_style)
        ],
        [
            Paragraph("<b>3. DOM Protection</b><br/><font color='#00C853'>Summary View Toggle</font>", body_style),
            Paragraph("Rendering 1,000 live progress bars in a browser starves JS Event Loops and freezes Admin UI.", body_style),
            Paragraph("For > 10 devices, UI auto-switches to 4 aggregated summary cards with non-blocking <code>requestAnimationFrame</code>.", body_style)
        ],
        [
            Paragraph("<b>4. Auto-Rollback</b><br/><font color='#00C853'>Anti-Bricking Safety</font>", body_style),
            Paragraph("Corrupted firmware binary or Wi-Fi reconnect failure bricks deployed hardware permanently.", body_style),
            Paragraph("ESP32 validates network health within 30s. On failure, board automatically rolls back to previous valid partition.", body_style)
        ]
    ]

    t_guardrails = Table(guardrails_data, colWidths=[116, 180, 208])
    t_guardrails.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), dark_gray),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
    ]))
    story.append(t_guardrails)
    story.append(Spacer(1, 10))

    # Architecture Specifications Section
    story.append(Paragraph("3. Technical Architecture Specifications", h1_style))

    tech_specs = [
        [Paragraph("<b>Component</b>", ParagraphStyle('TH3', fontName='Helvetica-Bold', fontSize=8.5, textColor=primary_color)),
         Paragraph("<b>Specification Details</b>", ParagraphStyle('TH3', fontName='Helvetica-Bold', fontSize=8.5, textColor=primary_color))],
        [Paragraph("Cloud Server", body_style), Paragraph("AWS App Runner (Auto-scaling FastAPI Python 3.11 container)", body_style)],
        [Paragraph("Database", body_style), Paragraph("PostgreSQL (SQLAlchemy ORM with node state caching)", body_style)],
        [Paragraph("MQTT Protocol", body_style), Paragraph("EMQX Serverless Broker over TLS Port 8883 (SSL/TLS Encrypted)", body_style)],
        [Paragraph("Hardware Platform", body_style), Paragraph("ESP32 Dual-Core 240MHz (4MB Flash, Dual OTA Partitions)", body_style)],
        [Paragraph("Mobile Applications", body_style), Paragraph("React Native Expo (Android & iOS Signed Production Release)", body_style)],
        [Paragraph("Voice Integration", body_style), Paragraph("Google Home Direct Action Fulfillments & Amazon Alexa Smart Home Skill", body_style)]
    ]

    t_specs = Table(tech_specs, colWidths=[140, 364])
    t_specs.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#E2E8F0")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_specs)
    story.append(Spacer(1, 12))

    # Footer note block
    closing_note = Paragraph(
        "<b>Report Generated:</b> August 2026 | <b>Brand:</b> 4Layers Smart Home Ecosystem | "
        "<b>Website:</b> <font color='#2563EB'><u>https://4layers.in/</u></font> | <b>Admin Panel:</b> <font color='#2563EB'><u>https://edabtynvpy.ap-south-1.awsapprunner.com/admin</u></font>",
        ParagraphStyle('FooterNote', fontName='Helvetica', fontSize=8, leading=11, textColor=colors.HexColor("#64748B"), alignment=1)
    )
    story.append(closing_note)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated PDF report at: {pdf_filename}")

if __name__ == "__main__":
    build_pdf()
