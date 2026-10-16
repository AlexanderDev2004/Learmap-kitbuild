import { describe, expect, it } from "vite-plus/test";

import { fromAikenFormat, toAikenFormat } from "@/features/form/lib/form-aiken";
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

describe("fromAikenFormat", () => {
	const SAMPLE = [
		"Siapa yang mengembangkan Java?",
		"A. James Gosling",
		"B. Dennis Ritchie",
		"C. Guido van Rossum",
		"ANSWER: A",
		"",
		"Hasil kompilasi Java berupa ...",
		"A. Bytecode (.class)",
		"B. Machine code (.exe)",
		"ANSWER: B",
	].join("\n");

	it("parses multiple blocks into MCQ questions with correct answers", () => {
		const result = fromAikenFormat(SAMPLE);
		expect(result.questions).toHaveLength(2);
		expect(result.errors).toEqual([]);
		expect(result.questions[0].questionText).toBe("Siapa yang mengembangkan Java?");
		expect(result.questions[0].options.type).toBe("mcq");
		expect(result.questions[0].options.options).toHaveLength(3);
		expect(result.questions[0].options.correctOptionIds[0]).toBe(
			result.questions[0].options.options[0].id,
		);
		expect(result.questions[1].options.correctOptionIds[0]).toBe(
			result.questions[1].options.options[1].id,
		);
	});

	it("skips blocks without ANSWER and reports why", () => {
		const result = fromAikenFormat(
			[
				"Soal tanpa kunci?",
				"A. Satu",
				"B. Dua",
				"",
				"Soal lengkap?",
				"A. Ya",
				"B. Tidak",
				"ANSWER: B",
			].join("\n"),
		);
		expect(result.questions).toHaveLength(1);
		expect(result.questions[0].questionText).toBe("Soal lengkap?");
		expect(result.errors[0]).toContain("tidak ada baris ANSWER");
	});

	it("skips blocks whose ANSWER letter is outside the option range", () => {
		const result = fromAikenFormat(["Soal?", "A. Satu", "B. Dua", "ANSWER: D"].join("\n"));
		expect(result.questions).toHaveLength(0);
		expect(result.errors[0]).toContain("ANSWER: D");
	});

	it("accepts A) style prefixes and lowercase answer letters", () => {
		const result = fromAikenFormat(["Soal?", "A) Satu", "B) Dua", "answer: b"].join("\n"));
		expect(result.questions).toHaveLength(1);
		expect(result.questions[0].options.correctOptionIds[0]).toBe(
			result.questions[0].options.options[1].id,
		);
	});

	it("round-trips output of toAikenFormat back into equivalent questions", () => {
		const questions = [
			mcq(),
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
		];
		const result = fromAikenFormat(toAikenFormat(questions));
		expect(result.questions).toHaveLength(2);
		expect(result.errors).toEqual([]);
		expect(result.questions[0].questionText).toBe(questions[0].questionText);
		expect(result.questions[0].options.options.map((o) => o.text)).toEqual([
			"James Gosling",
			"Dennis Ritchie",
			"Guido van Rossum",
		]);
	});

	it("returns empty result for empty input", () => {
		const result = fromAikenFormat("");
		expect(result.questions).toHaveLength(0);
		expect(result.errors).toHaveLength(0);
	});
});
