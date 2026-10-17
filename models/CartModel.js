const pool = require("../config/database");

// Tối đa mỗi sản phẩm trong giỏ (khớp CHECK trong bảng cart_items).
const MAX_PER_ITEM = 99;

const CartModel = {
    MAX_PER_ITEM,

    // Giá và tồn kho luôn lấy từ bảng products, không lưu trong giỏ,
    // nên admin đổi giá thì giỏ cập nhật theo.
    async getItems(userId) {
        const [rows] = await pool.execute(
            `SELECT
                ci.product_id,
                ci.quantity,
                p.name,
                p.price,
                p.stock,
                p.image_url,
                (ci.quantity * p.price) AS line_total
             FROM cart_items ci
             JOIN products p ON p.id = ci.product_id
             WHERE ci.user_id = ?
             ORDER BY ci.updated_at DESC, ci.id DESC`,
            [userId]
        );

        return rows;
    },

    // Tổng số lượng sản phẩm, hiển thị cạnh biểu tượng giỏ hàng.
    async countItems(userId) {
        const [rows] = await pool.execute(
            `SELECT COALESCE(SUM(quantity), 0) AS total
             FROM cart_items
             WHERE user_id = ?`,
            [userId]
        );

        return Number(rows[0].total);
    },

    // Thêm sản phẩm. Nếu đã có thì cộng dồn, nhưng không vượt tồn kho.
    // Trả về { status: "not_found" | "out_of_stock" | "ok", quantity, capped }
    async addItem(userId, productId, quantity) {
        const [products] = await pool.execute(
            "SELECT stock FROM products WHERE id = ? LIMIT 1",
            [productId]
        );

        if (products.length === 0) {
            return { status: "not_found" };
        }

        const stock = Number(products[0].stock);

        if (stock <= 0) {
            return { status: "out_of_stock" };
        }

        const limit = Math.min(stock, MAX_PER_ITEM);

        const [current] = await pool.execute(
            `SELECT quantity FROM cart_items
             WHERE user_id = ? AND product_id = ?
             LIMIT 1`,
            [userId, productId]
        );

        const wanted = (current[0] ? Number(current[0].quantity) : 0) + quantity;
        const finalQuantity = Math.min(wanted, limit);

        await pool.execute(
            `INSERT INTO cart_items (user_id, product_id, quantity)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE quantity = ?`,
            [userId, productId, finalQuantity, finalQuantity]
        );

        return {
            status: "ok",
            quantity: finalQuantity,
            capped: finalQuantity < wanted
        };
    },

    // Đặt số lượng mới. Số lượng bị giới hạn bởi tồn kho.
    // Trả về { found, quantity, capped }
    async setQuantity(userId, productId, quantity) {
        const [rows] = await pool.execute(
            `SELECT p.stock
             FROM cart_items ci
             JOIN products p ON p.id = ci.product_id
             WHERE ci.user_id = ? AND ci.product_id = ?
             LIMIT 1`,
            [userId, productId]
        );

        if (rows.length === 0) {
            return { found: false };
        }

        const limit = Math.min(Number(rows[0].stock), MAX_PER_ITEM);

        // Sản phẩm hết hàng: giữ 1 để khách thấy và tự xóa.
        const finalQuantity = Math.max(1, Math.min(quantity, limit));

        await pool.execute(
            `UPDATE cart_items
             SET quantity = ?
             WHERE user_id = ? AND product_id = ?`,
            [finalQuantity, userId, productId]
        );

        return {
            found: true,
            quantity: finalQuantity,
            capped: finalQuantity < quantity
        };
    },

    async removeItem(userId, productId) {
        const [result] = await pool.execute(
            `DELETE FROM cart_items
             WHERE user_id = ? AND product_id = ?`,
            [userId, productId]
        );

        return result.affectedRows > 0;
    }
};

module.exports = CartModel;
