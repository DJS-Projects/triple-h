import type { DeliveryOrderData } from "@/lib/types";

interface Props {
	data: DeliveryOrderData;
}

export function DeliveryOrderResult({ data }: Props) {
	return (
		<div className="space-y-4">
			<h3 className="text-lg font-semibold">Delivery Order</h3>

			<div className="grid gap-3 sm:grid-cols-2">
				<Field label="D/O Issuer" value={data["D/O issuer name"]} />
				<Field label="Sold To" value={data["sold to"]} />
				<Field label="Sold To (Address)" value={data["sold to (address)"]} />
				<Field label="Delivered To" value={data["delivered to"]} />
				<Field label="Delivered To (Address)" value={data["delivered to (address)"]} />
				<Field label="D/O Number" value={data["D/O number"]?.join(", ")} />
				<Field label="P/O Number" value={data["P/O number"]?.join(", ")} />
				<Field label="Vehicle Number" value={data["Vehicle number"]?.join(", ")} />
				<Field label="Date" value={data.date?.join(", ")} />
				<Field label="Total Quantity" value={data.total_quantity} />
				<Field label="Total Weight (MT)" value={data.total_weight_mt} />
			</div>

			{data.items && data.items.length > 0 && (
				<div>
					<h4 className="mb-2 text-sm font-medium text-gray-700">Items</h4>
					<div className="overflow-x-auto rounded-lg border">
						<table className="w-full text-left text-sm">
							<thead className="bg-gray-50">
								<tr>
									<th className="px-4 py-2 font-medium">Description</th>
									<th className="px-4 py-2 font-medium">Quantity</th>
									<th className="px-4 py-2 font-medium">Weight (MT)</th>
								</tr>
							</thead>
							<tbody className="divide-y">
								{data.items.map((item) => (
									<tr key={`${item.description}-${item.quantity}`}>
										<td className="px-4 py-2">{item.description}</td>
										<td className="px-4 py-2">{item.quantity}</td>
										<td className="px-4 py-2">{item.weight_mt ?? "—"}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}
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
