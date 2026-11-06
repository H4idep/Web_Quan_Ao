const pool = require("../config/database");

const CouponModel = {
    // Tìm mã theo code
    async findByCode(code, connection = pool) {
        if (!code || typeof code !== "string") return null;

        const [rows] = await connection.execute(
            `SELECT * FROM coupons WHERE UPPER(code) = UPPER(?) LIMIT 1`,
            [code.trim()]
        );
        return rows[0] || null;
    },

    // Kiểm tra toàn diện tính hợp lệ của mã đối với số tiền đơn hàng
    async validate(code, subtotal, connection = pool) {
        if (!code) {
            return { valid: false, message: "Vui lòng nhập mã giảm giá." };
        }

        const coupon = await this.findByCode(code, connection);

        if (!coupon) {
            return { valid: false, message: "Mã giảm giá không tồn tại." };
        }

        if (!coupon.is_active) {
            return { valid: false, message: "Mã giảm giá hiện đang bị tạm khóa." };
        }

        const now = new Date();
        if (coupon.start_date && new Date(coupon.start_date) > now) {
            return { valid: false, message: "Mã giảm giá chưa đến ngày áp dụng." };
        }

        if (coupon.end_date && new Date(coupon.end_date) < now) {
            return { valid: false, message: "Mã giảm giá đã hết hạn sử dụng." };
        }

        if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
            return { valid: false, message: "Mã giảm giá đã hết lượt sử dụng." };
        }

        const minOrder = Number(coupon.min_order_value);
        if (subtotal < minOrder) {
            return {
                valid: false,
                message: `Đơn hàng tối thiểu phải từ ${minOrder.toLocaleString("vi-VN")} đ để dùng mã này.`
            };
        }

        // Tính số tiền giảm giá
        let discount = 0;
        if (coupon.discount_type === "percentage") {
            const rawDiscount = (subtotal * Number(coupon.discount_value)) / 100;
            if (coupon.max_discount_amount !== null) {
                discount = Math.min(rawDiscount, Number(coupon.max_discount_amount));
            } else {
                discount = rawDiscount;
            }
        } else if (coupon.discount_type === "fixed") {
            discount = Math.min(Number(coupon.discount_value), subtotal);
        }

        // Làm tròn đến hàng đơn vị
        discount = Math.round(discount);
        const finalTotal = Math.max(0, subtotal - discount);

        return {
            valid: true,
            coupon,
            discount,
            finalTotal,
            message: "Áp dụng mã giảm giá thành công!"
        };
    }
};

module.exports = CouponModel;