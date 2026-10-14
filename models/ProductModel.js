const pool = require("../config/database");

const ProductModel = {
    async findAll() {
        const [rows] = await pool.query(`
            SELECT
                p.id,
                p.name,
                p.price,
                p.stock,
                p.image_url,
                c.name AS category_name
            FROM products p
            JOIN categories c ON c.id = p.category_id
            ORDER BY p.created_at DESC, p.id DESC
        `);

        return rows;
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