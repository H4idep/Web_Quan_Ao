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
    // khóa dòng -> kiểm tra tồn kho -> tạo đơn -> trừ kho -> xóa các món đã đặt khỏi giỏ.
    // Các món không được chọn vẫn nằm lại trong giỏ.
    // productIds: mảng id (đã validate) các sản phẩm muốn đặt.
    // Trả về:
    //   { status: "empty" }          (không có món nào được chọn còn trong giỏ)
    //   { status: "stock", problems: [{ name, stock }] }
    //   { status: "ok", orderNumber }
    async createFromCart(user, info, productIds) {
        if (!Array.isArray(productIds) || productIds.length === 0) {
            return { status: "empty" };
        }

        const placeholders = productIds.map(() => "?").join(",");
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
                 WHERE ci.user_id = ?
                   AND ci.product_id IN (${placeholders})
                 ORDER BY p.id
                 FOR UPDATE`,
                [user.id, ...productIds]
            );

            // Có món được chọn nhưng không còn trong giỏ (vd: đã xóa ở tab khác)
            // thì không đặt một phần đơn âm thầm, bắt người dùng kiểm tra lại.
            if (items.length !== productIds.length) {
                await connection.rollback();

                return { status: "empty" };
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
                            status,
                            notes
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
                        [
                            user.id,
                            orderNumber,
                            info.customerName,
                            user.email,
                            info.phone,
                            info.shippingAddress,
                            fromCents(totalCents),
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

            // Chỉ xóa các món đã đặt, giữ nguyên các món không chọn.
            await connection.execute(
                `DELETE FROM cart_items
                 WHERE user_id = ? AND product_id IN (${placeholders})`,
                [user.id, ...productIds]
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

    // Chỉ trả về đơn nếu thuộc về user này. Đơn của người khác
    // giống như không tồn tại (không lộ việc mã đơn có thật).
    async findByNumberForUser(userId, orderNumber) {
        const [orders] = await pool.execute(
            `SELECT
                id, order_number, customer_name, customer_email,
                customer_phone, shipping_address, total_amount,
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
