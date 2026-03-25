import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalize a value to an array.
 * If value is already an array, return it.
 * If value is a string, wrap it in an array.
 * If value is null/undefined, return empty array.
 */
export function ensureArray<T = string>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value
  }
  if (value === null || value === undefined) {
    return []
  }
  return [value]
}

/**
 * Normalize response structure to handle multiple formats:
 * Format 1: { delivery_order_data: {...}, weighing_bill_data: {...}, invoice_data: {...} }
 * Format 2: { delivery_order: {...}, weighing_bill: {...}, invoice: {...} }
 * Format 3: { d_o_issuer_name, d_o_number, date, sold_to, address, items, ... } (flat delivery order)
 * Format 4: Mixed - flat delivery order fields + nested weighing_bill/invoice objects
 */
export function normalizeResponseStructure(data: any): any {
  if (!data) return data
  
  const normalized: any = {}
  
  // List of delivery order field indicators
  const deliveryOrderFields = [
    "d_o_issuer_name", "d_o_number", "sold_to", "sold to", "address", "delivered_to", "delivered to",
    "sold to (address)", "sold_to_address", "delivered to (address)", "delivered_to_address",
    "delivery_order_number", "po_number", "vehicle_number", "good_description", "good description",
    "date", "items", "total_quantity", "total_weight_mt", "quantity",
    "D/O issuer name", "D/O number", "P/O number", "Vehicle number"
  ]
  
  // List of weighing bill field indicators
  const weighingBillFields = [
    "weighing_no", "contract_no", "vehicle_no", "gross_weight", "tare_weight",
    "net_weight", "off_weight", "actual_weight", "gross_time"
  ]
  
  // List of invoice field indicators
  const invoiceFields = [
    "invoice_number", "invoice_date", "bill_to", "ship_to"
  ]
  
  // Check if this is Format 1 or 2 (nested structure)
  const hasNestedDeliveryOrder = data.delivery_order_data || data.delivery_order
  const hasNestedWeighingBill = data.weighing_bill_data || data.weighing_bill
  const hasNestedInvoice = data.invoice_data || data.invoice
  
  // Count flat fields to detect Format 3 or 4 (mixed)
  const flatDeliveryOrderCount = Object.keys(data).filter(k => 
    deliveryOrderFields.some(f => f.toLowerCase() === k.toLowerCase()) &&
    typeof data[k] !== 'object'
  ).length
  
  // Check for both flat and nested structures (Format 4: Mixed)
  const isMixedFormat = flatDeliveryOrderCount > 0 && (hasNestedWeighingBill || hasNestedInvoice)
  
  if (!isMixedFormat && (hasNestedDeliveryOrder || hasNestedWeighingBill || hasNestedInvoice)) {
    // Format 1 or 2: Purely nested structure
    
    // Copy over non-document-type fields
    for (const [key, value] of Object.entries(data)) {
      if (!key.includes("delivery_order") && !key.includes("weighing_bill") && !key.includes("invoice")) {
        normalized[key] = value
      }
    }
    
    // Handle delivery_order or delivery_order_data
    if (data.delivery_order_data) {
      normalized.delivery_order_data = normalizeDocumentFields(data.delivery_order_data, "delivery_order")
    } else if (data.delivery_order) {
      normalized.delivery_order_data = normalizeDocumentFields(data.delivery_order, "delivery_order")
    }
    
    // Handle weighing_bill or weighing_bill_data
    if (data.weighing_bill_data) {
      normalized.weighing_bill_data = data.weighing_bill_data
    } else if (data.weighing_bill) {
      normalized.weighing_bill_data = data.weighing_bill
    }
    
    // Handle invoice or invoice_data
    if (data.invoice_data) {
      normalized.invoice_data = data.invoice_data
    } else if (data.invoice) {
      normalized.invoice_data = data.invoice
    }
  } else {
    // Format 3 or 4: Flat structure (pure flat or mixed with some nested)
    
    // Separate fields by type
    const deliveryOrderData: any = {}
    const weighingBillData: any = {}
    const invoiceData: any = {}
    const otherData: any = {}
    
    for (const [key, value] of Object.entries(data)) {
      // Check if key is a nested object (weighing_bill, invoice, etc.)
      if (key === "weighing_bill" || key === "weighing_bill_data") {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          normalized.weighing_bill_data = value
          continue
        }
      }
      
      if (key === "invoice" || key === "invoice_data") {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          normalized.invoice_data = value
          continue
        }
      }
      
      // Check if this is a flat delivery order field
      const isDeliveryOrderField = deliveryOrderFields.some(f => f.toLowerCase() === key.toLowerCase())
      const isWeighingBillField = weighingBillFields.some(f => f.toLowerCase() === key.toLowerCase())
      const isInvoiceField = invoiceFields.some(f => f.toLowerCase() === key.toLowerCase())
      
      if (isDeliveryOrderField) {
        deliveryOrderData[key] = value
      } else if (isWeighingBillField) {
        weighingBillData[key] = value
      } else if (isInvoiceField) {
        invoiceData[key] = value
      } else {
        otherData[key] = value
      }
    }
    
    // Merge other data into normalized
    Object.assign(normalized, otherData)
    
    // Add document data if not empty
    if (Object.keys(deliveryOrderData).length > 0) {
      normalized.delivery_order_data = normalizeDocumentFields(deliveryOrderData, "delivery_order")
    }
    
    if (Object.keys(weighingBillData).length > 0 && !normalized.weighing_bill_data) {
      normalized.weighing_bill_data = weighingBillData
    }
    
    if (Object.keys(invoiceData).length > 0 && !normalized.invoice_data) {
      normalized.invoice_data = invoiceData
    }
  }
  
  return normalized
}

/**
 * Normalize field names within a document to handle variations from different AI models
 */
export function normalizeDocumentFields(data: any, documentType: string): any {
  if (!data) return data
  
  const normalized: any = {}
  
  // Map of field variations to standard names
  const fieldMap: Record<string, string[]> = {
    // Delivery Order / Invoice fields
    "D/O issuer name": ["d_o_issuer_name", "D_O_issuer_name", "issuer name", "issuer_name", "issued_by"],
    "sold to": ["sold_to", "sold to", "customer", "buyer"],
    "sold to (address)": ["sold_to_address", "address", "sold_to_(address)"],
    "delivered to": ["delivered_to", "delivery_location", "ship_to"],
    "delivered to (address)": ["delivered_to_address", "delivery_address", "delivered_to_(address)"],
    "D/O number": ["d_o_number", "D_O_number", "delivery_order_no", "do_number"],
    "P/O number": ["p_o_number", "P_O_number", "po_number", "PO number"],
    "Vehicle number": ["vehicle_number", "vehicle_no", "truck_number", "lorry_number"],
    "date": ["date", "delivery_date", "order_date"],
    "items": ["items", "goods", "goods_details", "products", "line_items"],
    "total_quantity": ["total_quantity", "total_qty"],
    "total_weight_mt": ["total_weight_mt", "total_weight"],
    "good description": ["good_description", "good description", "goods_description", "product_description"],
    "quantity": ["quantity", "quantities", "qty"],
    
    // Weighing bill fields
    "weighing_no": ["weighing_no", "weighing number"],
    "contract_no": ["contract_no", "contract number"],
    "vehicle_no": ["vehicle_no", "vehicle_number", "truck_no"],
    "gross_weight": ["gross_weight", "gross weight"],
    "tare_weight": ["tare_weight", "tare weight"],
    "net_weight": ["net_weight", "net weight"],
    "off_weight": ["off_weight", "off weight"],
    "actual_weight": ["actual_weight", "actual weight"],
    "gross_time": ["gross_time", "gross time", "weighing_time"],
  }
  
  // Process each field in the original data
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase()
    let matched = false
    
    // Try to find a matching standard field name
    for (const [standardKey, variations] of Object.entries(fieldMap)) {
      for (const variation of variations) {
        if (variation.toLowerCase() === lowerKey) {
          normalized[standardKey] = value
          matched = true
          break
        }
      }
      if (matched) break
    }
    
    // If no match found, keep the original key
    if (!matched) {
      normalized[key] = value
    }
  }
  
  return normalized
}

/**
 * Normalize delivery order data to ensure all array fields are actually arrays.
 * Some models may return strings instead of arrays for fields like 'date', 'good description', etc.
 */
export function normalizeDeliveryOrderData(data: any) {
  if (!data) return data
  
  const arrayFields = ["D/O number", "P/O number", "Vehicle number", "date", "good description", "quantity"]
  
  const normalized = { ...data }
  arrayFields.forEach(field => {
    if (field in normalized && normalized[field] !== undefined && normalized[field] !== null) {
      normalized[field] = ensureArray(normalized[field])
    }
  })
  
  // Handle items/goods array
  if (normalized.items || normalized.goods) {
    const items = normalized.items || normalized.goods
    if (Array.isArray(items)) {
      normalized.items = items.map((item: any) => ({
        description: item.description || item.name || "",
        quantity: String(item.quantity || ""),
        weight_mt: item.weight_mt || item.weight ? String(item.weight_mt || item.weight) : undefined,
      }))
    }
  }
  
  return normalized
}
