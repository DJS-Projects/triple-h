// --- Upload request types ---

export type Provider = "local" | "cloud";
export type OcrModel = "1" | "2" | "3";

export interface UploadOptions {
	provider?: Provider;
	model?: string;
	ocrModel?: OcrModel;
	confidenceScore?: number;
}

// --- Response types ---

export interface DocumentAnalysis {
	detected_types: string[];
	is_mixed: boolean;
}

export interface TokenUsage {
	input_tokens: number;
	output_tokens: number;
}

export interface DeliveryOrderItem {
	description: string;
	quantity: string;
	weight_mt?: string;
}

export interface DeliveryOrderData {
	"D/O issuer name"?: string;
	"sold to"?: string;
	"sold to (address)"?: string;
	"delivered to"?: string;
	"delivered to (address)"?: string;
	"D/O number"?: string[];
	"P/O number"?: string[];
	"Vehicle number"?: string[];
	date?: string[];
	items?: DeliveryOrderItem[];
	total_quantity?: string;
	total_weight_mt?: string;
	"good description"?: string[];
	quantity?: string[];
}

export interface WeighingBillData {
	weighing_no?: string;
	contract_no?: string;
	vehicle_no?: string;
	gross_weight?: string;
	tare_weight?: string;
	net_weight?: string;
	off_weight?: string;
	actual_weight?: string;
	gross_time?: string;
}

export interface InvoiceItem {
	description: string;
	quantity: string;
	unit_price: string;
	amount: string;
}

export interface InvoiceData {
	invoice_number?: string;
	invoice_date?: string;
	bill_to?: string;
	ship_to?: string;
	items?: InvoiceItem[];
	subtotal?: string;
	tax?: string;
	total?: string;
}

export interface MixedParsedInfo {
	delivery_order_data?: DeliveryOrderData;
	weighing_bill_data?: WeighingBillData;
	invoice_data?: InvoiceData;
}

export interface UploadSuccessResponse {
	status: "ok";
	parsed_info: DeliveryOrderData | MixedParsedInfo;
	document_analysis: DocumentAnalysis;
	chunks_indexed: number;
	file_id: string;
	file_hash: string;
	file_metadata: Record<string, unknown>;
	provider_used: string;
	model_used: string;
	ocr_model: string;
	ocr_model_name: string;
	confidence_score: number;
	token_usage: TokenUsage;
	processing_time: number;
}

export interface UploadErrorResponse {
	status: "error";
	message: string;
	debug_info?: Record<string, unknown>;
}

export type UploadResponse = UploadSuccessResponse | UploadErrorResponse;
