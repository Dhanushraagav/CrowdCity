import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
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
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        if self._pageNumber == 1:
            # Skip page number on cover page
            return
        self.saveState()
        self.setFont("Helvetica", 9)
        self.setFillColor(colors.HexColor("#6b7280"))
        
        # Header
        self.drawString(54, 750, "CrowdCity AI - HR Project Showcase Portfolio")
        self.setStrokeColor(colors.HexColor("#e5e7eb"))
        self.setLineWidth(0.5)
        self.line(54, 742, 558, 742)
        
        # Footer
        self.line(54, 45, 558, 45)
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 30, page_text)
        self.drawString(54, 30, "Confidential - Professional Portfolio")
        self.restoreState()

def build_pdf(filename="CrowdCity_AI_Project_Showcase.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=72,
        bottomMargin=72
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=28,
        leading=34,
        textColor=colors.HexColor("#0D9488"),
        alignment=0, # Left
        spaceAfter=10
    )
    
    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#4b5563"),
        alignment=0,
        spaceAfter=30
    )

    h1_style = ParagraphStyle(
        'H1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#111827"),
        spaceBefore=15,
        spaceAfter=10,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'H2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#0D9488"),
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14.5,
        textColor=colors.HexColor("#374151"),
        spaceAfter=8
    )

    bullet_style = ParagraphStyle(
        'Bullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor("#374151"),
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4
    )

    story = []

    # ================= PAGE 1: COVER PAGE =================
    story.append(Spacer(1, 100))
    story.append(Paragraph("CROWDCITY AI", title_style))
    story.append(Paragraph("A Full-Stack AI-Powered Civic Reporting & Government Services Platform", subtitle_style))
    story.append(Spacer(1, 20))

    # Project metadata box
    meta_data = [
        [Paragraph("<b>Candidate Name:</b>", body_style), Paragraph("Dhanush Raagav S", body_style)],
        [Paragraph("<b>Project Focus:</b>", body_style), Paragraph("Civic Grievances Redressal & Intelligent Citizen Services Engine", body_style)],
        [Paragraph("<b>Tech Stack:</b>", body_style), Paragraph("HTML5, CSS3, JavaScript, Express.js, Supabase PostgreSQL, Groq AI API", body_style)],
        [Paragraph("<b>Architecture:</b>", body_style), Paragraph("Dual-mode Isolated Module Design (Citizen V1 + Government V2)", body_style)]
    ]
    t_meta = Table(meta_data, colWidths=[120, 380])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f9fafb")),
        ('PADDING', (0,0), (-1,-1), 8),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#e5e7eb")),
        ('INNERGRID', (0,0), (-1,-1), 0.25, colors.HexColor("#f3f4f6")),
    ]))
    story.append(t_meta)
    
    story.append(Spacer(1, 150))
    story.append(Paragraph("<b>Submitted for Professional Technical Interview & HR Review</b>", subtitle_style))
    story.append(PageBreak())

    # ================= PAGE 2: WHY CHOOSE & TECH STACK =================
    story.append(Paragraph("1. Project Concept & Core Intent", h1_style))
    story.append(Paragraph(
        "<b>Why We Chose This Project:</b><br/>"
        "In developing nations like India, citizen engagement suffers due to two primary systemic challenges:<br/>"
        "1. <b>Civic Greviances:</b> Disjointed reporting channels, leading to slow response times for issues like potholes, streetlights, and sanitation.<br/>"
        "2. <b>Government Welfare Fragmentation:</b> Access to welfare schemes remains heavily scattered, complex, and paper-based. Eligible citizens are often unaware of their rights or unable to navigate complex qualification checklists.<br/><br/>"
        "CrowdCity AI bridges this gap. It acts as an integrated <b>Civic Grievance & Welfare Application Hub</b>. It empowers users to report locality issues directly on a map and automatically guides them through matching, checking, and applying for government schemes using advanced natural language algorithms.",
        body_style
    ))
    story.append(Spacer(1, 10))

    story.append(Paragraph("2. Complete Technical Stack & Tools Used", h1_style))
    tech_data = [
        [Paragraph("<b>Component</b>", h2_style), Paragraph("<b>Tech Description</b>", h2_style)],
        [Paragraph("<b>Frontend UI</b>", body_style), Paragraph("Modern CSS3, HTML5, Vanilla JavaScript (ES6+), FontAwesome Icons", body_style)],
        [Paragraph("<b>Mapping</b>", body_style), Paragraph("Leaflet.js open-source map integration with custom pin overlays", body_style)],
        [Paragraph("<b>Backend Router</b>", body_style), Paragraph("Node.js with Express.js REST API server framework", body_style)],
        [Paragraph("<b>Database</b>", body_style), Paragraph("Supabase PostgreSQL with schema isolation and Row Level Security (RLS)", body_style)],
        [Paragraph("<b>AI Engine</b>", body_style), Paragraph("Groq SDK leveraging Llama-3.3-70b-versatile for sub-second NLP", body_style)]
    ]
    t_tech = Table(tech_data, colWidths=[130, 370])
    t_tech.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#f3f4f6")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e5e7eb")),
        ('PADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t_tech)
    story.append(Spacer(1, 10))

    story.append(Paragraph("3. Agentic Development Environment", h1_style))
    story.append(Paragraph(
        "The project was designed, built, and tested in pair programming collaboration with <b>Google Antigravity AI</b>, a deep coding assistant. The agent facilitated:<br/>"
        "• High-fidelity automated code modifications with multi-chunk file updates.<br/>"
        "• Deployment and synchronization of localized dictionary assets (English & Tamil).<br/>"
        "• Rigorous testing of API response structures, mock fallbacks, and database schema updates.",
        body_style
    ))
    story.append(PageBreak())

    # ================= PAGE 3: CONTRIBUTIONS V1 & V2 =================
    story.append(Paragraph("4. Key Contributions & Implemented Features", h1_style))
    
    story.append(Paragraph("Version 1.0: Civic Issue Reporting Ecosystem", h2_style))
    story.append(Paragraph("• <b>Issue Filing:</b> Allowed citizens to submit reports with location details, category tag, and image uploads.", bullet_style))
    story.append(Paragraph("• <b>Leaflet Live Map:</b> Placed interactive visual markers representing reported problems across Tamil Nadu cities.", bullet_style))
    story.append(Paragraph("• <b>Authority Dashboard:</b> Provided government officers with status assignment workflows (Pending, In Progress, Resolved).", bullet_style))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Version 2.0: Unified Government Services Portal", h2_style))
    story.append(Paragraph("Extends CrowdCity with a fully live, direct citizen utility module comprising 9 main features:", body_style))
    story.append(Paragraph("1. <b>Citizen Services Dashboard:</b> Central landing page summarizing bookmarks, profile status, and office locators.", bullet_style))
    story.append(Paragraph("2. <b>Scheme Eligibility Checker:</b> An interactive profile evaluation wizard applying state eligibility limits.", bullet_style))
    story.append(Paragraph("3. <b>AI Government Assistant:</b> A full-page conversational Chatbot clarifying scheme requirements.", bullet_style))
    story.append(Paragraph("4. <b>Secure Document Wallet:</b> Securely stores certificates with browser-compliant safe binary Blob rendering.", bullet_style))
    story.append(Paragraph("5. <b>AI Document Verification:</b> OCR checks upload clarity, readability, and border boundaries.", bullet_style))
    story.append(Paragraph("6. <b>AI Form Filling Assistant:</b> Offers field-by-field guidelines for government application sheets.", bullet_style))
    story.append(Paragraph("7. <b>Office Locator:</b> Maps nearby e-Sevai, Taluk, and VAO offices with hours.", bullet_style))
    story.append(Paragraph("8. <b>Application Tracker:</b> Organizes submissions and timelines on official portals.", bullet_style))
    story.append(Paragraph("9. <b>Smart Reminder Center:</b> Tracks renewal alerts and appointment notifications.", bullet_style))
    story.append(Spacer(1, 10))

    story.append(Paragraph("5. Production-Ready System Polish", h1_style))
    story.append(Paragraph(
        "• <b>UX Integration:</b> Created a unified global <b>Command Palette (Ctrl + K)</b> for instant navigation across all features.<br/>"
        "• <b>Error Resilience:</b> Designed custom client pages: 404 (Page Not Found), 500 (Server Error Recovery), and Offline fallback templates.<br/>"
        "• <b>Localization support:</b> Implemented instant, full-page dynamic translation catalogs for both English and Tamil.",
        body_style
    ))
    
    doc.build(story, canvasmaker=NumberedCanvas)

if __name__ == "__main__":
    build_pdf()
    print("Project showcase PDF created successfully as CrowdCity_AI_Project_Showcase.pdf")
