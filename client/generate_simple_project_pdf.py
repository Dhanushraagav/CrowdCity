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
            return
        self.saveState()
        self.setFont("Helvetica", 9)
        self.setFillColor(colors.HexColor("#4b5563"))
        
        # Header
        self.drawString(54, 750, "CrowdCity AI - Simplified Project Summary")
        self.setStrokeColor(colors.HexColor("#e5e7eb"))
        self.setLineWidth(0.5)
        self.line(54, 742, 558, 742)
        
        # Footer
        self.line(54, 45, 558, 45)
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 30, page_text)
        self.drawString(54, 30, "Project Showcase - Simple English Guide")
        self.restoreState()

def build_pdf(filename="CrowdCity_AI_Simple_Project_Showcase.pdf"):
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
        fontSize=24,
        leading=30,
        textColor=colors.HexColor("#0D9488"),
        spaceAfter=10
    )
    
    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=13,
        leading=17,
        textColor=colors.HexColor("#4b5563"),
        spaceAfter=25
    )

    h1_style = ParagraphStyle(
        'H1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=colors.HexColor("#111827"),
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'H2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11.5,
        leading=15,
        textColor=colors.HexColor("#0D9488"),
        spaceBefore=8,
        spaceAfter=5,
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
    story.append(Paragraph("CROWDCITY AI - SIMPLE GUIDE", title_style))
    story.append(Paragraph("A Clear & Easy Explanation of How the Project Works, What We Built, and the Tools Used", subtitle_style))
    story.append(Spacer(1, 20))

    meta_data = [
        [Paragraph("<b>Student Name:</b>", body_style), Paragraph("Dhanush Raagav S", body_style)],
        [Paragraph("<b>Project Goal:</b>", body_style), Paragraph("Make it easy for citizens to report local issues and apply for government schemes.", body_style)],
        [Paragraph("<b>Core Stack:</b>", body_style), Paragraph("HTML, CSS, JavaScript, Node.js (Express), Supabase Database, Groq AI", body_style)],
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
    
    story.append(Spacer(1, 180))
    story.append(Paragraph("<b>Prepared for HR Interview & Presentation</b>", subtitle_style))
    story.append(PageBreak())

    # ================= PAGE 2: WHY CHOOSE & TECH STACK =================
    story.append(Paragraph("1. Why I Built This Project", h1_style))
    story.append(Paragraph(
        "Usually, people in towns and cities face two big problems:<br/>"
        "1. <b>Local Problems:</b> When streetlights are broken, roads are damaged, or garbage is not collected, it is hard to complain to the right office. It takes too long to get solved.<br/>"
        "2. <b>Government Schemes:</b> The government has many helpful welfare schemes (like Pudhumai Penn, Kalaignar Magalir Urimai Thittam) that give money or educational support. But citizens do not know if they qualify, what documents they need, or how to apply.<br/><br/>"
        "<b>CrowdCity AI</b> is a single website that solves both problems. It lets citizens easily pin local problems on a map, and helps them discover and prepare applications for government schemes with simple AI help.",
        body_style
    ))
    story.append(Spacer(1, 10))

    story.append(Paragraph("2. Tools We Used (The Tech Stack)", h1_style))
    tech_data = [
        [Paragraph("<b>Tool</b>", h2_style), Paragraph("<b>What We Used It For (Simple Terms)</b>", h2_style)],
        [Paragraph("<b>HTML, CSS, JS</b>", body_style), Paragraph("To design the look of the website, cards, menus, and pages.", body_style)],
        [Paragraph("<b>Leaflet.js Map</b>", body_style), Paragraph("To show an interactive map where users click to report local issues.", body_style)],
        [Paragraph("<b>Node.js & Express</b>", body_style), Paragraph("The background system that connects the website to the database and AI.", body_style)],
        [Paragraph("<b>Supabase Database</b>", body_style), Paragraph("To save user information, uploaded documents, and track applications safely.", body_style)],
        [Paragraph("<b>Groq AI</b>", body_style), Paragraph("The smart AI model (Llama 3.3) that answers user questions and checks documents.", body_style)]
    ]
    t_tech = Table(tech_data, colWidths=[120, 380])
    t_tech.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#f3f4f6")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e5e7eb")),
        ('PADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t_tech)
    
    story.append(Spacer(1, 10))
    story.append(Paragraph("3. AI Coding Agent Partnership", h1_style))
    story.append(Paragraph(
        "I worked alongside an AI coding assistant named <b>Google Antigravity AI</b>. "
        "The agent helped write code, check for database errors, configure secure connections, and make sure the page translations worked instantly.",
        body_style
    ))
    story.append(PageBreak())

    # ================= PAGE 3: CONTRIBUTIONS V1 & V2 =================
    story.append(Paragraph("4. What We Built (Main Features)", h1_style))
    
    story.append(Paragraph("Phase 1: Local Issue Reporting (Version 1)", h2_style))
    story.append(Paragraph("• <b>File a Complaint:</b> Users write their issue, pick a category, and upload a picture.", bullet_style))
    story.append(Paragraph("• <b>Live Map:</b> Shows complaint markers on a map so citizens can see active local issues.", bullet_style))
    story.append(Paragraph("• <b>Officer Portal:</b> A separate login for officers to view complaints and mark them as Solved.", bullet_style))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Phase 2: Government Services Portal (Version 2)", h2_style))
    story.append(Paragraph("We built a fully working hub that helps citizens with 9 key features:", body_style))
    story.append(Paragraph("1. <b>Citizen Dashboard:</b> A dashboard showing saved schemes, uploaded documents, and activity.", bullet_style))
    story.append(Paragraph("2. <b>Scheme Eligibility Checker:</b> Enter your age, income, and district to find qualifying schemes.", bullet_style))
    story.append(Paragraph("3. <b>AI Government Assistant:</b> A friendly chat tool where you ask anything about scheme rules.", bullet_style))
    story.append(Paragraph("4. <b>Document Wallet:</b> Save your Aadhaar or PAN card. Click View to open it safely in the browser.", bullet_style))
    story.append(Paragraph("5. <b>AI Document Quality Checker:</b> Upload documents, and the AI checks if they are clean and readable.", bullet_style))
    story.append(Paragraph("6. <b>AI Form Filler Guide:</b> Step-by-step tips on how to fill out government application forms.", bullet_style))
    story.append(Paragraph("7. <b>Office Locator:</b> Maps nearby e-Sevai centers, Taluk offices, and Collectorates.", bullet_style))
    story.append(Paragraph("8. <b>Application Tracker:</b> Log and monitor applications you submitted on official portals.", bullet_style))
    story.append(Paragraph("9. <b>Smart Reminders:</b> Get alerts before your documents expire or when you have appointments.", bullet_style))
    story.append(Spacer(1, 10))

    story.append(Paragraph("5. Polishing the Platform", h1_style))
    story.append(Paragraph(
        "• <b>Quick Command Search (Ctrl + K):</b> Press Ctrl+K to open a search bar to jump to any page instantly.<br/>"
        "• <b>Error Resilience:</b> Clean, user-friendly 404 (Page Not Found), 500 (Server Error), and Offline pages.<br/>"
        "• <b>Full Language Support:</b> Supports instant switching between English and Tamil for all pages.",
        body_style
    ))
    
    doc.build(story, canvasmaker=NumberedCanvas)

if __name__ == "__main__":
    build_pdf()
    print("Simplified project showcase PDF created successfully as CrowdCity_AI_Simple_Project_Showcase.pdf")
