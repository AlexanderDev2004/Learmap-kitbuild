/** Minimal shape needed for Aiken export — accepts QuestionOutput or builder drafts. */
export type AikenSourceQuestion = {
	type: string;
	questionText: string;
	options: unknown;
};

/**
 * Convert teacher MCQ questions to Moodle Aiken format.
 *
 * Rules (https://docs.moodle.org/4x/en/Aiken_format):
 * - Question text on one line.
 * - Each answer option prefixed "A. ", "B. ", "C. ", ... on its own line.
 * - "ANSWER: X" after the options, X = letter of the correct option.
 * - Blank line between questions. UTF-8 plain text.
 *
 * Accepts any question shape (server QuestionOutput or builder drafts);
 * non-MCQ questions (likert/text) and malformed entries are skipped because
 * Aiken only supports multiple choice. Multi-line texts are flattened to
 * single lines to keep the file parseable; leading option-like patterns in
 * option text (e.g. "B.") are rewritten so Moodle's parser is not confused.
 */
export function toAikenFormat(questions: ReadonlyArray<unknown>): string {
	const blocks: string[] = [];

	for (const raw of questions) {
		const question = raw as AikenSourceQuestion | null;
		if (!question || question.type !== "mcq") continue;
		const options = question.options as
			| {
					type?: string;
					options?: Array<{ id: string; text: string }>;
					correctOptionIds?: string[];
			  }
			| null
			| undefined;
		if (!options || options.type !== "mcq") continue;
		if (!options.options || options.options.length === 0) continue;
		if (!options.correctOptionIds || options.correctOptionIds.length === 0) continue;

		const correctIndex = options.options.findIndex((opt) =>
			options.correctOptionIds?.includes(opt.id),
		);
		if (correctIndex < 0) continue;

		const letter = (index: number) => String.fromCharCode(65 + index);

		// Flatten newlines; a question line that itself starts with an
		// option-like pattern ("B. ") could confuse Moodle's parser, so
		// option text with such a prefix is rewritten ("B." -> "B-").
		const questionText = flatten(question.questionText);
		const optionLines = options.options.map((opt, index) => {
			const text = flatten(opt.text).replace(/^([A-Za-z])[.)]\s+/, "$1- ");
			return `${letter(index)}. ${text}`;
		});
		const answerLine = `ANSWER: ${letter(correctIndex)}`;

		blocks.push([questionText, ...optionLines, answerLine].join("\n"));
	}

	return blocks.join("\n\n") + (blocks.length > 0 ? "\n" : "");
}

function flatten(text: string): string {
	return text.replace(/\s*\r?\n\s*/g, " ").trim();
}

export function downloadAikenFile(input: { formTitle: string; content: string }) {
	const safeName =
		input.formTitle
			.replace(/[^\p{L}\p{N}\s-]/gu, "")
			.trim()
			.replace(/\s+/g, "-")
			.toLowerCase() || "form";
	const blob = new Blob([input.content], { type: "text/plain;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = `${safeName}-aiken.txt`;
	document.body.appendChild(anchor);
	anchor.click();
	document.body.removeChild(anchor);
	URL.revokeObjectURL(url);
}
