"""enhance crop_listing: variety, harvest_date, MOQ, grade, images, inquiries

Revision ID: c1d2e3f4a5b6
Revises: b4907751451e
Create Date: 2026-07-03 10:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, Sequence[str], None] = "b4907751451e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -------- crop_listings: add columns --------
    with op.batch_alter_table("crop_listings") as batch:
        # Widen image column to TEXT (previously VARCHAR(1024)) so base64 covers fit
        batch.alter_column(
            "image",
            existing_type=sa.String(length=1024),
            type_=sa.Text(),
            existing_nullable=True,
        )
        batch.add_column(sa.Column("crop_variety", sa.String(length=150), nullable=True))
        batch.add_column(sa.Column("harvest_date", sa.Date(), nullable=True))
        batch.add_column(sa.Column("minimum_order_quantity", sa.Numeric(12, 2), nullable=True))
        batch.add_column(sa.Column("minimum_order_unit", sa.String(length=20), nullable=True))
        batch.add_column(sa.Column("quality_grade", sa.String(length=32), nullable=True))
        batch.add_column(sa.Column("available_quantity", sa.Numeric(12, 2), nullable=True))
        batch.add_column(sa.Column("packaging_type", sa.String(length=100), nullable=True))
        batch.add_column(sa.Column("moisture_percentage", sa.Numeric(5, 2), nullable=True))
        batch.add_column(
            sa.Column("delivery_available", sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch.add_column(
            sa.Column("pickup_available", sa.Boolean(), nullable=False, server_default=sa.true())
        )
        batch.add_column(sa.Column("certificate_url", sa.Text(), nullable=True))
        batch.add_column(sa.Column("storage_condition", sa.String(length=150), nullable=True))
        batch.add_column(sa.Column("expected_delivery_days", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("preferred_payment", sa.String(length=50), nullable=True))
        batch.add_column(
            sa.Column("lab_tested", sa.Boolean(), nullable=False, server_default=sa.false())
        )

    op.create_index("ix_crop_listings_crop_variety", "crop_listings", ["crop_variety"])
    op.create_index("ix_crop_listings_harvest_date", "crop_listings", ["harvest_date"])
    op.create_index("ix_crop_listings_quality_grade", "crop_listings", ["quality_grade"])

    # -------- crop_images --------
    op.create_table(
        "crop_images",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("crop_listing_id", sa.BigInteger(), nullable=False),
        sa.Column("image_url", sa.Text(), nullable=False),
        sa.Column("is_cover", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["crop_listing_id"], ["crop_listings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_crop_images_crop_listing_id", "crop_images", ["crop_listing_id"])
    op.create_index("ix_crop_images_deleted_at", "crop_images", ["deleted_at"])

    # -------- crop_inquiries --------
    op.create_table(
        "crop_inquiries",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("inquiry_uid", sa.String(length=48), nullable=False),
        sa.Column("crop_listing_id", sa.BigInteger(), nullable=False),
        sa.Column("buyer_id", sa.BigInteger(), nullable=False),
        sa.Column("seller_id", sa.BigInteger(), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 2), nullable=True),
        sa.Column("offered_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["crop_listing_id"], ["crop_listings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["buyer_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["seller_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("inquiry_uid"),
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_crop_inquiries_inquiry_uid", "crop_inquiries", ["inquiry_uid"])
    op.create_index("ix_crop_inquiries_crop_listing_id", "crop_inquiries", ["crop_listing_id"])
    op.create_index("ix_crop_inquiries_buyer_id", "crop_inquiries", ["buyer_id"])
    op.create_index("ix_crop_inquiries_seller_id", "crop_inquiries", ["seller_id"])
    op.create_index("ix_crop_inquiries_status", "crop_inquiries", ["status"])
    op.create_index("ix_crop_inquiries_deleted_at", "crop_inquiries", ["deleted_at"])


def downgrade() -> None:
    op.drop_index("ix_crop_inquiries_deleted_at", table_name="crop_inquiries")
    op.drop_index("ix_crop_inquiries_status", table_name="crop_inquiries")
    op.drop_index("ix_crop_inquiries_seller_id", table_name="crop_inquiries")
    op.drop_index("ix_crop_inquiries_buyer_id", table_name="crop_inquiries")
    op.drop_index("ix_crop_inquiries_crop_listing_id", table_name="crop_inquiries")
    op.drop_index("ix_crop_inquiries_inquiry_uid", table_name="crop_inquiries")
    op.drop_table("crop_inquiries")

    op.drop_index("ix_crop_images_deleted_at", table_name="crop_images")
    op.drop_index("ix_crop_images_crop_listing_id", table_name="crop_images")
    op.drop_table("crop_images")

    op.drop_index("ix_crop_listings_quality_grade", table_name="crop_listings")
    op.drop_index("ix_crop_listings_harvest_date", table_name="crop_listings")
    op.drop_index("ix_crop_listings_crop_variety", table_name="crop_listings")

    with op.batch_alter_table("crop_listings") as batch:
        for col in [
            "lab_tested", "preferred_payment", "expected_delivery_days",
            "storage_condition", "certificate_url", "pickup_available",
            "delivery_available", "moisture_percentage", "packaging_type",
            "available_quantity", "quality_grade", "minimum_order_unit",
            "minimum_order_quantity", "harvest_date", "crop_variety",
        ]:
            batch.drop_column(col)
        batch.alter_column(
            "image",
            existing_type=sa.Text(),
            type_=sa.String(length=1024),
            existing_nullable=True,
        )
