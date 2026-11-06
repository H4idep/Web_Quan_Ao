-- Bước 3: Thanh toán.
-- Chạy file này MỘT LẦN (sau 001 và 002).

ALTER TABLE `orders`
  -- Đơn cũ (trước bước này) mặc định là COD.
  ADD COLUMN `payment_method` enum('cod','bank_transfer') NOT NULL DEFAULT 'cod' AFTER `total_amount`,
  ADD COLUMN `payment_status` enum('unpaid','paid') NOT NULL DEFAULT 'unpaid' AFTER `payment_method`,
  ADD COLUMN `paid_at` timestamp NULL DEFAULT NULL AFTER `payment_status`,
  -- Mã giao dịch ngân hàng. UNIQUE để một giao dịch không được dùng cho 2 đơn,
  -- và để ngân hàng gửi lại cùng một thông báo không bị tính hai lần.
  ADD COLUMN `payment_reference` varchar(100) NULL DEFAULT NULL AFTER `paid_at`,
  ADD UNIQUE KEY `uq_orders_payment_reference` (`payment_reference`);
