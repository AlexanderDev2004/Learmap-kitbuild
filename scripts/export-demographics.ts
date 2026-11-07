import { createClient } from "@libsql/client";

const db = createClient({
	url: process.env.TURSO_DATABASE_URL!,
	authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function main() {
	// Get student demographic data
	const students = await db.execute(
		"SELECT email, name, age, motivation, study_group FROM user WHERE role = 'student' ORDER BY email",
	);

	console.log(`Total students: ${students.rows.length}`);

	let ageSum = 0,
		ageCount = 0;
	const studyGroupCount: Record<string, number> = {};

	console.log("\n=== STUDENT DEMOGRAPHICS ===");
	for (const s of students.rows) {
		const age = s.age as number | null;
		const group = (s.study_group as string) || "none";

		if (age !== null) {
			ageSum += age;
			ageCount++;
		}
		studyGroupCount[group] = (studyGroupCount[group] || 0) + 1;

		// Print first 5 as sample
		if (ageCount <= 5) {
			console.log(`  ${s.email}: age=${age}, group=${group}`);
		}
	}

	console.log(`\n=== DEMOGRAPHIC SUMMARY ===`);
	if (ageCount > 0) console.log(`Age: mean=${(ageSum / ageCount).toFixed(1)}, n=${ageCount}`);

	console.log(`\nStudy group distribution:`);
	for (const [k, v] of Object.entries(studyGroupCount).sort()) {
		console.log(`  ${k}: ${v}`);
	}

	// Student emails for matching with experiment data
	console.log(`\nAll student emails (for cross-reference):`);
	const studentEmails = students.rows.map((s: any) => s.email);
	console.log(studentEmails.join("\n"));
}

main().catch(console.error);
