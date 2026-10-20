const pool = require("../config/database");

const UserModel = {
    async findByEmail(email) {
        const [rows] = await pool.execute(
            `SELECT id, full_name, email, password_hash, role, status, session_version
             FROM users
             WHERE email = ?
             LIMIT 1`,
            [email]
        );

        return rows[0];
    },

    async findSessionUser(id) {
        const [rows] = await pool.execute(
            `SELECT id, full_name, email, role, status, session_version
             FROM users
             WHERE id = ?
             LIMIT 1`,
            [id]
        );

        return rows[0];
    },

    async create(data, passwordHash) {
        const [result] = await pool.execute(
            `INSERT INTO users (
                full_name,
                last_name,
                first_name,
                email,
                password_hash,
                phone,
                birthday,
                gender,
                province,
                district,
                ward,
                address,
                newsletter,
                terms_accepted_at,
                role,
                status
            )
            VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                NOW(), 'user', 'active'
            )`,
            [
                data.fullName,
                data.lastName,
                data.firstName,
                data.email,
                passwordHash,
                data.phone,
                data.birthday,
                data.gender,
                data.province,
                data.district,
                data.ward,
                data.address,
                data.newsletter ? 1 : 0
            ]
        );

        return result.insertId;
    }
};

module.exports = UserModel;