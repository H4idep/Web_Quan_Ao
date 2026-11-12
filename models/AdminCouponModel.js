const pool = require("../config/database");

const PAGE_SIZE = 10;

function escapeLike(value) {
    return value.replace(/[!%_]/g, character => "!" + character);
}

function statusSql() {
    return `CASE
        WHEN c.is_active = 0 THEN 'disabled'
        WHEN c.start_date > NOW() THEN 'upcoming'
        WHEN c.end_date < NOW() THEN 'expired'
        WHEN c.usage_limit IS NOT NULL AND c.used_count >= c.usage_limit THEN 'exhausted'
        ELSE 'running'
    END`;
}

function conditionsFor(filters) {
    const conditions = [];
    const params = [];

    if (filters.q) {
        const pattern = `%${escapeLike(filters.q)}%`;
        conditions.push("(c.code LIKE ? ESCAPE '!' OR c.description LIKE ? ESCAPE '!')");
        params.push(pattern, pattern);
    }

    if (filters.status) {
        conditions.push(`${statusSql()} = ?`);
        params.push(filters.status);
    }

    return {
        where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
        params
    };
}

const AdminCouponModel = {
    async list(filters) {
        const { where, params } = conditionsFor(filters);
        const [countRows] = await pool.execute(
            `SELECT COUNT(*) AS total FROM coupons c ${where}`,
            params
        );
        const total = Number(countRows[0].total);
        const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const page = Math.min(filters.page, pages);
        const offset = (page - 1) * PAGE_SIZE;
        const [rows] = await pool.execute(
            `SELECT c.*,
                    ${statusSql()} AS coupon_status,
                    DATE_FORMAT(c.start_date, '%d/%m/%Y %H:%i') AS start_date_display,
                    DATE_FORMAT(c.end_date, '%d/%m/%Y %H:%i') AS end_date_display
             FROM coupons c
             ${where}
             ORDER BY c.created_at DESC, c.id DESC
             LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
            params
        );
        return { rows, total, page, pages, pageSize: PAGE_SIZE };
    },

    async findById(id) {
        const [rows] = await pool.execute(
            `SELECT c.*,
                    DATE_FORMAT(c.start_date, '%Y-%m-%dT%H:%i') AS start_date_input,
                    DATE_FORMAT(c.end_date, '%Y-%m-%dT%H:%i') AS end_date_input
             FROM coupons c
             WHERE c.id = ?
             LIMIT 1`,
            [id]
        );
        return rows[0] || null;
    },

    async codeExists(code, excludeId = null) {
        const [rows] = excludeId
            ? await pool.execute(
                "SELECT id FROM coupons WHERE code = ? AND id <> ? LIMIT 1",
                [code, excludeId]
            )
            : await pool.execute(
                "SELECT id FROM coupons WHERE code = ? LIMIT 1",
                [code]
            );
        return rows.length > 0;
    },

    async create(data) {
        const [result] = await pool.execute(
            `INSERT INTO coupons
                (code, description, discount_type, discount_value, max_discount_amount,
                 min_order_value, usage_limit, start_date, end_date, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.code,
                data.description,
                data.discount_type,
                data.discount_value,
                data.max_discount_amount,
                data.min_order_value,
                data.usage_limit,
                data.start_date,
                data.end_date,
                data.is_active
            ]
        );
        return result.insertId;
    },

    async update(id, data) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [rows] = await connection.execute(
                "SELECT id FROM coupons WHERE id = ? FOR UPDATE",
                [id]
            );
            if (!rows.length) {
                await connection.rollback();
                return false;
            }

            await connection.execute(
                `UPDATE coupons
                 SET code = ?, description = ?, discount_type = ?, discount_value = ?,
                     max_discount_amount = ?, min_order_value = ?, usage_limit = ?,
                     start_date = ?, end_date = ?, is_active = ?
                 WHERE id = ?`,
                [
                    data.code,
                    data.description,
                    data.discount_type,
                    data.discount_value,
                    data.max_discount_amount,
                    data.min_order_value,
                    data.usage_limit,
                    data.start_date,
                    data.end_date,
                    data.is_active,
                    id
                ]
            );
            await connection.commit();
            return true;
        } catch (error) {
            try {
                await connection.rollback();
            } catch {
                // Giữ nguyên lỗi SQL gốc.
            }
            throw error;
        } finally {
            connection.release();
        }
    },

    async toggle(id) {
        const [result] = await pool.execute(
            "UPDATE coupons SET is_active = IF(is_active = 1, 0, 1) WHERE id = ?",
            [id]
        );
        return result.affectedRows > 0;
    },

    async remove(id) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [coupons] = await connection.execute(
                "SELECT id, used_count FROM coupons WHERE id = ? FOR UPDATE",
                [id]
            );
            if (!coupons.length) {
                await connection.rollback();
                return { found: false, blocked: false };
            }

            const [orders] = await connection.execute(
                "SELECT id FROM orders WHERE coupon_id = ? LIMIT 1 FOR UPDATE",
                [id]
            );
            if (orders.length || Number(coupons[0].used_count) > 0) {
                await connection.rollback();
                return { found: true, blocked: true };
            }

            await connection.execute("DELETE FROM coupons WHERE id = ?", [id]);
            await connection.commit();
            return { found: true, blocked: false };
        } catch (error) {
            try {
                await connection.rollback();
            } catch {
                // Giữ nguyên lỗi SQL gốc.
            }
            throw error;
        } finally {
            connection.release();
        }
    }
};

module.exports = AdminCouponModel;
