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
                    (
                        SELECT COUNT(*)
                        FROM products p
                        JOIN categories product_category
                            ON product_category.id = p.category_id
                        WHERE product_category.id = c.id
                        OR product_category.parent_id = c.id
                    ) AS product_count
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

    async findProductVariants(productId) {
        const [rows] = await pool.execute(
            `SELECT id, color, size, sku, stock
             FROM product_variants
             WHERE product_id = ?
             ORDER BY color ASC, size ASC, id ASC`,
            [productId]
        );

        return rows;
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
        const connection = await pool.getConnection();
        const values = [
            data.category_id,
            data.name,
            data.description,
            data.price,
            data.stock,
            data.image_url
        ];

        try {
            await connection.beginTransaction();

            let productId = id;
            if (productId) {
                await connection.execute(
                    `UPDATE products
                     SET category_id = ?, name = ?, description = ?,
                         price = ?, stock = ?, image_url = ?
                     WHERE id = ?`,
                    [...values, productId]
                );
            } else {
                const [result] = await connection.execute(
                    `INSERT INTO products
                        (category_id, name, description, price, stock, image_url)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    values
                );
                productId = result.insertId;
            }

            const [existingVariants] = await connection.execute(
                `SELECT id, color, size, sku, stock
                 FROM product_variants
                 WHERE product_id = ?
                 FOR UPDATE`,
                [productId]
            );
            const normalize = value => value
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/gu, "")
                .replace(/[đĐ]/gu, "d")
                .toLocaleLowerCase("vi");
            const existingByKey = new Map(
                existingVariants.map(variant => [
                    `${normalize(variant.color)}\u0000${normalize(variant.size)}`,
                    variant
                ])
            );
            const existingById = new Map(
                existingVariants.map(variant => [String(variant.id), variant])
            );
            const retainedIds = new Set();
            const variantsToSave = [];

            for (const variant of data.variants) {
                const key = `${normalize(variant.color)}\u0000${normalize(variant.size)}`;
                let existing = null;

                if (variant.id) {
                    existing = existingById.get(String(variant.id));
                    if (!existing) {
                        const error = new Error(
                            "Biến thể không thuộc sản phẩm đang được chỉnh sửa."
                        );
                        error.code = "INVALID_VARIANT_REFERENCE";
                        throw error;
                    }
                    if (retainedIds.has(String(existing.id))) {
                        const error = new Error("Biến thể bị gửi trùng.");
                        error.code = "INVALID_VARIANT_REFERENCE";
                        throw error;
                    }
                } else {
                    existing = existingByKey.get(key);
                    if (existing && retainedIds.has(String(existing.id))) {
                        existing = null;
                    }
                }

                if (existing) {
                    retainedIds.add(String(existing.id));
                    variantsToSave.push({ ...variant, existingId: existing.id });
                } else {
                    variantsToSave.push({ ...variant, existingId: null });
                }
            }

            const removedIds = existingVariants
                .filter(variant => !retainedIds.has(String(variant.id)))
                .map(variant => variant.id);

            if (removedIds.length > 0) {
                const [cartReferences] = await connection.execute(
                    `SELECT variant_id
                     FROM cart_items
                     WHERE variant_id IN (${removedIds.map(() => "?").join(", ")})
                     LIMIT 1
                     FOR UPDATE`,
                    removedIds
                );

                if (cartReferences.length > 0) {
                    const error = new Error(
                        "Không thể xóa phân loại đang có trong giỏ hàng."
                    );
                    error.code = "VARIANT_IN_CART";
                    error.variantIds = [
                        ...new Set(cartReferences.map(row => String(row.variant_id)))
                    ];
                    throw error;
                }

                await connection.execute(
                    `DELETE FROM product_variants
                     WHERE product_id = ?
                       AND id IN (${removedIds.map(() => "?").join(", ")})`,
                    [productId, ...removedIds]
                );
            }

            const retainedExistingIds = variantsToSave
                .filter(variant => variant.existingId !== null)
                .map(variant => variant.existingId);

            if (retainedExistingIds.length > 0) {
                await connection.execute(
                    `UPDATE product_variants
                     SET color = CONCAT(CHAR(1), id), size = ''
                     WHERE product_id = ?
                       AND id IN (${retainedExistingIds.map(() => "?").join(", ")})`,
                    [productId, ...retainedExistingIds]
                );
            }

            for (const variant of variantsToSave) {
                if (variant.existingId !== null) {
                    await connection.execute(
                        `UPDATE product_variants
                         SET color = ?, size = ?, sku = ?, price = NULL, stock = ?
                         WHERE id = ? AND product_id = ?`,
                        [
                            variant.color,
                            variant.size,
                            variant.sku,
                            variant.stock,
                            variant.existingId,
                            productId
                        ]
                    );
                } else {
                    await connection.execute(
                        `INSERT INTO product_variants
                            (product_id, color, size, sku, price, stock)
                         VALUES (?, ?, ?, ?, NULL, ?)`,
                        [
                            productId,
                            variant.color,
                            variant.size,
                            variant.sku,
                            variant.stock
                        ]
                    );
                }
            }

            await connection.execute(
                "UPDATE product_variants SET price = NULL WHERE product_id = ?",
                [productId]
            );

            if (data.variants.length === 0) {
                await connection.execute(
                    "UPDATE products SET stock = ? WHERE id = ?",
                    [data.stock, productId]
                );
            } else {
                await connection.execute(
                    `UPDATE products
                     SET stock = (
                         SELECT COALESCE(SUM(stock), 0)
                         FROM product_variants
                         WHERE product_id = ?
                     )
                     WHERE id = ?`,
                    [productId, productId]
                );
            }

            await connection.commit();
            return productId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
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