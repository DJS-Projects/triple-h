"""add_document_page_extraction_run_field_review

Revision ID: 3e2514bc236e
Revises: b389592974f8
Create Date: 2026-05-06 19:17:18.994760

Notes
-----
- Indexes are created non-concurrently because the tables are brand new and
  empty during this migration; there is no concurrent write traffic to block.
  Future migrations that add indexes to these tables once they have data
  must use `postgresql_concurrently=True` inside an `autocommit_block()`
  per the alembic-expert rules.
- Single-column indexes whose leading column is already the leftmost column
  of a composite index (e.g. `ix_extraction_run_document` covered by
  `ix_extraction_run_doc_created`) are intentionally omitted.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "3e2514bc236e"
down_revision: Union[str, None] = "b389592974f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Enum types are managed explicitly with checkfirst=True so the migration is
# idempotent if a previous attempt created the types but rolled back tables.
doc_type_enum = postgresql.ENUM(
    "delivery_order",
    "weighing_bill",
    "invoice",
    "petrol_bill",
    name="doc_type",
    create_type=False,
)
doc_status_enum = postgresql.ENUM(
    "uploaded",
    "processing",
    "extracted",
    "reviewed",
    "failed",
    name="doc_status",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    doc_type_enum.create(bind, checkfirst=True)
    doc_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "document",
        sa.Column(
            "document_id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("uploaded_by", sa.UUID(), nullable=False),
        sa.Column("filename", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.Text(), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("blob_key", sa.Text(), nullable=False),
        sa.Column("sha256", sa.Text(), nullable=False),
        sa.Column("page_count", sa.Integer(), nullable=True),
        sa.Column("doc_type", doc_type_enum, nullable=True),
        sa.Column(
            "status",
            doc_status_enum,
            server_default="uploaded",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "page_count IS NULL OR page_count > 0",
            name="document_page_count_positive",
        ),
        sa.CheckConstraint("size_bytes > 0", name="document_size_bytes_positive"),
        sa.ForeignKeyConstraint(["uploaded_by"], ["user.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("document_id"),
    )
    op.create_index("ix_document_created_at", "document", ["created_at"])
    op.create_index(
        "ix_document_status_open",
        "document",
        ["status"],
        postgresql_where="status <> 'reviewed'",
    )
    op.create_index("ix_document_uploaded_by", "document", ["uploaded_by"])
    op.create_index("uq_document_sha256", "document", ["sha256"], unique=True)

    op.create_table(
        "document_page",
        sa.Column("document_id", sa.UUID(), nullable=False),
        sa.Column("page_no", sa.Integer(), nullable=False),
        sa.Column("width_px", sa.Integer(), nullable=False),
        sa.Column("height_px", sa.Integer(), nullable=False),
        sa.Column("blob_key", sa.Text(), nullable=False),
        sa.Column(
            "rendered_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("height_px > 0", name="document_page_height_positive"),
        sa.CheckConstraint("page_no >= 1", name="document_page_no_positive"),
        sa.CheckConstraint("width_px > 0", name="document_page_width_positive"),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["document.document_id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("document_id", "page_no"),
    )

    op.create_table(
        "extraction_run",
        sa.Column(
            "extraction_run_id",
            sa.BigInteger(),
            sa.Identity(always=True),
            nullable=False,
        ),
        sa.Column("document_id", sa.UUID(), nullable=False),
        sa.Column("doc_type", doc_type_enum, nullable=False),
        sa.Column("schema_version", sa.Text(), nullable=False),
        sa.Column("llm_model", sa.Text(), nullable=False),
        sa.Column("checkpoint_id", sa.Text(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "is_current",
            sa.Boolean(),
            server_default="true",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "jsonb_typeof(payload) = 'object'",
            name="extraction_run_payload_is_object",
        ),
        sa.CheckConstraint("duration_ms >= 0", name="extraction_run_duration_nonneg"),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["document.document_id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("extraction_run_id"),
    )
    # (document_id, created_at) composite covers single-col document_id queries.
    op.create_index(
        "ix_extraction_run_doc_created",
        "extraction_run",
        ["document_id", "created_at"],
    )
    op.create_index(
        "ix_extraction_run_payload_gin",
        "extraction_run",
        ["payload"],
        postgresql_using="gin",
        postgresql_ops={"payload": "jsonb_path_ops"},
    )
    op.create_index(
        "uq_extraction_run_one_current_per_doc",
        "extraction_run",
        ["document_id"],
        unique=True,
        postgresql_where="is_current",
    )

    op.create_table(
        "field_review",
        sa.Column(
            "field_review_id",
            sa.BigInteger(),
            sa.Identity(always=True),
            nullable=False,
        ),
        sa.Column("extraction_run_id", sa.BigInteger(), nullable=False),
        sa.Column("reviewer_id", sa.UUID(), nullable=False),
        sa.Column("field_path", sa.Text(), nullable=False),
        sa.Column(
            "original_value",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "edited_value",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("remark", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["extraction_run_id"],
            ["extraction_run.extraction_run_id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["reviewer_id"], ["user.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("field_review_id"),
    )
    # (extraction_run_id, field_path) composite covers single-col
    # extraction_run_id queries.
    op.create_index(
        "ix_field_review_extraction_field",
        "field_review",
        ["extraction_run_id", "field_path"],
    )
    op.create_index("ix_field_review_reviewer", "field_review", ["reviewer_id"])


def downgrade() -> None:
    op.drop_index("ix_field_review_reviewer", table_name="field_review")
    op.drop_index("ix_field_review_extraction_field", table_name="field_review")
    op.drop_table("field_review")

    op.drop_index(
        "uq_extraction_run_one_current_per_doc",
        table_name="extraction_run",
        postgresql_where="is_current",
    )
    op.drop_index(
        "ix_extraction_run_payload_gin",
        table_name="extraction_run",
        postgresql_using="gin",
        postgresql_ops={"payload": "jsonb_path_ops"},
    )
    op.drop_index("ix_extraction_run_doc_created", table_name="extraction_run")
    op.drop_table("extraction_run")

    op.drop_table("document_page")

    op.drop_index("uq_document_sha256", table_name="document")
    op.drop_index("ix_document_uploaded_by", table_name="document")
    op.drop_index(
        "ix_document_status_open",
        table_name="document",
        postgresql_where="status <> 'reviewed'",
    )
    op.drop_index("ix_document_created_at", table_name="document")
    op.drop_table("document")

    bind = op.get_bind()
    doc_status_enum.drop(bind, checkfirst=True)
    doc_type_enum.drop(bind, checkfirst=True)
