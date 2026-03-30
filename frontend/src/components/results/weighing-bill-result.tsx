import type { WeighingBillData } from "@/lib/types";

interface Props {
	data: WeighingBillData;
}

export function WeighingBillResult({ data }: Props) {
	return (
		<div className="space-y-4">
			<h3 className="text-lg font-semibold">Weighing Bill</h3>
			<div className="grid gap-3 sm:grid-cols-2">
				<Field label="Weighing No" value={data.weighing_no} />
				<Field label="Contract No" value={data.contract_no} />
				<Field label="Vehicle No" value={data.vehicle_no} />
				<Field label="Gross Weight" value={data.gross_weight} />
				<Field label="Tare Weight" value={data.tare_weight} />
				<Field label="Net Weight" value={data.net_weight} />
				<Field label="Off Weight" value={data.off_weight} />
				<Field label="Actual Weight" value={data.actual_weight} />
				<Field label="Gross Time" value={data.gross_time} />
			</div>
		</div>
	);
}

function Field({ label, value }: { label: string; value?: string }) {
	if (!value) return null;
	return (
		<div>
			<p className="text-xs text-gray-500">{label}</p>
			<p className="text-sm">{value}</p>
		</div>
	);
}
