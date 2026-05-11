"""add_extraction_job_table

Revision ID: 763895bd69c3
Revises: f80865750e97
Create Date: 2026-05-11 08:13:08.696992

Adds the `extraction_job` table for async/queued extraction processing.

Schema design:
  - `idempotency_key` (client-supplied) is the primary dedup mechanism;
    a partial unique index ensures one active job per key. Stripe-style
    semantics: same key + active → return existing job.
  - `content_hash` (SHA256 of the PDF bytes) is also unique-per-active-job
    as a defensive second layer for clients that forget to set the
    header but happen to re-upload the same file.
  - `status` is a Postgres enum (extraction_job_status) so worker
    state transitions are exhaustively typed.
  - `locked_until` is a worker heartbeat lease — claim sets it, worker
    refreshes during long jobs, sweeper requeues stalled jobs whose
    lease expired.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, ENUM


# Reference existing enum types (created in earlier migrations) with
# create_type=False so we don't try to recreate them.
doc_type_enum = ENUM(
    "delivery_order",
    "weighing_bill",
    "invoice",
    "petrol_bill",
    name="doc_type",
    create_type=False,
)
extraction_job_status_enum = ENUM(
    "pending",
    "running",
    "succeeded",
    "failed",
    name="extraction_job_status",
    create_type=False,
)


# revision identifiers, used by Alembic.
revision: str = "763895bd69c3"
down_revision: Union[str, None] = "f80865750e97"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Enum for job status ────────────────────────────────────────────
    # Create the type explicitly with checkfirst=True so re-running this
    # migration on a fresh DB (after partial rollback) doesn't blow up.
    creator_enum = ENUM(
        "pending",
        "running",
        "succeeded",
        "failed",
        name="extraction_job_status",
        create_type=True,
    )
    creator_enum.create(op.get_bind(), checkfirst=True)

    # ── Table ──────────────────────────────────────────────────────────
    op.create_table(
        "extraction_job",
        sa.Column(
            "job_id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.func.gen_random_uuid(),
        ),
        sa.Column(
            "document_id",
            UUID(as_uuid=True),
            sa.ForeignKey("document.document_id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Idempotency: client-supplied key (UUID string typically).
        # NOT nullable — every job must declare an intent key. The route
        # generates one server-side if the client doesn't supply one,
        # so it's never missing.
        sa.Column("idempotency_key", sa.Text, nullable=False),
        # Content hash (SHA256 hex) duplicated from `document.sha256`
        # for fast lookups without joining.
        sa.Column("content_hash", sa.Text, nullable=False),
        sa.Column("model", sa.Text, nullable=False),
        # Nullable: NULL = auto-classify (per-page pipeline classifies
        # per page; legacy paths classify upfront).
        sa.Column("doc_type", doc_type_enum, nullable=True),
        sa.Column(
            "status",
            extraction_job_status_enum,
            nullable=False,
            server_default="pending",
        ),
        # FE-friendly current stage label ("classify", "chandra",
        # "vlm_extract", "consistency_pass", "correction"). Worker
        # writes it as spans fire; SSE endpoint reads it.
        sa.Column("stage", sa.Text, nullable=True),
        # Error message on failure (truncated stack trace).
        sa.Column("error", sa.Text, nullable=True),
        # On success: pointer to the extraction_run row this job
        # produced. Nullable until succeeded.
        sa.Column(
            "run_id",
            sa.BigInteger,
            sa.ForeignKey("extraction_run.extraction_run_id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "attempts",
            sa.Integer,
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "max_attempts",
            sa.Integer,
            nullable=False,
            server_default="1",
        ),
        # Worker lease — set when claimed; sweeper requeues if expired.
        sa.Column(
            "locked_until",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "finished_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        # Free-form request metadata (filename, dpi, etc.) for replay.
        sa.Column(
            "request_meta",
            JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.CheckConstraint("attempts >= 0", name="extraction_job_attempts_nonneg"),
        sa.CheckConstraint(
            "max_attempts >= 1", name="extraction_job_max_attempts_min1"
        ),
    )

    # ── Idempotency: one active job per idempotency_key ────────────────
    # Partial unique index lets failed-terminal jobs coexist with new
    # retries under the same key (post-fix re-submission).
    op.create_index(
        "uq_extraction_job_idem_active",
        "extraction_job",
        ["idempotency_key"],
        unique=True,
        postgresql_where=sa.text("status IN ('pending', 'running', 'succeeded')"),
    )

    # ── Defensive dedup: same content + model + doc_type also unique ──
    # Catches clients that re-upload without setting the Idempotency-Key.
    # Two partial indexes split by doc_type IS NULL because postgres
    # requires functions in index expressions to be IMMUTABLE, and the
    # implicit enum→text cast we'd need for COALESCE is only STABLE.
    op.create_index(
        "uq_extraction_job_content_active_typed",
        "extraction_job",
        ["content_hash", "model", "doc_type"],
        unique=True,
        postgresql_where=sa.text(
            "status IN ('pending', 'running', 'succeeded') AND doc_type IS NOT NULL"
        ),
    )
    op.create_index(
        "uq_extraction_job_content_active_auto",
        "extraction_job",
        ["content_hash", "model"],
        unique=True,
        postgresql_where=sa.text(
            "status IN ('pending', 'running', 'succeeded') AND doc_type IS NULL"
        ),
    )

    # ── Claim queue: scan pending jobs by FIFO ─────────────────────────
    op.create_index(
        "ix_extraction_job_pending_queue",
        "extraction_job",
        ["created_at"],
        postgresql_where=sa.text("status = 'pending'"),
    )

    # ── Stalled-lease sweeper index ────────────────────────────────────
    op.create_index(
        "ix_extraction_job_stalled_leases",
        "extraction_job",
        ["locked_until"],
        postgresql_where=sa.text("status = 'running' AND locked_until IS NOT NULL"),
    )

    # ── Document lookup (jobs for a document, most recent first) ───────
    op.create_index(
        "ix_extraction_job_doc_created",
        "extraction_job",
        ["document_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_extraction_job_doc_created", table_name="extraction_job")
    op.drop_index("ix_extraction_job_stalled_leases", table_name="extraction_job")
    op.drop_index("ix_extraction_job_pending_queue", table_name="extraction_job")
    op.drop_index("uq_extraction_job_content_active_auto", table_name="extraction_job")
    op.drop_index("uq_extraction_job_content_active_typed", table_name="extraction_job")
    op.drop_index("uq_extraction_job_idem_active", table_name="extraction_job")
    op.drop_table("extraction_job")
    extraction_job_status_enum.drop(op.get_bind(), checkfirst=True)
