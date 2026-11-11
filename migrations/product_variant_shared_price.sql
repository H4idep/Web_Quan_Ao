USE `web_quan_ao`;

-- Product prices are authoritative; keep historical order item prices unchanged.
UPDATE `product_variants`
SET `price` = NULL
WHERE `id` > 0
  AND `price` IS NOT NULL;
