const pool = require("../config/database");

const MAX_PER_ITEM = 99;

const CartModel = {
    MAX_PER_ITEM,

    // Lấy danh sách sản phẩm trong giỏ kèm biến thể (Màu, Size, tồn kho của biến thể)
    async getItems(userId, cartItemIds = null) {
        const params = [userId];
        let filter = "";

        if (cartItemIds !== null) {
            if (cartItemIds.length === 0) return [];
            filter = `AND ci.id IN (${cartItemIds.map(() => "?").join(",")})`;
            params.push(...cartItemIds);
        }

        const [rows] = await pool.execute(
            `SELECT
                ci.id,
                ci.product_id,
                ci.variant_id,
                ci.quantity,
                p.name,
                p.image_url,
                COALESCE(pv.price, p.price) AS price,
                COALESCE(pv.stock, p.stock) AS stock,
                pv.color,
                pv.size,
                (ci.quantity * COALESCE(pv.price, p.price)) AS line_total
             FROM cart_items ci
             JOIN products p ON p.id = ci.product_id
             LEFT JOIN product_variants pv ON pv.id = ci.variant_id
             WHERE ci.user_id = ? ${filter}
             ORDER BY ci.updated_at DESC, ci.id DESC`,
            params
        );

        return rows;
    },

    async countItems(userId) {
        const [rows] = await pool.execute(
            `SELECT COALESCE(SUM(quantity), 0) AS total
             FROM cart_items
             WHERE user_id = ?`,
            [userId]
        );
        return Number(rows[0].total);
    },

    // Thêm sản phẩm kèm biến thể vào giỏ hàng
    async addItem(userId, productId, variantId, quantity) {
        let stock = 0;

        if (variantId) {
            const [variants] = await pool.execute(
                "SELECT stock FROM product_variants WHERE id = ? AND product_id = ? LIMIT 1",
                [variantId, productId]
            );
            if (variants.length === 0) return { status: "not_found" };
            stock = Number(variants[0].stock);
        } else {
            const [products] = await pool.execute(
                "SELECT stock FROM products WHERE id = ? LIMIT 1",
                [productId]
            );
            if (products.length === 0) return { status: "not_found" };
            stock = Number(products[0].stock);
        }

        if (stock <= 0) return { status: "out_of_stock" };

        const limit = Math.min(stock, MAX_PER_ITEM);

        const [current] = await pool.execute(
            `SELECT id, quantity FROM cart_items
             WHERE user_id = ? AND product_id = ? AND (variant_id <=> ?)
             LIMIT 1`,
            [userId, productId, variantId || null]
        );

        const wanted = (current[0] ? Number(current[0].quantity) : 0) + quantity;
        const finalQuantity = Math.min(wanted, limit);

        await pool.execute(
            `INSERT INTO cart_items (user_id, product_id, variant_id, quantity)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE quantity = ?`,
            [userId, productId, variantId || null, finalQuantity, finalQuantity]
        );

        return {
            status: "ok",
            quantity: finalQuantity,
            capped: finalQuantity < wanted
        };
    },

    // Cập nhật số lượng theo cart_item_id
    async setQuantity(userId, cartItemId, quantity) {
        const [rows] = await pool.execute(
            `SELECT ci.id, COALESCE(pv.stock, p.stock) AS stock
             FROM cart_items ci
             JOIN products p ON p.id = ci.product_id
             LEFT JOIN product_variants pv ON pv.id = ci.variant_id
             WHERE ci.user_id = ? AND ci.id = ?
             LIMIT 1`,
            [userId, cartItemId]
        );

        if (rows.length === 0) return { found: false };

        const limit = Math.min(Number(rows[0].stock), MAX_PER_ITEM);
        const finalQuantity = Math.max(1, Math.min(quantity, limit));

        await pool.execute(
            `UPDATE cart_items SET quantity = ? WHERE user_id = ? AND id = ?`,
            [finalQuantity, userId, cartItemId]
        );

        return {
            found: true,
            quantity: finalQuantity,
            capped: finalQuantity < quantity
        };
    },

    // Xóa sản phẩm khỏi giỏ theo cart_item_id
    async removeItem(userId, cartItemId) {
        const [result] = await pool.execute(
            `DELETE FROM cart_items WHERE user_id = ? AND id = ?`,
            [userId, cartItemId]
        );
        return result.affectedRows > 0;
    }
};

module.exports = CartModel;