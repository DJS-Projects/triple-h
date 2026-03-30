import type { InvoiceData } from "@/lib/types";

interface Props {
	data: InvoiceData;
}

export function InvoiceResult({ data }: Props) {
	return (
		<div className="space-y-4">
			<h3 className="text-lg font-semibold">Invoice</h3>

			<div className="grid gap-3 sm:grid-cols-2">
				<Field label="Invoice Number" value={data.invoice_number} />
				<Field label="Invoice Date" value={data.invoice_date} />
				<Field label="Bill To" value={data.bill_to} />
				<Field label="Ship To" value={data.ship_to} />
				<Field label="Subtotal" value={data.subtotal} />
				<Field label="Tax" value={data.tax} />
				<Field label="Total" value={data.total} />
			</div>

			{data.items && data.items.length > 0 && (
				<div>
					<h4 className="mb-2 text-sm font-medium text-gray-700">Line Items</h4>
					<div className="overflow-x-auto rounded-lg border">
						<table className="w-full text-left text-sm">
							<thead className="bg-gray-50">
								<tr>
									<th className="px-4 py-2 font-medium">Description</th>
									<th className="px-4 py-2 font-medium">Qty</th>
									<th className="px-4 py-2 font-medium">Unit Price</th>
									<th className="px-4 py-2 font-medium">Amount</th>
								</tr>
							</thead>
							<tbody className="divide-y">
								{data.items.map((item) => (
									<tr key={`${item.description}-${item.amount}`}>
										<td className="px-4 py-2">{item.description}</td>
										<td className="px-4 py-2">{item.quantity}</td>
										<td className="px-4 py-2">{item.unit_price}</td>
										<td className="px-4 py-2">{item.amount}</td>
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
