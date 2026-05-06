async function verifyIntake() {
    console.log("=== Vitae Health Onboarding & Intake Verification ===");
    const API = "http://localhost:3000/api/v1";

    const mockAuthHeaderPatient = "Bearer test_patient_id_1:Patient";
    const mockAuthHeaderDoctor = "Bearer test_doc_id_1:Doctor";

    try {
        console.log("\n1. Testing Onboarding Profile Creation...");
        const profileRes = await fetch(`${API}/onboarding/profile`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": mockAuthHeaderPatient },
            body: JSON.stringify({
                fullName: "John Doe",
                dob: "1990-01-01",
                address: { street: "123 Main St", city: "NYC", zip: "10001" },
                stateOfResidence: "NY"
            })
        });
        console.log("Status:", profileRes.status, await profileRes.json());

        console.log("\n2. Testing Intake Start (ED Vertical)...");
        const startRes = await fetch(`${API}/intake/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": mockAuthHeaderPatient },
            body: JSON.stringify({ vertical: "ED" })
        });
        const startData = (await startRes.json()) as any;
        console.log("Status:", startRes.status, startData);

        const intakeId = startData.data?.intakeId;
        if (!intakeId) throw new Error("Intake ID missing!");

        console.log(`\n3. Testing Step Submission for Intake ${intakeId}...`);
        const stepRes = await fetch(`${API}/intake/${intakeId}/step/1`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": mockAuthHeaderPatient },
            body: JSON.stringify({
                personalDetails: { ageYears: 25, gender: "MALE" },
                currentMedications: { includesNitrates: false },
                medicalHistory: { recentMI: false } // No hard exclusions passed
            })
        });
        console.log("Status:", stepRes.status, await stepRes.json());

        console.log("\n4. Testing Full Submission...");
        const submitRes = await fetch(`${API}/intake/${intakeId}/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": mockAuthHeaderPatient }
        });
        console.log("Status:", submitRes.status, await submitRes.json());

        console.log("\n5. Doctor Fetching Intake...");
        const docGetRes = await fetch(`${API}/intake/${intakeId}`, {
            method: "GET",
            headers: { "Authorization": mockAuthHeaderDoctor }
        });
        const docData = await docGetRes.json();
        console.log("Status:", docGetRes.status);
        console.dir(docData, { depth: null }); // Ensure redaction logic is respected

        console.log("\n6. Doctor Unlocking Intake...");
        const unlockRes = await fetch(`${API}/intake/${intakeId}/unlock`, {
            method: "PUT",
            headers: { "Authorization": mockAuthHeaderDoctor }
        });
        console.log("Status:", unlockRes.status, await unlockRes.json());

        console.log("\nVerification suite finished!");
    } catch (e) {
        console.error("Test blocked Error:", e);
    }
}

verifyIntake();
