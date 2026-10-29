const pool = require("../config/database");

function escapeLike(value) {
    return value.replace(/[!%_]/g, char => "!" + char);
}

const ProductModel = {
    async findAll(categoryId = null, keyword = null) {
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

        const conditions = [];
        const params = [];

        if (categoryId !== null) {
            conditions.push("(c.id = ? OR c.parent_id = ?)");
            params.push(categoryId, categoryId);
        }
        if (keyword) {
            const cleanKeyword = `%${escapeLike(keyword)}%`;
            conditions.push("p.name LIKE ? ESCAPE '!'");
            params.push(cleanKeyword);
        }
        if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(" AND ")} `;
        }

        sql += `
            ORDER BY p.created_at DESC, p.id DESC
        `;

        const [rows] = await pool.execute(sql, params);

        return rows;
    },

    async searchSuggestions(keyword, limit = 5) {
        if (!keyword) return [];
        const cleanKeyword = `%${escapeLike(keyword)}%`;
        const [rows] = await pool.execute(
            `SELECT
                p.id,
                p.name,
                p.price,
                p.image_url
             FROM products p
             WHERE p.name LIKE ? ESCAPE '!'
             ORDER BY p.created_at DESC, p.id DESC
             LIMIT ?`,
            [cleanKeyword, String(limit)]
        );
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