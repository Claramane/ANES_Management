"""add line_accounts table

Revision ID: 20251211_add_line_accounts
Revises: 
Create Date: 2025-12-11
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20251211_add_line_accounts"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "line_accounts",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("line_user_id", sa.String(length=255), nullable=False, unique=True),
        sa.Column("display_name", sa.String(length=255), nullable=True),
        sa.Column("picture_url", sa.Text, nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_line_accounts_user_id", "line_accounts", ["user_id"])
    op.create_index("ix_line_accounts_status", "line_accounts", ["status"])


def downgrade():
    op.drop_index("ix_line_accounts_status", table_name="line_accounts")
    op.drop_index("ix_line_accounts_user_id", table_name="line_accounts")
    op.drop_table("line_accounts")
