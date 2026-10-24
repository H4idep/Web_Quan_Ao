CREATE TABLE IF NOT EXISTS order_status_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id BIGINT UNSIGNED NOT NULL,
    admin_id INT UNSIGNED NOT NULL,

    previous_status ENUM(
        'pending', 'processing', 'shipped', 'completed', 'cancelled'
    ) NOT NULL,

    new_status ENUM(
        'pending', 'processing', 'shipped', 'completed', 'cancelled'
    ) NOT NULL,

    reason VARCHAR(500) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_order_status_logs_order (order_id, created_at),

    CONSTRAINT fk_order_status_logs_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_order_status_logs_admin
        FOREIGN KEY (admin_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;