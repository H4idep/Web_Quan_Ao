// Cấu hình thanh toán, đọc từ biến môi trường (.env) ở thời điểm dùng.
//
//   BANK_NAME            Tên ngân hàng hiển thị, ví dụ: Vietcombank
//   BANK_CODE            (tùy chọn) mã ngân hàng của VietQR để hiện mã QR, ví dụ: VCB
//   BANK_ACCOUNT_NUMBER  Số tài khoản nhận tiền
//   BANK_ACCOUNT_NAME    Tên chủ tài khoản (viết hoa, không dấu)
//   PAYMENT_WEBHOOK_SECRET  Khóa bí mật (>= 32 ký tự) để ngân hàng/cổng thanh toán
//                           báo "đã nhận tiền". Không đặt thì webhook bị tắt.
//
// Thiếu BANK_NAME / BANK_ACCOUNT_NUMBER / BANK_ACCOUNT_NAME thì không cho chọn
// "Chuyển khoản" (tránh khách chọn mà không biết chuyển đi đâu).

function getPaymentConfig() {
    const env = process.env;

    const bank = {
        name: (env.BANK_NAME || "").trim(),
        code: (env.BANK_CODE || "").trim(),
        accountNumber: (env.BANK_ACCOUNT_NUMBER || "").trim(),
        accountName: (env.BANK_ACCOUNT_NAME || "").trim()
    };

    const secret = env.PAYMENT_WEBHOOK_SECRET || "";

    return {
        bank,
        bankTransferEnabled: Boolean(
            bank.name && bank.accountNumber && bank.accountName
        ),
        // Khóa quá ngắn coi như chưa cấu hình.
        webhookSecret: secret.length >= 32 ? secret : ""
    };
}

// Ảnh mã QR theo chuẩn VietQR (dịch vụ img.vietqr.io). Chỉ tạo khi có BANK_CODE.
// Nội dung chuyển khoản = mã đơn hàng để đối soát.
function buildQrUrl(bank, amount, orderNumber) {
    if (!bank.code) {
        return "";
    }

    const query = new URLSearchParams({
        amount: String(Math.round(Number(amount))),
        addInfo: orderNumber,
        accountName: bank.accountName
    });

    return (
        "https://img.vietqr.io/image/" +
        `${encodeURIComponent(bank.code)}-${encodeURIComponent(bank.accountNumber)}-compact2.png` +
        `?${query.toString()}`
    );
}

module.exports = { getPaymentConfig, buildQrUrl };
