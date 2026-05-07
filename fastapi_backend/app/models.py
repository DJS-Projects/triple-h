"""SQLAlchemy ORM models.

User/Item are pre-existing fastapi-users + template tables and stay on the
legacy 1.x `Column(...)` style. Document/DocumentPage/ExtractionRun/FieldReview
are the new domain tables and use the modern 2.x `Mapped[...] / mapped_column`
style. Both styles share the same `Base`.

Schema design rationale lives in the B.4 plan; the short version:
  - `document` is the public entity (UUID PK, exposed in URLs)
  - `document_page` caches per-page rendered PNGs (Plan B — UX speed)
  - `extraction_run` is append-only history; `is_current` flag flips on re-run
  - `field_review` is an append-only audit log of human edits
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi_users.db import SQLAlchemyBaseUserTableUUID
from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Identity,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
)


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Pre-existing tables (legacy column style; do not touch)
# ---------------------------------------------------------------------------


class User(SQLAlchemyBaseUserTableUUID, Base):
    items = relationship("Item", back_populates="user", cascade="all, delete-orphan")
    documents = relationship(
        "Document",
        back_populates="uploader",
        cascade="save-update, merge",
        passive_deletes=True,
    )


class Item(Base):
    __tablename__ = "items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    quantity = Column(Integer, nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=False)

    user = relationship("User", back_populates="items")


# ---------------------------------------------------------------------------
# Domain tables (B.4)
# ---------------------------------------------------------------------------

# Postgres ENUM types. Enum members are stable; expansion needs an Alembic
# migration with `ALTER TYPE ... ADD VALUE`.
DOC_TYPE_VALUES = ("delivery_order", "weighing_bill", "invoice", "petrol_bill")
DOC_STATUS_VALUES = (
    "uploaded",
    "processing",
    "extracted",
    "reviewed",
    "failed",
)

doc_type_enum = Enum(*DOC_TYPE_VALUES, name="doc_type", create_type=True)
doc_status_enum = Enum(*DOC_STATUS_VALUES, name="doc_status", create_type=True)


class Document(Base):
    """Uploaded artifact. PDF/image bytes live in the blob store, not here."""

    __tablename__ = "document"

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id", ondelete="RESTRICT"),
        nullable=False,
    )
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str] = mapped_column(Text, nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    blob_key: Mapped[str] = mapped_column(Text, nullable=False)
    sha256: Mapped[str] = mapped_column(Text, nullable=False)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    doc_type: Mapped[str | None] = mapped_column(doc_type_enum, nullable=True)
    status: Mapped[str] = mapped_column(
        doc_status_enum,
        nullable=False,
        server_default="uploaded",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    uploader = relationship("User", back_populates="documents")
    pages = relationship(
        "DocumentPage",
        back_populates="document",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="DocumentPage.page_no",
    )
    extraction_runs = relationship(
        "ExtractionRun",
        back_populates="document",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ExtractionRun.created_at.desc()",
    )

    __table_args__ = (
        CheckConstraint("size_bytes > 0", name="document_size_bytes_positive"),
        CheckConstraint(
            "page_count IS NULL OR page_count > 0",
            name="document_page_count_positive",
        ),
        Index("ix_document_uploaded_by", "uploaded_by"),
        Index("ix_document_created_at", "created_at"),
        Index("uq_document_sha256", "sha256", unique=True),
        Index(
            "ix_document_status_open",
            "status",
            postgresql_where="status <> 'reviewed'",
        ),
    )


class DocumentPage(Base):
    """One row per pre-rendered page PNG (Plan B for UX speed)."""

    __tablename__ = "document_page"

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document.document_id", ondelete="CASCADE"),
        primary_key=True,
    )
    page_no: Mapped[int] = mapped_column(Integer, primary_key=True)
    width_px: Mapped[int] = mapped_column(Integer, nullable=False)
    height_px: Mapped[int] = mapped_column(Integer, nullable=False)
    blob_key: Mapped[str] = mapped_column(Text, nullable=False)
    rendered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    document = relationship("Document", back_populates="pages")

    __table_args__ = (
        CheckConstraint("page_no >= 1", name="document_page_no_positive"),
        CheckConstraint("width_px > 0", name="document_page_width_positive"),
        CheckConstraint("height_px > 0", name="document_page_height_positive"),
    )


class ExtractionRun(Base):
    """Append-only history of pipeline runs over a document."""

    __tablename__ = "extraction_run"

    extraction_run_id: Mapped[int] = mapped_column(
        BigInteger,
        Identity(always=True),
        primary_key=True,
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document.document_id", ondelete="CASCADE"),
        nullable=False,
    )
    doc_type: Mapped[str] = mapped_column(doc_type_enum, nullable=False)
    schema_version: Mapped[str] = mapped_column(Text, nullable=False)
    llm_model: Mapped[str] = mapped_column(Text, nullable=False)
    checkpoint_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    is_current: Mapped[bool] = mapped_column(
        nullable=False,
        server_default="true",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    document = relationship("Document", back_populates="extraction_runs")
    field_reviews = relationship(
        "FieldReview",
        back_populates="extraction_run",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    refinement_runs = relationship(
        "RefinementRun",
        back_populates="extraction_run",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        CheckConstraint("duration_ms >= 0", name="extraction_run_duration_nonneg"),
        CheckConstraint(
            "jsonb_typeof(payload) = 'object'",
            name="extraction_run_payload_is_object",
        ),
        # Composite (document_id, created_at) covers single-col `document_id`
        # lookups — no separate `ix_extraction_run_document` needed.
        Index(
            "ix_extraction_run_doc_created",
            "document_id",
            "created_at",
        ),
        Index(
            "uq_extraction_run_one_current_per_doc",
            "document_id",
            unique=True,
            postgresql_where="is_current",
        ),
        Index(
            "ix_extraction_run_payload_gin",
            "payload",
            postgresql_using="gin",
            postgresql_ops={"payload": "jsonb_path_ops"},
        ),
    )


class FieldReview(Base):
    """Append-only audit log: a human edit on one field of an extraction."""

    __tablename__ = "field_review"

    field_review_id: Mapped[int] = mapped_column(
        BigInteger,
        Identity(always=True),
        primary_key=True,
    )
    extraction_run_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("extraction_run.extraction_run_id", ondelete="CASCADE"),
        nullable=False,
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id", ondelete="RESTRICT"),
        nullable=False,
    )
    field_path: Mapped[str] = mapped_column(Text, nullable=False)
    original_value: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    edited_value: Mapped[Any] = mapped_column(JSONB, nullable=False)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    extraction_run = relationship("ExtractionRun", back_populates="field_reviews")

    __table_args__ = (
        # Composite (extraction_run_id, field_path) covers single-col
        # `extraction_run_id` lookups — no separate index needed.
        Index("ix_field_review_reviewer", "reviewer_id"),
        Index(
            "ix_field_review_extraction_field",
            "extraction_run_id",
            "field_path",
        ),
    )


class RefinementRun(Base):
    """Append-only history of VLM refinement passes over an extraction.

    A refinement run takes a DoclingDocument scaffold (the OCR output of
    Chandra) and the source page image, then asks a Vision LLM to emit a
    list of typed `BBoxPatch` operations that fix OCR mistakes —
    misclassified fragments, missing handwriting boxes, stale bbox
    positions, etc. The original scaffold is preserved (`scaffold_in`),
    the patched scaffold is persisted (`scaffold_out`), and the
    structured ARQ trace stays alongside for full auditability.

    Schema notes
    ------------
    - One refinement_run is bound to exactly one extraction_run; both
      are independently versioned. The current scaffold for display is
      `scaffold_out` of the latest `is_current` row, falling back to the
      extraction_run's docling_doc when no refinement has run yet.
    - `arq_trace` carries the reasoning checkpoints from the DSPy
      Signature: visual_audit, scaffold_match, discrepancies. We store
      them verbatim so prompt-version drift can be diffed in audit UI.
    - `prompt_version` ties the call to a versioned DSPy Signature
      class — bump on schema changes so optimization runs (later) are
      grouped correctly.
    """

    __tablename__ = "refinement_run"

    refinement_run_id: Mapped[int] = mapped_column(
        BigInteger,
        Identity(always=True),
        primary_key=True,
    )
    extraction_run_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("extraction_run.extraction_run_id", ondelete="CASCADE"),
        nullable=False,
    )
    vlm_model: Mapped[str] = mapped_column(Text, nullable=False)
    prompt_version: Mapped[str] = mapped_column(Text, nullable=False)
    scaffold_in: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    scaffold_out: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    patches: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)
    arq_trace: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    token_usage: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    is_current: Mapped[bool] = mapped_column(
        nullable=False,
        server_default="true",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    extraction_run = relationship("ExtractionRun", back_populates="refinement_runs")

    __table_args__ = (
        CheckConstraint("duration_ms >= 0", name="refinement_run_duration_nonneg"),
        CheckConstraint(
            "jsonb_typeof(scaffold_in) = 'object'",
            name="refinement_run_scaffold_in_is_object",
        ),
        CheckConstraint(
            "jsonb_typeof(scaffold_out) = 'object'",
            name="refinement_run_scaffold_out_is_object",
        ),
        CheckConstraint(
            "jsonb_typeof(patches) = 'array'",
            name="refinement_run_patches_is_array",
        ),
        # Composite (extraction_run_id, created_at) covers single-col
        # extraction_run_id lookups — no separate index needed.
        Index(
            "ix_refinement_run_extraction_created",
            "extraction_run_id",
            "created_at",
        ),
        Index(
            "uq_refinement_run_one_current_per_extraction",
            "extraction_run_id",
            unique=True,
            postgresql_where="is_current",
        ),
    )
