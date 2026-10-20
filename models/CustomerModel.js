const pool = require("../config/database");

function appError(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function escapeLike(value) {
    return value.replace(/[!%_]/g, character => "!" + character);
}

const CustomerModel = {
    async list(filters) {
        const conditions = ["role = 'user'"];
        const params = [];

        if (filters.q) {
            const pattern = `%${escapeLike(filters.q)}%`;

            conditions.push(`
                (
                    full_name LIKE ? ESCAPE '!'
                    OR email LIKE ? ESCAPE '!'
                    OR phone LIKE ? ESCAPE '!'
                )
            `);

            params.push(pattern, pattern, pattern);
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

        const where = conditions.join(" AND ");

        const [countRows] = await pool.execute(
            `SELECT COUNT(*) AS total FROM users WHERE ${where}`,
            params
        );

        const total = Number(countRows[0].total);
        const pageSize = 10;
        const pages = Math.max(1, Math.ceil(total / pageSize));
        const page = Math.min(filters.page, pages);
        const offset = (page - 1) * pageSize;

        const [rows] = await pool.execute(
            `SELECT
                id, full_name, email, phone, status,
                DATE_FORMAT(created_at, '%d/%m/%Y %H:%i')
                    AS registered_at
             FROM users
             WHERE ${where}
             ORDER BY created_at DESC, id DESC
             LIMIT ${pageSize} OFFSET ${offset}`,
            params
        );

        return { rows, total, page, pages, pageSize };
    },

    async find(id) {
        const [rows] = await pool.execute(
            `SELECT
                id, full_name, last_name, first_name, email, phone,
                gender, province, district, ward, address,
                status, blocked_reason, management_version,
                DATE_FORMAT(birthday, '%d/%m/%Y') AS birthday_text,
                DATE_FORMAT(created_at, '%d/%m/%Y %H:%i')
                    AS registered_at,
                DATE_FORMAT(blocked_at, '%d/%m/%Y %H:%i')
                    AS blocked_at_text
             FROM users
             WHERE id = ? AND role = 'user'
             LIMIT 1`,
            [id]
        );

        return rows[0];
    },

    async orders(customerId, requestedPage) {
        const [counts] = await pool.execute(
            `SELECT COUNT(*) AS total
             FROM orders WHERE customer_id = ?`,
            [customerId]
        );

        const total = Number(counts[0].total);
        const pageSize = 10;
        const pages = Math.max(1, Math.ceil(total / pageSize));
        const page = Math.min(requestedPage, pages);
        const offset = (page - 1) * pageSize;

        const [rows] = await pool.execute(
            `SELECT
                id, order_number, total_amount, status,
                customer_name, customer_phone, shipping_address,
                DATE_FORMAT(created_at, '%d/%m/%Y %H:%i') AS ordered_at
             FROM orders
             WHERE customer_id = ?
             ORDER BY created_at DESC, id DESC
             LIMIT ${pageSize} OFFSET ${offset}`,
            [customerId]
        );

        return { rows, total, page, pages };
    },

    async statusLogs(customerId) {
        const [rows] = await pool.execute(
            `SELECT
                log.previous_status,
                log.new_status,
                log.reason,
                admin.full_name AS admin_name,
                DATE_FORMAT(log.created_at, '%d/%m/%Y %H:%i')
                    AS changed_at
             FROM customer_status_logs log
             JOIN users admin ON admin.id = log.admin_id
             WHERE log.customer_id = ?
             ORDER BY log.created_at DESC, log.id DESC
             LIMIT 20`,
            [customerId]
        );

        return rows;
    },

    async updateProfile(id, data) {
        const [result] = await pool.execute(
            `UPDATE users
             SET
                full_name = ?,
                last_name = ?,
                first_name = ?,
                phone = ?,
                province = ?,
                district = ?,
                ward = ?,
                address = ?,
                management_version = management_version + 1
             WHERE id = ?
               AND role = 'user'
               AND management_version = ?`,
            [
                data.full_name,
                data.last_name,
                data.first_name,
                data.phone,
                data.province,
                data.district,
                data.ward,
                data.address,
                id,
                data.version
            ]
        );

        if (!result.affectedRows) {
            throw appError(
                "Hồ sơ đã thay đổi hoặc không còn tồn tại. Hãy tải lại trang rồi sửa lại.",
                409
            );
        }
    },

    async changeStatus(id, adminId, data) {
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const [rows] = await connection.execute(
                `SELECT id, status, management_version
                 FROM users
                 WHERE id = ? AND role = 'user'
                 FOR UPDATE`,
                [id]
            );

            const customer = rows[0];

            if (!customer) {
                throw appError("Khách hàng không tồn tại.", 404);
            }

            if (
                String(customer.management_version) !==
                String(data.version)
            ) {
                throw appError(
                    "Hồ sơ đã được người khác thay đổi. Hãy tải lại trang.",
                    409
                );
            }

            if (customer.status === data.status) {
                throw appError("Tài khoản đã ở trạng thái được chọn.", 409);
            }

            await connection.execute(
                `UPDATE users
                 SET
                    status = ?,
                    blocked_reason = ?,
                    blocked_at = CASE
                        WHEN ? = 'blocked' THEN NOW()
                        ELSE NULL
                    END,
                    session_version = session_version + 1,
                    management_version = management_version + 1
                 WHERE id = ? AND role = 'user'`,
                [
                    data.status,
                    data.status === "blocked" ? data.reason : null,
                    data.status,
                    id
                ]
            );

            await connection.execute(
                `INSERT INTO customer_status_logs
                    (
                        customer_id, admin_id,
                        previous_status, new_status, reason
                    )
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    id,
                    adminId,
                    customer.status,
                    data.status,
                    data.reason
                ]
            );

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
};

module.exports = CustomerModel;