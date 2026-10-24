-- Gắn đơn hàng với tài khoản đặt hàng.
-- NULL cho phép giữ các đơn cũ chưa có chủ, và giữ lịch sử đơn nếu tài khoản bị xóa.
ALTER TABLE `orders`
  ADD COLUMN `user_id` int unsigned NULL AFTER `id`,
  ADD KEY `idx_orders_user_created` (`user_id`,`created_at`),
  ADD CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Chi tiết từng dòng của đơn. Lưu SẴN tên và đơn giá tại thời điểm mua,
-- nên admin đổi giá hoặc xóa sản phẩm sau này cũng không làm sai đơn cũ.
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL,
  `product_id` bigint unsigned NULL,
  `product_name` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `unit_price` decimal(12,2) NOT NULL,
  `quantity` int unsigned NOT NULL,
  `line_total` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_order_items_order` (`order_id`),
  KEY `idx_order_items_product` (`product_id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_order_items_quantity` CHECK (`quantity` >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;




