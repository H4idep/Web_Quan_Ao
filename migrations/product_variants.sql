USE `web_quan_ao`;

-- 1. Bảng lưu các biến thể (Màu sắc, Size, Tồn kho riêng)
CREATE TABLE IF NOT EXISTS `product_variants` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `color` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên màu sắc (Đen, Trắng, Be...)',
  `size` VARCHAR(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Kích cỡ (S, M, L, XL, 2XL...)',
  `sku` VARCHAR(50) COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT 'Mã phân loại kho',
  `stock` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Số lượng tồn kho của biến thể này',
  `price` DECIMAL(12,2) NULL DEFAULT NULL COMMENT 'Giá riêng nếu khác giá gốc sản phẩm (NULL là lấy giá gốc)',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_color_size` (`product_id`, `color`, `size`),
  KEY `idx_variants_product` (`product_id`),
  CONSTRAINT `fk_variants_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Thêm variant_id vào bảng cart_items
ALTER TABLE `cart_items`
  ADD COLUMN `variant_id` BIGINT UNSIGNED NULL AFTER `product_id`,
  DROP INDEX `uq_cart_user_product`,
  ADD UNIQUE KEY `uq_cart_user_product_variant` (`user_id`, `product_id`, `variant_id`),
  ADD CONSTRAINT `fk_cart_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Thêm variant_id, color, size vào bảng order_items
ALTER TABLE `order_items`
  ADD COLUMN `variant_id` BIGINT UNSIGNED NULL AFTER `product_id`,
  ADD COLUMN `color` VARCHAR(50) NULL AFTER `product_name`,
  ADD COLUMN `size` VARCHAR(20) NULL AFTER `color`,
  ADD CONSTRAINT `fk_order_items_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Nạp dữ liệu biến thể mẫu cho các sản phẩm hiện có
-- SP3: Áo phông (Đen, Trắng x Size S, M, L, XL)
INSERT INTO `product_variants` (`product_id`, `color`, `size`, `sku`, `stock`) VALUES
  (3, 'Đen', 'S', 'SP3-DEN-S', 15),
  (3, 'Đen', 'M', 'SP3-DEN-M', 20),
  (3, 'Đen', 'L', 'SP3-DEN-L', 10),
  (3, 'Đen', 'XL', 'SP3-DEN-XL', 5),
  (3, 'Trắng', 'S', 'SP3-TRANG-S', 0), -- Thử nghiệm hết hàng
  (3, 'Trắng', 'M', 'SP3-TRANG-M', 18),
  (3, 'Trắng', 'L', 'SP3-TRANG-L', 12),
  (3, 'Trắng', 'XL', 'SP3-TRANG-XL', 8)
ON DUPLICATE KEY UPDATE `stock` = VALUES(`stock`);

-- SP4: Váy mùa thu (Be, Hồng x Size S, M, L)
INSERT INTO `product_variants` (`product_id`, `color`, `size`, `sku`, `stock`) VALUES
  (4, 'Be', 'S', 'SP4-BE-S', 25),
  (4, 'Be', 'M', 'SP4-BE-M', 30),
  (4, 'Be', 'L', 'SP4-BE-L', 15),
  (4, 'Hồng pastel', 'S', 'SP4-HONG-S', 10),
  (4, 'Hồng pastel', 'M', 'SP4-HONG-M', 20),
  (4, 'Hồng pastel', 'L', 'SP4-HONG-L', 0)
ON DUPLICATE KEY UPDATE `stock` = VALUES(`stock`);


-- 1. Tự động cộng tổng khi THÊM biến thể mới
CREATE TRIGGER `trg_after_insert_variant`
AFTER INSERT ON `product_variants`
FOR EACH ROW
UPDATE `products`
SET `stock` = (SELECT COALESCE(SUM(stock), 0) FROM `product_variants` WHERE `product_id` = NEW.product_id)
WHERE `id` = NEW.product_id;

-- 2. Tự động tính lại tổng khi SỬA số lượng biến thể
CREATE TRIGGER `trg_after_update_variant`
AFTER UPDATE ON `product_variants`
FOR EACH ROW
UPDATE `products`
SET `stock` = (SELECT COALESCE(SUM(stock), 0) FROM `product_variants` WHERE `product_id` = NEW.product_id)
WHERE `id` = NEW.product_id;

-- 3. Tự động trừ tổng khi XÓA biến thể
CREATE TRIGGER `trg_after_delete_variant`
AFTER DELETE ON `product_variants`
FOR EACH ROW
UPDATE `products`
SET `stock` = (SELECT COALESCE(SUM(stock), 0) FROM `product_variants` WHERE `product_id` = OLD.product_id)
WHERE `id` = OLD.product_id;


UPDATE `products` p
SET p.stock = (
    SELECT COALESCE(SUM(pv.stock), 0)
    FROM `product_variants` pv
    WHERE pv.product_id = p.id
)
WHERE EXISTS (
    SELECT 1 FROM `product_variants` pv WHERE pv.product_id = p.id
);