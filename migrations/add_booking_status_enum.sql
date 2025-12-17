ALTER TYPE "public"."booking_status" ADD VALUE IF NOT EXISTS 'pending_approval';
ALTER TYPE "public"."booking_status" ADD VALUE IF NOT EXISTS 'pending_payment';
