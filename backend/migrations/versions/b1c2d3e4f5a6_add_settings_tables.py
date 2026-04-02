"""add_settings_tables

Revision ID: b1c2d3e4f5a6
Revises: a1b2c3d4e5f6
Create Date: 2026-04-02

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'user_profile',
        sa.Column('user_id', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('display_name', sa.Text(), nullable=True),
        sa.Column('institution', sa.Text(), nullable=True),
        sa.Column('research_area', sa.Text(), nullable=True),
        sa.Column('research_interests', sa.Text(), nullable=True),
        sa.Column('academic_stage', sa.Text(), nullable=True),
        sa.Column('default_view', sa.Text(), nullable=False, server_default='library'),
        sa.Column('analysis_language', sa.Text(), nullable=False, server_default='english'),
        sa.Column('auto_retry', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('user_id'),
    )
    op.create_table(
        'model_config',
        sa.Column('user_id', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('preset', sa.Text(), nullable=True),
        sa.Column('provider', sa.Text(), nullable=True),
        sa.Column('anthropic_api_key', sa.Text(), nullable=True),
        sa.Column('vlm_api_key', sa.Text(), nullable=True),
        sa.Column('vlm_base_url', sa.Text(), nullable=True),
        sa.Column('vlm_model', sa.Text(), nullable=True),
        sa.Column('vlm_text_model', sa.Text(), nullable=True),
        sa.Column('last_tested_at', sa.DateTime(), nullable=True),
        sa.Column('last_test_status', sa.Text(), nullable=True),
        sa.Column('last_test_latency_ms', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('user_id'),
    )


def downgrade() -> None:
    op.drop_table('model_config')
    op.drop_table('user_profile')
