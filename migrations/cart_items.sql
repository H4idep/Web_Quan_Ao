-- chạy file này trên db để C bảng 'GIỎ HÀNG'

CREATE TABLE IF NOT EXISTS `cart_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `quantity` int unsigned NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  -- Mỗi sản phẩm chỉ xuất hiện 1 dòng trong giỏ của 1 người.
  UNIQUE KEY `uq_cart_user_product` (`user_id`,`product_id`),
  KEY `idx_cart_product` (`product_id`),
  -- Xóa tài khoản hoặc sản phẩm thì dòng giỏ hàng tự biến mất.
  CONSTRAINT `fk_cart_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cart_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_cart_quantity` CHECK (`quantity` BETWEEN 1 AND 99)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
