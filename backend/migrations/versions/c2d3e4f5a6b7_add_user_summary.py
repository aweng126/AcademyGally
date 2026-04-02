"""add user_summary table

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-04-02

"""
from alembic import op
import sqlalchemy as sa

revision = 'c2d3e4f5a6b7'
down_revision = 'b1c2d3e4f5a6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'user_summary',
        sa.Column('module_type', sa.Text(), nullable=False),
        sa.Column('principles', sa.Text(), nullable=True),
        sa.Column('materials', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('module_type'),
    )


def downgrade() -> None:
    op.drop_table('user_summary')
