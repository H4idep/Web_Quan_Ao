const pool = require("../config/database");

const ProductModel = {
    async findAll(categoryId = null) {
        let sql = `
            SELECT
                p.id,
                p.name,
                p.price,
                p.stock,
                p.image_url,
                c.name AS category_name
            FROM products p
            JOIN categories c ON c.id = p.category_id
        `;

        const params = [];

        if (categoryId !== null) {
            sql += `
                WHERE c.id = ?
                OR c.parent_id = ?
            `;

            params.push(categoryId, categoryId);
        }

        sql += `
            ORDER BY p.created_at DESC, p.id DESC
        `;

        const [rows] = await pool.execute(sql, params);

        return rows;
    },

    async findCategoryById(id) {
        const [rows] = await pool.execute(
            `SELECT id, name, parent_id
            FROM categories
            WHERE id = ?
            LIMIT 1`,
            [id]
        );

        return rows[0];
    },

    async findById(id) {
        const [rows] = await pool.execute(
            `SELECT
                p.id,
                p.category_id,
                p.name,
                p.description,
                p.price,
                p.stock,
                p.image_url,
                c.name AS category_name
             FROM products p
             JOIN categories c ON c.id = p.category_id
             WHERE p.id = ?
             LIMIT 1`,
            [id]
        );

        return rows[0];
    }
};

module.exports = ProductModel;