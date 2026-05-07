import { z } from "zod";

export const DOC_TYPES = [
	"delivery_order",
	"weighing_bill",
	"invoice",
	"petrol_bill",
] as const;

export type DocType = (typeof DOC_TYPES)[number];

export const DOC_TYPE_LABELS: Record<DocType, string> = {
	delivery_order: "Delivery Order",
	weighing_bill: "Weighing Bill",
	invoice: "Invoice",
	petrol_bill: "Petrol Bill",
};

export const uploadSchema = z.object({
	file: z
		.instanceof(File, { message: "Pick a PDF file" })
		.refine((f) => f.size > 0, "File is empty")
		.refine(
			(f) =>
				f.type === "application/pdf" ||
				f.name.toLowerCase().endsWith(".pdf"),
			"PDF only",
		),
	doc_type: z.enum(["", ...DOC_TYPES]).optional(),
});

export interface FieldEditInput {
	field_path: string;
	edited_value: string | number | boolean | null;
	remark?: string;
}
