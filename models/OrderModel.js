const crypto = require("node:crypto");
const pool = require("../config/database");

// Bỏ các ký tự dễ nhầm (0/O, 1/I).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateOrderNumber() {
    // Ngày theo giờ Việt Nam (UTC+7).
    const vietnamNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const date = vietnamNow.toISOString().slice(0, 10).replaceAll("-", "");

    let suffix = "";

    for (let i = 0; i < 6; i += 1) {
        suffix += ALPHABET[crypto.randomInt(ALPHABET.length)];
    }

    return `DH${date}${suffix}`;
}

// Tính bằng đơn vị "xu" (số nguyên) để tránh sai số số thực.
function toCents(value) {
    return Math.round(Number(value) * 100);
}

function fromCents(cents) {
    return (cents / 100).toFixed(2);
}

const OrderModel = {
    // Đặt hàng các sản phẩm ĐƯỢC CHỌN trong giỏ của user, trong MỘT transaction:
    // khóa dòng -> kiểm tra tồn kho -> tạo đơn -> trừ kho -> xóa các dòng đã đặt.
    // Sản phẩm không được chọn vẫn nằm lại trong giỏ.
    // Trả về:
    //   { status: "changed" }  (có sản phẩm đã chọn không còn trong giỏ của user)
    //   { status: "stock", problems: [{ name, stock }] }
    //   { status: "ok", orderNumber }
    async createFromCart(user, info, productIds) {
        const ids = [...new Set((productIds || []).map(String))];

        if (ids.length === 0) {
            return { status: "changed" };
        }

        const placeholders = ids.map(() => "?").join(", ");
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            // FOR UPDATE khóa các dòng sản phẩm trong giỏ. Sắp xếp theo
            // p.id để hai đơn cùng lúc khóa theo cùng thứ tự (tránh deadlock).
            // Từ lúc này, người khác phải chờ transaction này xong mới
            // mua được cùng sản phẩm.
            const [items] = await connection.execute(
                `SELECT
                    ci.product_id,
                    ci.quantity,
                    p.name,
                    p.price,
                    p.stock
                 FROM cart_items ci
                 JOIN products p ON p.id = ci.product_id
                 WHERE ci.user_id = ? AND ci.product_id IN (${placeholders})
                 ORDER BY p.id
                 FOR UPDATE`,
                [user.id, ...ids]
            );

            // Điều kiện user_id ở trên đảm bảo không bao giờ đặt hộ giỏ người khác.
            // Thiếu dòng nào nghĩa là sản phẩm đó không (còn) trong giỏ của user.
            if (items.length !== ids.length) {
                await connection.rollback();

                return { status: "changed" };
            }

            const problems = items
                .filter(item => Number(item.stock) < Number(item.quantity))
                .map(item => ({
                    name: item.name,
                    stock: Number(item.stock)
                }));

            if (problems.length > 0) {
                await connection.rollback();

                return { status: "stock", problems };
            }

            // Giá lấy từ database tại thời điểm này, không tin client.
            const lines = items.map(item => {
                const unitCents = toCents(item.price);
                const quantity = Number(item.quantity);

                return {
                    productId: item.product_id,
                    name: item.name,
                    quantity,
                    unitCents,
                    lineCents: unitCents * quantity
                };
            });

            const totalCents = lines.reduce(
                (sum, line) => sum + line.lineCents,
                0
            );

            // Tạo đơn; nếu trùng mã (rất hiếm) thì sinh mã khác.
            let orderId = null;
            let orderNumber = null;

            for (let attempt = 0; attempt < 5 && orderId === null; attempt += 1) {
                orderNumber = generateOrderNumber();

                try {
                    const [result] = await connection.execute(
                        `INSERT INTO orders (
                            user_id,
                            order_number,
                            customer_name,
                            customer_email,
                            customer_phone,
                            shipping_address,
                            total_amount,
                            payment_method,
                            status,
                            notes
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
                        [
                            user.id,
                            orderNumber,
                            info.customerName,
                            user.email,
                            info.phone,
                            info.shippingAddress,
                            fromCents(totalCents),
                            info.paymentMethod,
                            info.notes
                        ]
                    );

                    orderId = result.insertId;
                } catch (error) {
                    if (error.code !== "ER_DUP_ENTRY") {
                        throw error;
                    }
                }
            }

            if (orderId === null) {
                throw new Error("Không tạo được mã đơn hàng duy nhất.");
            }

            await connection.query(
                `INSERT INTO order_items
                    (order_id, product_id, product_name, unit_price, quantity, line_total)
                 VALUES ?`,
                [
                    lines.map(line => [
                        orderId,
                        line.productId,
                        line.name,
                        fromCents(line.unitCents),
                        line.quantity,
                        fromCents(line.lineCents)
                    ])
                ]
            );

            // Trừ kho. Điều kiện stock >= ? là lớp bảo vệ thứ hai:
            // nếu vì lý do nào đó không đủ hàng thì không trừ và hủy đơn.
            for (const line of lines) {
                const [update] = await connection.execute(
                    `UPDATE products
                     SET stock = stock - ?
                     WHERE id = ? AND stock >= ?`,
                    [line.quantity, line.productId, line.quantity]
                );

                if (update.affectedRows !== 1) {
                    await connection.rollback();

                    return {
                        status: "stock",
                        problems: [{ name: line.name, stock: 0 }]
                    };
                }
            }

            // Chỉ xóa những dòng đã đặt, giữ lại phần còn lại của giỏ.
            await connection.execute(
                `DELETE FROM cart_items
                 WHERE user_id = ? AND product_id IN (${placeholders})`,
                [user.id, ...ids]
            );

            await connection.commit();

            return { status: "ok", orderNumber };
        } catch (error) {
            try {
                await connection.rollback();
            } catch {
                // Kết nối có thể đã mất; lỗi gốc quan trọng hơn.
            }

            throw error;
        } finally {
            connection.release();
        }
    },

    // Ngân hàng báo đã nhận tiền cho một đơn chuyển khoản.
    // Trả về { result } với result là một trong:
    //   paid                   vừa xác nhận thanh toán
    //   already_paid           cùng mã giao dịch được gửi lại (idempotent)
    //   not_found              không có đơn này
    //   order_already_paid     đơn đã thanh toán bằng giao dịch khác
    //   duplicate_transaction  mã giao dịch đã dùng cho đơn khác
    //   not_bank_transfer      đơn không phải chuyển khoản
    //   order_cancelled        đơn đã hủy
    //   amount_mismatch        số tiền nhỏ hơn giá trị đơn
    async confirmBankPayment(orderNumber, transactionId, amountCents) {
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            // Khóa dòng đơn để hai thông báo đến cùng lúc xử lý lần lượt.
            const [rows] = await connection.execute(
                `SELECT id, total_amount, payment_method, payment_status,
                        payment_reference, status
                 FROM orders
                 WHERE order_number = ?
                 FOR UPDATE`,
                [orderNumber]
            );

            const order = rows[0];

            const finish = async result => {
                await connection.rollback();

                return { result };
            };

            if (!order) {
                return await finish("not_found");
            }

            if (order.payment_status === "paid") {
                return await finish(
                    order.payment_reference === transactionId
                        ? "already_paid"
                        : "order_already_paid"
                );
            }

            if (order.payment_method !== "bank_transfer") {
                return await finish("not_bank_transfer");
            }

            if (order.status === "cancelled") {
                return await finish("order_cancelled");
            }

            if (amountCents < toCents(order.total_amount)) {
                return await finish("amount_mismatch");
            }

            try {
                await connection.execute(
                    `UPDATE orders
                     SET payment_status = 'paid',
                         paid_at = NOW(),
                         payment_reference = ?
                     WHERE id = ?`,
                    [transactionId, order.id]
                );
            } catch (error) {
                if (error.code === "ER_DUP_ENTRY") {
                    return await finish("duplicate_transaction");
                }

                throw error;
            }

            await connection.commit();

            return { result: "paid" };
        } catch (error) {
            try {
                await connection.rollback();
            } catch {
                // Kết nối có thể đã mất; lỗi gốc quan trọng hơn.
            }

            throw error;
        } finally {
            connection.release();
        }
    },

    // Danh sách đơn của một user, mới nhất trước. status rỗng = tất cả.
    // Trả về { orders, total }.
    async listForUser(userId, { status = "", page = 1, pageSize = 10 } = {}) {
        const where = status
            ? "WHERE o.user_id = ? AND o.status = ?"
            : "WHERE o.user_id = ?";

        const params = status ? [userId, status] : [userId];

        const [[count]] = await pool.query(
            `SELECT COUNT(*) AS total FROM orders o ${where}`,
            params
        );

        // query (không phải execute) vì LIMIT/OFFSET với prepared statement
        // hay lỗi trên MySQL 8; giá trị ở đây đều là số nguyên do server tạo.
        const [orders] = await pool.query(
            `SELECT
                o.order_number,
                o.total_amount,
                o.status,
                o.payment_method,
                o.payment_status,
                o.created_at,
                (SELECT COALESCE(SUM(oi.quantity), 0)
                 FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
                (SELECT COUNT(*)
                 FROM order_items oi WHERE oi.order_id = o.id) AS line_count,
                (SELECT oi.product_name
                 FROM order_items oi WHERE oi.order_id = o.id
                 ORDER BY oi.id LIMIT 1) AS first_item
             FROM orders o
             ${where}
             ORDER BY o.created_at DESC, o.id DESC
             LIMIT ? OFFSET ?`,
            [...params, pageSize, (page - 1) * pageSize]
        );

        return { orders, total: Number(count.total) };
    },

    // Khách tự hủy đơn của mình, trong MỘT transaction: khóa đơn -> kiểm tra
    // -> hoàn lại kho -> đổi trạng thái. Chỉ hủy được khi đơn còn "pending" và
    // CHƯA thanh toán (đơn đã trả tiền cần hoàn tiền nên phải qua cửa hàng).
    // Trả về { result }: cancelled | not_found | already_cancelled |
    //                    not_pending | already_paid
    async cancelByUser(userId, orderNumber) {
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            // Khóa dòng đơn: hai lần hủy cùng lúc, hoặc hủy trùng với lúc ngân
            // hàng báo đã nhận tiền, sẽ được xử lý lần lượt (chỉ một bên thắng).
            const [rows] = await connection.execute(
                `SELECT id, status, payment_status
                 FROM orders
                 WHERE order_number = ? AND user_id = ?
                 FOR UPDATE`,
                [orderNumber, userId]
            );

            const order = rows[0];

            const finish = async result => {
                await connection.rollback();

                return { result };
            };

            if (!order) {
                return await finish("not_found");
            }

            if (order.status === "cancelled") {
                return await finish("already_cancelled");
            }

            if (order.status !== "pending") {
                return await finish("not_pending");
            }

            if (order.payment_status === "paid") {
                return await finish("already_paid");
            }

            // Sản phẩm đã bị xóa khỏi cửa hàng (product_id NULL) thì không còn kho để hoàn.
            // Sắp xếp theo product_id để thứ tự khóa luôn giống nhau (tránh deadlock).
            const [items] = await connection.execute(
                `SELECT product_id, quantity
                 FROM order_items
                 WHERE order_id = ? AND product_id IS NOT NULL
                 ORDER BY product_id`,
                [order.id]
            );

            for (const item of items) {
                await connection.execute(
                    "UPDATE products SET stock = stock + ? WHERE id = ?",
                    [item.quantity, item.product_id]
                );
            }

            await connection.execute(
                "UPDATE orders SET status = 'cancelled' WHERE id = ?",
                [order.id]
            );

            await connection.commit();

            return { result: "cancelled" };
        } catch (error) {
            try {
                await connection.rollback();
            } catch {
                // Kết nối có thể đã mất; lỗi gốc quan trọng hơn.
            }

            throw error;
        } finally {
            connection.release();
        }
    },

    // Chỉ trả về đơn nếu thuộc về user này. Đơn của người khác
    // giống như không tồn tại (không lộ việc mã đơn có thật).
    async findByNumberForUser(userId, orderNumber) {
        const [orders] = await pool.execute(
            `SELECT
                id, order_number, customer_name, customer_email,
                customer_phone, shipping_address, total_amount,
                payment_method, payment_status, paid_at,
                status, notes, created_at
             FROM orders
             WHERE order_number = ? AND user_id = ?
             LIMIT 1`,
            [orderNumber, userId]
        );

        if (orders.length === 0) {
            return null;
        }

        const [items] = await pool.execute(
            `SELECT product_id, product_name, unit_price, quantity, line_total
             FROM order_items
             WHERE order_id = ?
             ORDER BY id`,
            [orders[0].id]
        );

        return { ...orders[0], items };
    }
};

module.exports = OrderModel;
