import puppeteer from "puppeteer";

interface PDFData {
  patientName: string;
  patientDob: string;
  doctorName: string;
  registrationNum: string;
  drugName: string;
  doseMg: number | string;
  frequency: string;
  quantity: number;
  digitalSig: string;
  issuedAt: string;
  expiresAt: string;
}


// Generates a high-quality clinical PDF with a background watermark and digital signature footer
export async function generatePrescriptionPDF(data: PDFData): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 40px;
            color: #333333;
            line-height: 1.5;
            position: relative;
            background-color: #ffffff;
          }
          
          /* Faint diagonal background watermark */
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 40px;
            color: rgba(220, 220, 220, 0.2);
            font-weight: bold;
            white-space: nowrap;
            pointer-events: none;
            z-index: 0;
            text-align: center;
          }

          .container {
            position: relative;
            z-index: 1;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 30px;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }

          .logo-area h1 {
            margin: 0;
            color: #007bff;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: 0.5px;
          }

          .logo-area p {
            margin: 2px 0 0 0;
            font-size: 12px;
            color: #666666;
            text-transform: uppercase;
          }

          .rx-title {
            font-size: 36px;
            color: #e0e0e0;
            font-weight: 900;
          }

          .section {
            margin-bottom: 25px;
          }

          .section-title {
            font-size: 14px;
            font-weight: bold;
            text-transform: uppercase;
            color: #007bff;
            margin-bottom: 8px;
            border-bottom: 1px solid #f0f0f0;
            padding-bottom: 4px;
          }

          .grid-2 {
            display: flex;
            gap: 20px;
            margin-bottom: 15px;
          }

          .grid-2 > div {
            flex: 1;
          }

          p.info-row {
            margin: 4px 0;
            font-size: 14px;
          }

          .info-label {
            font-weight: bold;
            color: #555555;
          }

          .rx-details {
            background-color: #f8f9fa;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
            border-left: 4px solid #28a745;
          }

          .drug-name {
            font-size: 20px;
            font-weight: bold;
            color: #333333;
            margin: 0 0 8px 0;
          }

          .footer {
            margin-top: 50px;
            border-top: 1px solid #e0e0e0;
            padding-top: 20px;
            text-align: center;
          }

          .sig-box {
            font-family: 'Courier New', Courier, monospace;
            background-color: #f1f3f5;
            border: 1px dashed #ced4da;
            padding: 10px;
            border-radius: 4px;
            font-size: 12px;
            color: #495057;
            word-break: break-all;
            margin-top: 15px;
          }

          .signature-label {
            font-size: 12px;
            color: #868e96;
            margin-bottom: 5px;
          }
        </style>
      </head>
      <body>
        <div class="watermark">OFFICIAL HELIOCARE PRESCRIPTION</div>
        <div class="container">
          <div class="header">
            <div class="logo-area">
              <h1>Heliocare</h1>
              <p>Clinical Fulfillment System</p>
            </div>
            <div class="rx-title">R<sub>x</sub></div>
          </div>

          <div class="section">
            <div class="section-title">Patient Information</div>
            <div class="grid-2">
              <div>
                <p class="info-row"><span class="info-label">Name:</span> ${data.patientName}</p>
                <p class="info-row"><span class="info-label">DOB:</span> ${data.patientDob}</p>
              </div>
              <div>
                <p class="info-row"><span class="info-label">Issued Date:</span> ${data.issuedAt}</p>
                <p class="info-row"><span class="info-label">Expiry Date:</span> ${data.expiresAt}</p>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Prescriber Details</div>
            <p class="info-row"><span class="info-label">Prescriber:</span> Dr. ${data.doctorName}</p>
            <p class="info-row"><span class="info-label">Registration No:</span> ${data.registrationNum} (MDCN)</p>
          </div>

          <div class="section">
            <div class="section-title">Medication Prescribed</div>
            <div class="rx-details">
              <h2 class="drug-name">${data.drugName}</h2>
              <p class="info-row"><span class="info-label">Dosage:</span> ${data.doseMg} mg</p>
              <p class="info-row"><span class="info-label">Frequency:</span> ${data.frequency}</p>
              <p class="info-row"><span class="info-label">Quantity:</span> Dispense ${data.quantity} units</p>
            </div>
          </div>

          <div class="footer">
            <p class="signature-label">SECURE DIGITAL SIGNATURE HASH (HMAC-SHA256)</p>
            <div class="sig-box">${data.digitalSig}</div>
            <p style="font-size: 11px; color: #868e96; margin-top: 15px;">
              This is a digitally signed clinical document. Verify authenticity using the secure hash above.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20mm",
        right: "20mm",
        bottom: "20mm",
        left: "20mm",
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
