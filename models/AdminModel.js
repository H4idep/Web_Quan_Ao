const pool = require("../config/database");

// Chỉ lấy tên bảng từ danh sách cố định, không lấy từ request.
const tables = {
    categories: "categories",
    products: "products"
};

const AdminModel = {
    async dashboard() {
        const [
            [productStats],
            [categoryStats],
            [orderStats],
            [revenueStats],
            [recentOrders],
            [lowStock]
        ] = await Promise.all([
            pool.query("SELECT COUNT(*) AS total FROM products"),
            pool.query("SELECT COUNT(*) AS total FROM categories"),
            pool.query(
                "SELECT COUNT(*) AS total FROM orders WHERE status = 'pending'"
            ),
            pool.query(
                `SELECT COALESCE(SUM(total_amount), 0) AS total
                 FROM orders WHERE status = 'completed'`
            ),
            pool.query(
                `SELECT id, order_number, customer_name, total_amount,
                        status, created_at
                 FROM orders
                 ORDER BY created_at DESC, id DESC
                 LIMIT 5`
            ),
            pool.query(
                `SELECT id, name, stock
                 FROM products
                 WHERE stock <= 5
                 ORDER BY stock ASC, id DESC
                 LIMIT 5`
            )
        ]);

        return {
            productCount: productStats[0].total,
            categoryCount: categoryStats[0].total,
            pendingCount: orderStats[0].total,
            completedRevenue: revenueStats[0].total,
            recentOrders,
            lowStock
        };
    },

    async list(kind, keyword, requestedPage) {
        const table = tables[kind];

        if (!table) {
            throw new Error("Loại dữ liệu không hợp lệ.");
        }

        const pattern = `%${keyword}%`;

        const [countRows] = await pool.execute(
            `SELECT COUNT(*) AS total FROM ${table} WHERE name LIKE ?`,
            [pattern]
        );

        const total = Number(countRows[0].total);
        const pageSize = 10;
        const pages = Math.max(1, Math.ceil(total / pageSize));
        const page = Math.min(requestedPage, pages);
        const offset = (page - 1) * pageSize;

        let rows;

        if (kind === "products") {
            [rows] = await pool.execute(
                `SELECT p.*, c.name AS category_name
                 FROM products p
                 JOIN categories c ON c.id = p.category_id
                 WHERE p.name LIKE ?
                 ORDER BY p.created_at DESC, p.id DESC
                 LIMIT ${pageSize} OFFSET ${offset}`,
                [pattern]
            );
        } else {
            [rows] = await pool.execute(
                `SELECT c.*,
                    (SELECT COUNT(*) FROM products p
                     WHERE p.category_id = c.id) AS product_count
                 FROM categories c
                 WHERE c.name LIKE ?
                 ORDER BY c.created_at DESC, c.id DESC
                 LIMIT ${pageSize} OFFSET ${offset}`,
                [pattern]
            );
        }

        return { rows, total, page, pages };
    },

    async find(kind, id) {
        const table = tables[kind];

        if (!table) {
            throw new Error("Loại dữ liệu không hợp lệ.");
        }

        const [rows] = await pool.execute(
            `SELECT * FROM ${table} WHERE id = ? LIMIT 1`,
            [id]
        );

        return rows[0];
    },

    async categoryOptions() {
    const [rows] = await pool.query(`
        SELECT
            c.id,
            CONCAT(parent.name, ' / ', c.name) AS name
        FROM categories c
        JOIN categories parent ON parent.id = c.parent_id
        WHERE parent.parent_id IS NULL
          AND parent.name IN ('Nam', 'Nữ')
        ORDER BY parent.name, c.name
    `);

    return rows;
    },

    async parentOptions() {
        const [rows] = await pool.query(`
            SELECT id, name
            FROM categories
            WHERE parent_id IS NULL
            AND name IN ('Nam', 'Nữ')
            ORDER BY name
        `);

        return rows;
    },

    async hasChildren(id) {
        const [rows] = await pool.execute(
            `SELECT id
            FROM categories
            WHERE parent_id = ?
            LIMIT 1`,
            [id]
        );

        return rows.length > 0;
    },

    async saveCategory(id, data) {
        if (id) {
            return pool.execute(
                `UPDATE categories
                SET name = ?, description = ?, parent_id = ?
                WHERE id = ?`,
                [
                    data.name,
                    data.description,
                    data.parent_id,
                    id
                ]
            );
        }

        return pool.execute(
            `INSERT INTO categories (name, description, parent_id)
            VALUES (?, ?, ?)`,
            [
                data.name,
                data.description,
                data.parent_id
            ]
        );
    },

    async saveProduct(id, data) {
        const values = [
            data.category_id,
            data.name,
            data.description,
            data.price,
            data.stock,
            data.image_url
        ];

        if (id) {
            return pool.execute(
                `UPDATE products
                 SET category_id = ?, name = ?, description = ?,
                     price = ?, stock = ?, image_url = ?
                 WHERE id = ?`,
                [...values, id]
            );
        }

        return pool.execute(
            `INSERT INTO products
                (category_id, name, description, price, stock, image_url)
             VALUES (?, ?, ?, ?, ?, ?)`,
            values
        );
    },

    async remove(kind, id) {
        const table = tables[kind];

        if (!table) {
            throw new Error("Loại dữ liệu không hợp lệ.");
        }

        const [result] = await pool.execute(
            `DELETE FROM ${table} WHERE id = ?`,
            [id]
        );

        return result.affectedRows;
    }
};

module.exports = AdminModel;