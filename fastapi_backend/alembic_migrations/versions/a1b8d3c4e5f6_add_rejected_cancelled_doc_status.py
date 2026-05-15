"""add_rejected_cancelled_doc_status

Revision ID: a1b8d3c4e5f6
Revises: 763895bd69c3
Create Date: 2026-05-16 03:30:00.000000

Adds `rejected` and `cancelled` values to the `doc_status` Postgres enum.

Motivation:
  Previously, both classifier rejection and user cancel reset doc.status
  back to `uploaded` — but that's misleading: the recent-uploads list
  renders `uploaded` as "queued" with a spinner, suggesting the doc is
  still waiting for a worker (it isn't). The bug was masked by the FE
  auto-deleting docs ~5s after either event, which destroyed data on a
  system-initiated decision and left no audit trail.

  Distinct terminal states (`rejected`, `cancelled`) let the FE render
  these clearly with their own labels + actions (Discard / Retry-as),
  no more spinner deception, no more auto-destruction.

Idempotency:
  Postgres 12+ supports `ALTER TYPE ... ADD VALUE IF NOT EXISTS`. We
  use that so repeated upgrades are no-ops, and tests that run the
  migration twice (via `create_all` then alembic head) don't crash.
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "a1b8d3c4e5f6"
down_revision: Union[str, None] = "763895bd69c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Values added in this migration. The downgrade quietly rolls any
# document rows currently in these states back to `failed` (the closest
# pre-existing terminal state) before recreating the enum without them,
# so the column type swap doesn't trip over invalid casts.
NEW_VALUES = ("rejected", "cancelled")


def upgrade() -> None:
    # ADD VALUE IF NOT EXISTS is transaction-safe in PG 12+. No need to
    # COMMIT manually as with older Postgres versions.
    for value in NEW_VALUES:
        op.execute(f"ALTER TYPE doc_status ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    # Postgres doesn't support `ALTER TYPE ... DROP VALUE`. Standard
    # pattern: create new enum without the dropped values, migrate any
    # affected rows to a safe pre-existing value, swap the column type,
    # drop the old enum.
    op.execute(
        "UPDATE document SET status = 'failed' "
        "WHERE status IN ('rejected', 'cancelled')"
    )
    op.execute(
        "CREATE TYPE doc_status_old AS ENUM ("
        "'uploaded', 'processing', 'extracted', 'reviewed', 'failed'"
        ")"
    )
    op.execute(
        "ALTER TABLE document "
        "ALTER COLUMN status DROP DEFAULT, "
        "ALTER COLUMN status TYPE doc_status_old "
        "USING status::text::doc_status_old, "
        "ALTER COLUMN status SET DEFAULT 'uploaded'"
    )
    # The status-open partial index (created in 3e2514bc236e) references
    # the column but not specific enum values, so the type swap leaves
    # it intact — no need to drop/recreate.
    op.execute("DROP TYPE doc_status")
    op.execute("ALTER TYPE doc_status_old RENAME TO doc_status")
