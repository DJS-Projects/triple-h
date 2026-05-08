/**
 * Split an extraction object into:
 *   - scalars  : flat KVP rows for the editor (top-level + len-1 array unwrap)
 *   - tables   : `list[object]` fields rendered as their own data tables
 *
 * Path uses dot notation. Multi-value scalar arrays serialise as comma-joined
 * display strings so they fit one row; on edit, user can re-split client-side
 * before save.
 */
export type LeafValue = string | number | boolean | null;

export interface KvpRow {
	path: string;
	value: LeafValue;
	leafType: "string" | "number" | "boolean" | "null";
}

export interface TableSection {
	path: string;
	columns: string[];
	rows: Array<Record<string, LeafValue>>;
}

export interface SplitExtraction {
	scalars: KvpRow[];
	tables: TableSection[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

function leafType(v: LeafValue): KvpRow["leafType"] {
	if (v === null) return "null";
	const t = typeof v;
	if (t === "string" || t === "number" || t === "boolean") return t;
	return "null";
}

function asLeaf(v: unknown): LeafValue {
	if (v === null || v === undefined) return null;
	const t = typeof v;
	if (t === "string" || t === "number" || t === "boolean") return v as LeafValue;
	return null;
}

export function splitExtraction(obj: unknown): SplitExtraction {
	const scalars: KvpRow[] = [];
	const tables: TableSection[] = [];

	if (!isPlainObject(obj)) return { scalars, tables };

	for (const [key, raw] of Object.entries(obj)) {
		// Plain scalar.
		if (raw === null || ["string", "number", "boolean"].includes(typeof raw)) {
			const v = asLeaf(raw);
			scalars.push({ path: key, value: v, leafType: leafType(v) });
			continue;
		}

		// Array — three sub-cases.
		if (Array.isArray(raw)) {
			// Empty list → render as null scalar so the field still shows.
			if (raw.length === 0) {
				scalars.push({ path: key, value: null, leafType: "null" });
				continue;
			}

			// list[object] → real table.
			if (raw.every(isPlainObject)) {
				const colSet = new Set<string>();
				for (const r of raw) for (const k of Object.keys(r)) colSet.add(k);
				const columns = [...colSet];
				const rows = raw.map((r) => {
					const row: Record<string, LeafValue> = {};
					for (const c of columns) row[c] = asLeaf(r[c]);
					return row;
				});
				tables.push({ path: key, columns, rows });
				continue;
			}

			// list[scalar] — len 1 unwraps to scalar; len>1 joins for display.
			if (raw.length === 1) {
				const v = asLeaf(raw[0]);
				scalars.push({ path: key, value: v, leafType: leafType(v) });
				continue;
			}
			const joined = raw.map((v) => (v === null ? "" : String(v))).join(", ");
			scalars.push({ path: key, value: joined, leafType: "string" });
			continue;
		}

		// Nested object — flatten one level under `key.`.
		if (isPlainObject(raw)) {
			for (const [k2, v2] of Object.entries(raw)) {
				if (v2 === null || ["string", "number", "boolean"].includes(typeof v2)) {
					const v = asLeaf(v2);
					scalars.push({
						path: `${key}.${k2}`,
						value: v,
						leafType: leafType(v),
					});
				}
			}
		}
	}

	return { scalars, tables };
}

export function coerceEdited(
	original: LeafValue,
	raw: string,
): LeafValue {
	if (raw === "") return null;
	if (typeof original === "number") {
		const n = Number(raw);
		return Number.isFinite(n) ? n : raw;
	}
	if (typeof original === "boolean") {
		const lower = raw.toLowerCase();
		if (lower === "true") return true;
		if (lower === "false") return false;
		return raw;
	}
	return raw;
}
