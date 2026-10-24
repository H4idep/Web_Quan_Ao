const pool = require("../config/database");
const {
    TRANSITIONS,
    fail
} = require("../validators/adminOrderValidator");

function escapeLike(value) {
    return value.replace(/[!%_]/g, character => "!" + character);
}

const AdminOrderModel = {
    async list(filters) {
        const conditions = [];
        const params = [];

        if (filters.q) {
            const pattern = `%${escapeLike(filters.q)}%`;

            conditions.push(`(
                order_number LIKE ? ESCAPE '!'
                OR customer_name LIKE ? ESCAPE '!'
                OR customer_email LIKE ? ESCAPE '!'
                OR customer_phone LIKE ? ESCAPE '!'
            )`);

            params.push(pattern, pattern, pattern, pattern);
        }

        if (filters.status) {
            conditions.push("status = ?");
            params.push(filters.status);
        }

        if (filters.from) {
            conditions.push("created_at >= ?");
            params.push(filters.from);
        }

        if (filters.to) {
            conditions.push("created_at < DATE_ADD(?, INTERVAL 1 DAY)");
            params.push(filters.to);
        }

        const where = conditions.length
            ? "WHERE " + conditions.join(" AND ")
            : "";

        const [counts] = await pool.execute(
            `SELECT COUNT(*) AS total FROM orders ${where}`,
            params
        );

        const total = Number(counts[0].total);
        const pageSize = 10;
        const pages = Math.max(1, Math.ceil(total / pageSize));
        const page = Math.min(filters.page, pages);
        const offset = (page - 1) * pageSize;

        const [rows] = await pool.execute(
            `SELECT
                id, order_number, customer_name,
                customer_phone, total_amount, status,
                DATE_FORMAT(created_at, '%d/%m/%Y %H:%i') AS created_text
             FROM orders
             ${where}
             ORDER BY created_at DESC, id DESC
             LIMIT ${pageSize} OFFSET ${offset}`,
            params
        );

        return { rows, total, page, pages, pageSize };
    },

    async detail(id) {
        const [orders] = await pool.execute(
            `SELECT
                id, user_id, order_number,
                customer_name, customer_email, customer_phone,
                shipping_address, total_amount, status, notes,
                DATE_FORMAT(created_at, '%d/%m/%Y %H:%i') AS created_text
             FROM orders
             WHERE id = ?
             LIMIT 1`,
            [id]
        );

        if (!orders.length) return null;

        const [[items], [logs]] = await Promise.all([
            pool.execute(
                `SELECT
                    id, product_id, product_name,
                    unit_price, quantity, line_total
                 FROM order_items
                 WHERE order_id = ?
                 ORDER BY id`,
                [id]
            ),

            pool.execute(
                `SELECT
                    l.previous_status, l.new_status, l.reason,
                    u.full_name AS admin_name,
                    DATE_FORMAT(l.created_at, '%d/%m/%Y %H:%i:%s')
                        AS created_text
                 FROM order_status_logs l
                 JOIN users u ON u.id = l.admin_id
                 WHERE l.order_id = ?
                 ORDER BY l.id DESC`,
                [id]
            )
        ]);

        return { ...orders[0], items, logs };
    },

    async changeStatus(id, adminId, data) {
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            // Khóa đơn để hai yêu cầu không xử lý đồng thời.
            const [orders] = await connection.execute(
                "SELECT id, status FROM orders WHERE id = ? FOR UPDATE",
                [id]
            );

            const order = orders[0];

            if (!order) {
                throw fail("Không tìm thấy đơn hàng.", 404);
            }

            if (order.status !== data.expectedStatus) {
                throw fail(
                    "Đơn hàng đã được thay đổi. Hãy tải lại trang trước khi xử lý.",
                    409
                );
            }

            const allowed = TRANSITIONS[order.status] || [];

            if (!allowed.includes(data.status)) {
                throw fail("Không được chuyển sang trạng thái này.", 409);
            }

            if (data.status === "cancelled") {
                const [items] = await connection.execute(
                    `SELECT product_id, quantity
                     FROM order_items
                     WHERE order_id = ?
                     ORDER BY product_id, id
                     FOR UPDATE`,
                    [id]
                );

                // Đơn mẫu cũ không có chi tiết: không đoán số lượng hoàn kho.
                if (!items.length) {
                    throw fail(
                        "Đơn cũ chưa có chi tiết sản phẩm. Cần đối soát tồn kho trước khi hủy.",
                        409
                    );
                }

                for (const item of items) {
                    if (!item.product_id) {
                        throw fail(
                            "Một sản phẩm của đơn đã bị xóa. Cần đối soát trước khi hủy.",
                            409
                        );
                    }

                    const [result] = await connection.execute(
                        `UPDATE products
                         SET stock = stock + ?
                         WHERE id = ?
                           AND stock <= 4294967295 - ?`,
                        [item.quantity, item.product_id, item.quantity]
                    );

                    if (result.affectedRows !== 1) {
                        throw fail(
                            "Không thể hoàn kho sản phẩm. Đơn hàng chưa bị thay đổi.",
                            409
                        );
                    }
                }
            }

            await connection.execute(
                "UPDATE orders SET status = ? WHERE id = ?",
                [data.status, id]
            );

            await connection.execute(
                `INSERT INTO order_status_logs (
                    order_id, admin_id, previous_status, new_status, reason
                 ) VALUES (?, ?, ?, ?, ?)`,
                [id, adminId, order.status, data.status, data.reason]
            );

            await connection.commit();
        } catch (error) {
            try {
                await connection.rollback();
            } catch {
                // Giữ lại lỗi gốc nếu kết nối bị mất.
            }

            throw error;
        } finally {
            connection.release();
        }
    }
};

module.exports = AdminOrderModel;