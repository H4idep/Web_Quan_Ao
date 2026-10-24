#!/usr/bin/env node
// Giả lập "Ngân hàng" báo đã nhận tiền, để demo/kiểm thử khi chưa có cổng thanh toán thật.
//
//   node scripts/simulate-bank-webhook.js <mã đơn> [số tiền] [url]
//
// - Số tiền bỏ trống: lấy đúng giá trị đơn từ database.
// - Dùng PAYMENT_WEBHOOK_SECRET trong .env (server phải bật khóa này).
// - Mỗi lần chạy tạo một mã giao dịch mới; chạy lại cùng đơn sẽ báo đã thanh toán.

require("dotenv").config();

const pool = require("../config/database");

async function main() {
    const [orderNumber, amountArg, urlArg] = process.argv.slice(2);

    if (!orderNumber) {
        console.error("Cách dùng: node scripts/simulate-bank-webhook.js <mã đơn> [số tiền] [url]");
        process.exitCode = 1;

        return;
    }

    const secret = process.env.PAYMENT_WEBHOOK_SECRET;

    if (!secret) {
        console.error("Thiếu PAYMENT_WEBHOOK_SECRET trong .env.");
        process.exitCode = 1;

        return;
    }

    let amount = amountArg;

    if (amount === undefined) {
        const [rows] = await pool.execute(
            "SELECT total_amount FROM orders WHERE order_number = ? LIMIT 1",
            [orderNumber]
        );

        if (rows.length === 0) {
            console.error("Không tìm thấy đơn trong database.");
            process.exitCode = 1;

            return;
        }

        amount = rows[0].total_amount;
    }

    const url = urlArg || `http://localhost:${process.env.PORT || 3000}/payments/webhook`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secret}`
        },
        body: JSON.stringify({
            transactionId: `SIM${Date.now()}`,
            orderNumber,
            amount: Number(amount)
        })
    });

    console.log(`HTTP ${response.status}`, await response.text());
}

main()
    .catch(error => {
        console.error("Lỗi:", error.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
