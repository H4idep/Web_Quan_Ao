
-- 1. Tạo bảng lưu trữ mã giảm giá
CREATE TABLE IF NOT EXISTS `coupons` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `discount_type` ENUM('percentage', 'fixed') NOT NULL COMMENT 'percentage: giảm theo %, fixed: giảm tiền mặt',
  `discount_value` DECIMAL(12,2) NOT NULL COMMENT 'Giá trị giảm (% hoặc VNĐ)',
  `max_discount_amount` DECIMAL(12,2) NULL DEFAULT NULL COMMENT 'Mức giảm tối đa đối với mã % (NULL nếu không giới hạn)',
  `min_order_value` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Giá trị đơn tối thiểu để áp dụng',
  `usage_limit` INT UNSIGNED NULL DEFAULT NULL COMMENT 'Tổng số lượt sử dụng tối đa (NULL là không giới hạn)',
  `used_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Số lượt đã sử dụng',
  `start_date` DATETIME NULL DEFAULT NULL COMMENT 'Ngày bắt đầu hiệu lực',
  `end_date` DATETIME NULL DEFAULT NULL COMMENT 'Ngày hết hạn',
  `is_active` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '1: Hoạt động, 0: Đang khóa',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_coupons_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Thêm cột lưu thông tin giảm giá vào bảng orders
ALTER TABLE `orders`
  ADD COLUMN `coupon_id` BIGINT UNSIGNED NULL AFTER `user_id`,
  ADD COLUMN `coupon_code` VARCHAR(50) NULL AFTER `coupon_id`,
  ADD COLUMN `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `shipping_address`,
  ADD CONSTRAINT `fk_orders_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Nạp sẵn 5 mã giảm giá mẫu để kiểm tra các trường hợp
INSERT INTO `coupons` (`code`, `description`, `discount_type`, `discount_value`, `max_discount_amount`, `min_order_value`, `usage_limit`, `used_count`, `start_date`, `end_date`, `is_active`)
VALUES
  -- Giảm 10% tối đa 50.000đ cho đơn từ 200.000đ
  ('ROUTINE10', 'Giảm 10% tối đa 50k cho đơn từ 200k', 'percentage', 10.00, 50000.00, 200000.00, 100, 0, NOW() - INTERVAL 1 DAY, NOW() + INTERVAL 30 DAY, 1),
  
  -- Giảm thẳng 50.000đ cho đơn từ 300.000đ
  ('GIAM50K', 'Giảm 50.000đ cho đơn từ 300.000đ', 'fixed', 50000.00, NULL, 300000.00, 50, 0, NOW() - INTERVAL 1 DAY, NOW() + INTERVAL 30 DAY, 1),

  -- Giảm thẳng 30.000đ cho mọi đơn hàng (không giới hạn đơn tối thiểu)
  ('FREESHIP', 'Hỗ trợ giảm 30.000đ phí giao hàng', 'fixed', 30000.00, NULL, 0.00, NULL, 0, NOW() - INTERVAL 1 DAY, NOW() + INTERVAL 30 DAY, 1),

  -- Mã thử nghiệm: Hết lượt sử dụng
  ('HETLƯOT', 'Mã đã hết lượt dùng', 'fixed', 20000.00, NULL, 0.00, 5, 5, NOW() - INTERVAL 1 DAY, NOW() + INTERVAL 30 DAY, 1),

  -- Mã thử nghiệm: Hết hạn sử dụng
  ('HETHAN', 'Mã đã hết hạn', 'fixed', 20000.00, NULL, 0.00, 100, 0, NOW() - INTERVAL 10 DAY, NOW() - INTERVAL 1 DAY, 1)
ON DUPLICATE KEY UPDATE `code` = `code`;