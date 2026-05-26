import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { generatePrescriptionPDF } from "../src/lib/pdf/prescription.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const signingSecret = process.env.CLINICAL_SIGNING_SECRET || "mock-secret-for-visual-test";
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const payload = [
    "pat-001-uuid-mock",
    "doc-001-uuid-mock",
    "Semaglutide (Ozempic)",
    "0.25",
    "Once weekly",
    "4",
    issuedAt,
    "v1",
  ].join("|");

  const digitalSig = crypto.createHmac("sha256", signingSecret).update(payload).digest("hex");

  const pdfBuffer = await generatePrescriptionPDF({
    patientName: "James Patient",
    patientDob: "1990-01-15",
    doctorName: "Dr. Jane Prescriber",
    registrationNum: "MDCN-42-78901",
    drugName: "Semaglutide (Ozempic)",
    doseMg: 0.25,
    frequency: "Once weekly",
    quantity: 4,
    digitalSig,
    issuedAt: new Date(issuedAt).toLocaleDateString(),
    expiresAt: new Date(expiresAt).toLocaleDateString(),
  });

  const outputPath = path.resolve(__dirname, "..", "mock-prescription-output.pdf");
  fs.writeFileSync(outputPath, pdfBuffer);

  console.log(`PDF generated successfully.`);
  console.log(`Puppeteer returned ${(pdfBuffer.length / 1024).toFixed(1)} KB.`);
  console.log(`Saved to: ${outputPath}`);
}

main().catch((err) => {
  console.error("PDF generation failed:", err);
  process.exit(1);
});
