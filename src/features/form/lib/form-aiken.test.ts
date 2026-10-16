import { describe, expect, it } from "vite-plus/test";

import { toAikenFormat } from "@/features/form/lib/form-aiken";
import type { QuestionOutput } from "@/features/form/lib/form-service.shared";

function mcq(overrides: Partial<QuestionOutput> = {}): QuestionOutput {
	return {
		id: "q1",
		formId: "f1",
		type: "mcq",
		questionText: "Siapa yang mengembangkan Java?",
		options: {
			type: "mcq",
			options: [
				{ id: "opt1", text: "James Gosling" },
				{ id: "opt2", text: "Dennis Ritchie" },
				{ id: "opt3", text: "Guido van Rossum" },
			],
			correctOptionIds: ["opt2"],
			shuffle: true,
		},
		orderIndex: 0,
		required: true,
		createdAt: Date.now(),
		updatedAt: Date.now(),
		...overrides,
	} as QuestionOutput;
}

describe("toAikenFormat", () => {
	it("converts a single MCQ question with ANSWER letter", () => {
		const output = toAikenFormat([mcq()]);
		expect(output).toBe(
			"Siapa yang mengembangkan Java?\nA. James Gosling\nB. Dennis Ritchie\nC. Guido van Rossum\nANSWER: B\n",
		);
	});

	it("separates multiple questions with a blank line and keeps order", () => {
		const output = toAikenFormat([
			mcq({ id: "q1", orderIndex: 0 }),
			mcq({
				id: "q2",
				orderIndex: 1,
				questionText: "Hasil kompilasi Java berupa ...",
				options: {
					type: "mcq",
					options: [
						{ id: "a", text: "Bytecode (.class)" },
						{ id: "b", text: "Machine code (.exe)" },
					],
					correctOptionIds: ["a"],
					shuffle: false,
				},
			} as Partial<QuestionOutput>),
		]);
		expect(output).toContain(
			"ANSWER: B\n\nHasil kompilasi Java berupa ...\nA. Bytecode (.class)\nB. Machine code (.exe)\nANSWER: A\n",
		);
	});

	it("skips likert and text questions (Aiken only supports MCQ)", () => {
		const output = toAikenFormat([
			mcq(),
			{
				id: "q2",
				formId: "f1",
				type: "likert",
				questionText: "Pernyataan persepsi",
				options: {
					type: "likert",
					scaleSize: 5,
					labels: { "1": "STTS", "5": "SS" },
				},
				orderIndex: 1,
				required: true,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			} as unknown as QuestionOutput,
			{
				id: "q3",
				formId: "f1",
				type: "text",
				questionText: "Jelaskan JVM",
				options: null,
				orderIndex: 2,
				required: false,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			} as unknown as QuestionOutput,
		]);
		expect(output).not.toContain("Pernyataan persepsi");
		expect(output).not.toContain("Jelaskan JVM");
		expect(output).toContain("ANSWER: B");
	});

	it("skips MCQ without correct answers instead of emitting a broken block", () => {
		const output = toAikenFormat([
			mcq({
				options: {
					type: "mcq",
					options: [
						{ id: "a", text: "Satu" },
						{ id: "b", text: "Dua" },
					],
					correctOptionIds: [],
					shuffle: false,
				},
			} as Partial<QuestionOutput>),
		]);
		expect(output).toBe("");
	});

	it("flattens multi-line question text to one line", () => {
		const output = toAikenFormat([mcq({ questionText: "Baris pertama\nBaris kedua" })]);
		expect(output).toContain("Baris pertama Baris kedua");
		expect(output).not.toContain("\nBaris kedua");
	});

	it("neutralises option-like prefixes inside option text", () => {
		const output = toAikenFormat([
			mcq({
				options: {
					type: "mcq",
					options: [
						{ id: "a", text: "A. menipu" },
						{ id: "b", text: "B. jujur" },
					],
					correctOptionIds: ["b"],
					shuffle: false,
				},
			} as Partial<QuestionOutput>),
		]);
		expect(output).toContain("A. A- menipu");
		expect(output).toContain("B. B- jujur");
	});

	it("returns empty string when there are no MCQ questions", () => {
		expect(toAikenFormat([])).toBe("");
	});
});
