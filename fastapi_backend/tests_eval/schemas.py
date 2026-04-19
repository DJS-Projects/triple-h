"""Typed schemas for eval fixtures.

One Pydantic model per doc-type. Intentionally permissive (str | None
everywhere) — this is a PoC harness, not a production domain model.
The schema's job here is to catch *missing* and *type-malformed* fields
on fixture load, not to enforce business invariants.

Modeling decisions explicitly deferred until we have customer signal:
  - Unit normalization (currently embedded in strings: "42.40 t")
  - Decimal/numeric typing for weights, prices, amounts
  - Date/datetime parsing (currently ISO strings)
  - Whether `do_number`, `po_number`, etc. are genuinely multi-valued
  - Nested party objects (sold_to.name + sold_to.address)
  - Multi-page document handling
"""

from pydantic import BaseModel, ConfigDict

# All eval schemas forbid unknown fields. A typo in a YAML fixture key
# (e.g. `weighing_no_TYPO:`) raises ValidationError at dataset load
# instead of silently dropping the value and leaving the real field None.
_STRICT = ConfigDict(extra="forbid")


# ─── Pipeline I/O ──────────────────────────────────────────────────────────


class ExtractionInputs(BaseModel):
    """Inputs to the extraction pipeline — consumed by every eval case."""

    model_config = _STRICT

    pdf_path: str


class FixtureMetadata(BaseModel):
    """Per-fixture annotation carried alongside ground truth.

    Migrated from the `_meta` block in the old `.expected.json` files.
    """

    model_config = _STRICT

    source_pdf: str | None = None
    status: str | None = None
    notes: str | None = None


# ─── Delivery Order ────────────────────────────────────────────────────────


class DOLineItem(BaseModel):
    model_config = _STRICT

    description: str | None = None
    quantity: str | None = None
    weight_mt: str | None = None


class DeliveryOrder(BaseModel):
    model_config = _STRICT

    do_issuer_name: str | None = None
    sold_to: str | None = None
    sold_to_address: str | None = None
    delivered_to: str | None = None
    delivered_to_address: str | None = None
    do_number: list[str] = []
    po_number: list[str] = []
    vehicle_number: list[str] = []
    date: list[str] = []
    items: list[DOLineItem] = []
    total_quantity: str | None = None
    total_weight_mt: str | None = None


# ─── Weighing Bill ─────────────────────────────────────────────────────────


class WeighingBill(BaseModel):
    model_config = _STRICT

    weighing_no: str | None = None
    contract_no: str | None = None
    vehicle_no: str | None = None
    material_name: str | None = None
    gross_weight: str | None = None
    tare_weight: str | None = None
    net_weight: str | None = None
    off_weight: str | None = None
    actual_weight: str | None = None
    gross_time: str | None = None
    tare_time: str | None = None
    deliver: str | None = None
    receiver: str | None = None
    fleet_name: str | None = None
    remark: str | None = None


# ─── Invoice ───────────────────────────────────────────────────────────────


class InvoiceLineItem(BaseModel):
    model_config = _STRICT

    description: str | None = None
    quantity: str | None = None
    unit_price: str | None = None
    amount: str | None = None


class Invoice(BaseModel):
    model_config = _STRICT

    invoice_number: str | None = None
    invoice_date: str | None = None
    terms: str | None = None
    bill_to: str | None = None
    bill_to_tin: str | None = None
    bill_to_address: str | None = None
    from_company: str | None = None
    from_tin: str | None = None
    items: list[InvoiceLineItem] = []


# ─── Petrol Bill ───────────────────────────────────────────────────────────
# No ground-truth fixtures yet. Fields below are placeholders based on
# what a typical MY petrol receipt carries; refine once real labels exist.


class PetrolBill(BaseModel):
    model_config = _STRICT

    station_name: str | None = None
    station_address: str | None = None
    plate_number: str | None = None
    fuel_type: str | None = None
    litres: str | None = None
    unit_price: str | None = None
    total_amount: str | None = None
    purchase_datetime: str | None = None
    receipt_no: str | None = None
