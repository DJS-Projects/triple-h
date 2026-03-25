# Delivery Order Upload Frontend - Implementation Guide

## Overview
Created a complete delivery order (DO) upload frontend that mirrors the resume upload functionality with DO-specific features.

## Files Created

### 1. **DirectUploadDO Component**
**Path:** `src/app/components/delivery-order-upload/direct-upload-do.tsx`

Features:
- Modal dialog for file selection
- Drag-and-drop style upload interface
- File validation (PDF only)
- Processing state management
- Integration with backend `/upload_pdf` endpoint on port 8002
- Displays file name and size

### 2. **DOUploadButton Component**
**Path:** `src/app/components/delivery-order-upload/DOUploadButton.tsx`

Features:
- Main upload button to trigger the modal
- JSON parsing from response
- Display parsed delivery order data in a modal
- Supports both string and object responses
- Shows all extracted fields:
  - Sold To
  - Delivered To
  - Invoice Number (array)
  - Date (array)
  - Good Description (array)
  - Quantity (array)
- Raw JSON viewer for debugging
- Customizable button text and styling

### 3. **Delivery Order Upload Page**
**Path:** `src/app/delivery-orders/page.tsx`

Features:
- Full page layout with header
- Upload section with DOUploadButton
- Success/error status messages
- Display processed delivery orders in a card grid
- Summary statistics
- Empty state when no orders uploaded
- Responsive design with Tailwind CSS

## Integration Points

### Backend Connection
- **Endpoint:** `http://localhost:8002/upload_pdf`
- **Method:** POST (multipart/form-data)
- **Port:** 8002 (do_extract.py)

### Response Format
Expected JSON structure from backend:
```json
{
  "status": "ok",
  "parsed_info": {
    "sold to": "Company Name",
    "delivered to": "Delivery Address",
    "invoice number": ["INV-001"],
    "date": ["2024-12-11"],
    "good description": ["Item 1", "Item 2"],
    "quantity": ["10", "20"]
  },
  "file_id": "abc123def",
  "file_hash": "hash_value",
  "file_metadata": {...},
  "chunks_indexed": 5
}
```

## How to Use

### 1. Access the Page
Navigate to: `http://localhost:3000/delivery-orders`

### 2. Upload a File
- Click "Upload Delivery Order" button
- Select a PDF file (searchable or scanned)
- Click "Upload & Process"
- Wait for processing to complete

### 3. View Results
- Extracted data appears in a modal dialog
- Shows all parsed fields in organized sections
- View raw JSON for debugging if needed

### 4. Browse History
- All processed delivery orders appear below
- Shows summary of key fields for each order
- Grid layout with responsive design

## Features

✅ **OCR Support** - Automatically processes scanned PDFs via backend
✅ **Flexible Input** - Supports both digital and scanned delivery order PDFs
✅ **Data Display** - Organized sections for each field type
✅ **Error Handling** - User-friendly error messages
✅ **Status Updates** - Visual feedback during upload and processing
✅ **JSON Viewer** - Debug raw response data
✅ **Responsive Design** - Works on desktop and tablet
✅ **Session Independent** - No user auth required for upload

## Customization Options

### Change Button Text
```tsx
<DOUploadButton
  buttonText="Upload DO Document"
  buttonVariant="outline"
/>
```

### Handle Upload Events
```tsx
const handleDOProcessed = (parsedInfo: any) => {
  // Access parsed_info.parsed_info for extracted data
  console.log(parsedInfo.parsed_info);
};

<DOUploadButton onDOProcessed={handleDOProcessed} />
```

## Dependencies Used
- **react** - UI component framework
- **lucide-react** - Icons
- **axios** - HTTP client
- **next** - Framework routing
- **tailwindcss** - Styling (via components)

## Notes
- Backend must be running on port 8002 with do_extract.py
- Ensure Tesseract-OCR is installed for scanned PDF support
- PDF file size limit: 10MB
- Maximum processing time depends on PDF size (typically 2-10 seconds)
