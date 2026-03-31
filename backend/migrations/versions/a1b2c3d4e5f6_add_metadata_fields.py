"""add_metadata_fields

Revision ID: a1b2c3d4e5f6
Revises: 2e7e6c0002d3
Create Date: 2026-03-31

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '2e7e6c0002d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("papers") as batch_op:
        batch_op.add_column(sa.Column("institution", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("raw_extracted_metadata", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("scholar_metadata", sa.Text(), nullable=True))
        batch_op.alter_column(
            "processing_status",
            type_=sa.Enum(
                "awaiting_metadata", "pending", "processing", "done", "failed",
                name="paper_status"
            ),
            existing_type=sa.Enum(
                "pending", "processing", "done", "failed",
                name="paper_status"
            ),
        )


def downgrade() -> None:
    with op.batch_alter_table("papers") as batch_op:
        batch_op.drop_column("institution")
        batch_op.drop_column("raw_extracted_metadata")
        batch_op.drop_column("scholar_metadata")
        batch_op.alter_column(
            "processing_status",
            type_=sa.Enum(
                "pending", "processing", "done", "failed",
                name="paper_status"
            ),
            existing_type=sa.Enum(
                "awaiting_metadata", "pending", "processing", "done", "failed",
                name="paper_status"
            ),
        )
