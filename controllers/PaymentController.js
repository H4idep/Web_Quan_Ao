const OrderModel = require("../models/OrderModel");

// Mã giao dịch của ngân hàng: chỉ chữ, số và vài ký tự an toàn.
const TRANSACTION_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,100}$/;
const ORDER_NUMBER_PATTERN = /^DH\d{8}[A-Z2-9]{6}$/;

// Số tiền (VND) -> "xu" nguyên. Chỉ nhận số dương, tối đa 2 số lẻ.
function parseAmountToCents(value) {
    let number;

    if (typeof value === "number") {
        number = value;
    } else if (
        typeof value === "string" &&
        /^\d{1,12}(\.\d{1,2})?$/.test(value.trim())
    ) {
        number = Number(value);
    } else {
        return null;
    }

    if (!Number.isFinite(number) || number <= 0 || number > 9999999999) {
        return null;
    }

    return Math.round(number * 100);
}

// Kết quả xử lý -> mã HTTP. 200 cho phép bên gửi ngừng gửi lại thông báo.
const RESULT_STATUS = {
    paid: 200,
    already_paid: 200,
    not_found: 404,
    order_already_paid: 409,
    duplicate_transaction: 409,
    not_bank_transfer: 422,
    order_cancelled: 422,
    amount_mismatch: 422
};

const PaymentController = {
    // Hợp đồng (độc lập nhà cung cấp):
    //   POST /payments/webhook
    //   Authorization: Bearer <PAYMENT_WEBHOOK_SECRET>
    //   { "transactionId": "...", "orderNumber": "DH...", "amount": 1200000 }
    async webhook(req, res) {
        try {
            const body = req.body && typeof req.body === "object" ? req.body : {};

            const transactionId =
                typeof body.transactionId === "string"
                    ? body.transactionId.trim()
                    : "";

            // Nội dung chuyển khoản có thể bị ngân hàng đổi hoa/thường hoặc chèn khoảng trắng.
            const orderNumber =
                typeof body.orderNumber === "string"
                    ? body.orderNumber.replace(/\s+/g, "").toUpperCase()
                    : "";

            const amountCents = parseAmountToCents(body.amount);

            if (
                !TRANSACTION_ID_PATTERN.test(transactionId) ||
                !ORDER_NUMBER_PATTERN.test(orderNumber) ||
                amountCents === null
            ) {
                return res.status(400).json({ result: "invalid_body" });
            }

            const { result } = await OrderModel.confirmBankPayment(
                orderNumber,
                transactionId,
                amountCents
            );

            if (!["paid", "already_paid"].includes(result)) {
                // Không ghi khóa bí mật; chỉ ghi lý do để quản trị viên đối soát.
                console.warn(
                    `[payment] ${result}: order=${orderNumber} txn=${transactionId}`
                );
            }

            return res.status(RESULT_STATUS[result] || 500).json({ result });
        } catch (error) {
            console.error("[payment] lỗi xử lý webhook:", error.code || error.message);

            return res.status(500).json({ result: "error" });
        }
    }
};

module.exports = PaymentController;
