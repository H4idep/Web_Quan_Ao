const crypto = require("node:crypto");
const express = require("express");
const { rateLimit } = require("express-rate-limit");

const PaymentController = require("../controllers/PaymentController");
const { getPaymentConfig } = require("../config/payment");

const router = express.Router();

// Route này được gắn TRƯỚC session và CSRF trong app.js, vì ngân hàng không có
// cookie hay CSRF token. Thay vào đó nó tự xác thực bằng khóa bí mật.
// Các route khác vẫn được CSRF bảo vệ như cũ.

const webhookLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { result: "rate_limited" }
});

// So sánh băm SHA-256 của hai chuỗi bằng timingSafeEqual để không lộ khóa
// qua thời gian phản hồi.
function secretMatches(provided, expected) {
    const a = crypto.createHash("sha256").update(provided).digest();
    const b = crypto.createHash("sha256").update(expected).digest();

    return crypto.timingSafeEqual(a, b);
}

function requireWebhookSecret(req, res, next) {
    const { webhookSecret } = getPaymentConfig();

    // Chưa cấu hình khóa: tắt hẳn, không bao giờ chấp nhận request.
    if (!webhookSecret) {
        return res.status(503).json({ result: "webhook_disabled" });
    }

    const match = /^Bearer (.+)$/i.exec(req.get("authorization") || "");

    if (!match || !secretMatches(match[1].trim(), webhookSecret)) {
        return res.status(401).json({ result: "unauthorized" });
    }

    return next();
}

// Xác thực xong mới đọc body, để request lạ không làm tốn tài nguyên.
router.post(
    "/webhook",
    webhookLimiter,
    requireWebhookSecret,
    express.json({ limit: "10kb", strict: true }),
    PaymentController.webhook
);

// JSON hỏng hoặc quá lớn: trả JSON thay vì trang lỗi HTML.
router.use((error, req, res, next) => {
    if (error.type === "entity.too.large") {
        return res.status(413).json({ result: "too_large" });
    }

    if (error.type === "entity.parse.failed" || error.status === 400) {
        return res.status(400).json({ result: "invalid_body" });
    }

    return next(error);
});

module.exports = router;
