import { Schema } from "effect";
import Papa from "papaparse";
import { describe, expect, it } from "vite-plus/test";

import { whitelistCsvParseOptions } from "./whitelist-service.mutations";
import { WhitelistCsvRow, WhitelistImportFailedError } from "./whitelist-service.shared";

function assertParses(value: unknown) {
	return Schema.decodeUnknownSync(WhitelistCsvRow)(value);
}

function assertFails(value: unknown) {
	expect(() => Schema.decodeUnknownSync(WhitelistCsvRow)(value)).toThrow();
}

describe("WhitelistCsvRow schema", () => {
	it("should validate a valid CSV row", () => {
		const row = assertParses({ studentId: "s12345", name: "Alice" });
		expect(row.studentId).toBe("s12345");
		expect(row.name).toBe("Alice");
		expect(row.cohortId).toBeUndefined();
	});

	it("should reject row with empty studentId", () => {
		assertFails({ studentId: "", name: "Alice" });
	});

	it("should reject row with empty name", () => {
		assertFails({ studentId: "s12345", name: "" });
	});

	it("should accept row with optional cohortId", () => {
		const row = assertParses({ studentId: "s12345", name: "Alice", cohortId: "c1" });
		expect(row.cohortId).toBe("c1");
	});

	it("should accept row with null cohortId", () => {
		const row = assertParses({ studentId: "s12345", name: "Alice", cohortId: null });
		// nullable with optionalWith converts null to undefined
		expect(row.cohortId).toBeUndefined();
	});

	it("should accept row with studyGroup experiment", () => {
		const row = assertParses({ studentId: "s12345", name: "Alice", studyGroup: "experiment" });
		expect(row.studyGroup).toBe("experiment");
	});

	it("should accept row with studyGroup control", () => {
		const row = assertParses({ studentId: "s12345", name: "Alice", studyGroup: "control" });
		expect(row.studyGroup).toBe("control");
	});

	it("should accept row without studyGroup", () => {
		const row = assertParses({ studentId: "s12345", name: "Alice" });
		expect(row.studyGroup).toBeUndefined();
	});

	it("should accept row with null studyGroup", () => {
		const row = assertParses({ studentId: "s12345", name: "Alice", studyGroup: null });
		expect(row.studyGroup).toBeUndefined();
	});

	it("should reject row with unknown studyGroup value", () => {
		assertFails({ studentId: "s12345", name: "Alice", studyGroup: "banana" });
	});
});

describe("whitelistCsvParseOptions", () => {
	it("should parse semicolon-separated CSV (Excel Indonesian locale)", () => {
		const csv = [
			"Student ID;Name;Cohort;Group",
			"2210001;Budi Santoso;;experiment",
			"2210002;Siti Aminah;;control",
			"2210003;Andi Wijaya;;",
		].join("\n");

		const parsed = Papa.parse<Record<string, unknown>>(csv, whitelistCsvParseOptions);
		expect(parsed.errors).toHaveLength(0);
		expect(parsed.data).toHaveLength(3);
		expect(parsed.data[0]?.["studentid"]).toBe("2210001");
		expect(parsed.data[0]?.["name"]).toBe("Budi Santoso");
		expect(parsed.data[0]?.["group"]).toBe("experiment");
		expect(parsed.data[2]?.["group"]).toBe("");
	});

	it("should parse comma-separated CSV (other locales)", () => {
		const csv = ["Student ID,Name,Cohort,Group", "2210001,Budi Santoso,,experiment"].join("\n");

		const parsed = Papa.parse<Record<string, unknown>>(csv, whitelistCsvParseOptions);
		expect(parsed.errors).toHaveLength(0);
		expect(parsed.data[0]?.["studentid"]).toBe("2210001");
		expect(parsed.data[0]?.["group"]).toBe("experiment");
	});
});

describe("WhitelistImportFailedError", () => {
	it("should create error with message", () => {
		const error = new WhitelistImportFailedError({ message: "Failed to parse CSV" });
		expect(error._tag).toBe("WhitelistImportFailedError");
		expect(error.message).toBe("Failed to parse CSV");
	});
});
