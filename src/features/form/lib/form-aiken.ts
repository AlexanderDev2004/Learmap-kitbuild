import type { McqOptions } from "./form-service.shared";

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

/** A parsed MCQ question ready to be appended to the builder. */
export type AikenImportedQuestion = {
	questionText: string;
	options: McqOptions;
};

export type AikenParseResult = {
	questions: AikenImportedQuestion[];
	/** Human-readable reasons why some blocks were skipped, shown after import. */
	errors: string[];
};

const OPTION_LINE = /^([A-Za-z])[.)-]\s+(.+)$/;
const ANSWER_LINE = /^ANSWER\s*:\s*([A-Za-z])\s*$/i;

/**
 * Parse a Moodle Aiken file into MCQ questions for the form builder.
 *
 * Blocks are separated by blank lines. Each block needs a question line,
 * at least two option lines ("A. text", "B. text", ...) and an
 * "ANSWER: X" line. Blocks that violate this are skipped and reported in
 * `errors` so the teacher knows what was left out. "A- text" style option
 * prefixes are also accepted so files exported by `toAikenFormat` can be
 * re-imported unchanged.
 */
export function fromAikenFormat(content: string): AikenParseResult {
	const questions: AikenImportedQuestion[] = [];
	const errors: string[] = [];

	type Block = {
		questionText: string;
		options: Array<{ id: string; text: string }>;
		answer?: string;
	};

	const blocks: Block[] = [];
	let current: Block | null = null;

	const closeBlock = () => {
		if (current) blocks.push(current);
		current = null;
	};

	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line) {
			closeBlock();
			continue;
		}
		const answerMatch = ANSWER_LINE.exec(line);
		const optionMatch = OPTION_LINE.exec(line);
		if (answerMatch) {
			if (!current) {
				errors.push(`Baris "${line}" dilewati karena muncul sebelum teks soal.`);
				continue;
			}
			current.answer = answerMatch[1].toUpperCase();
		} else if (optionMatch) {
			if (!current) current = { questionText: "", options: [] };
			current.options.push({
				id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
				text: optionMatch[2].trim(),
			});
		} else {
			if (current && current.options.length > 0) closeBlock();
			if (!current) current = { questionText: "", options: [] };
			current.questionText = current.questionText ? `${current.questionText} ${line}` : line;
		}
	}
	closeBlock();

	for (const block of blocks) {
		const label = truncate(block.questionText || "(tanpa teks soal)");
		if (!block.questionText.trim()) {
			errors.push(`Soal "${label}" dilewati: teks soal kosong.`);
			continue;
		}
		if (block.options.length < 2) {
			errors.push(`Soal "${label}" dilewati: butuh minimal 2 opsi jawaban.`);
			continue;
		}
		if (!block.answer) {
			errors.push(`Soal "${label}" dilewati: tidak ada baris ANSWER.`);
			continue;
		}
		const correctIndex = block.answer.charCodeAt(0) - 65;
		if (correctIndex < 0 || correctIndex >= block.options.length) {
			errors.push(
				`Soal "${label}" dilewati: ANSWER: ${block.answer} tidak cocok dengan opsi yang ada.`,
			);
			continue;
		}
		questions.push({
			questionText: block.questionText,
			options: {
				type: "mcq",
				options: block.options,
				correctOptionIds: [block.options[correctIndex].id],
				shuffle: false,
			},
		});
	}

	return { questions, errors };
}

function truncate(text: string): string {
	return text.length > 40 ? `${text.slice(0, 40)}…` : text;
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
