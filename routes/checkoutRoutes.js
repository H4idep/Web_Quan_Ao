const express = require("express");
const { rateLimit } = require("express-rate-limit");

const CheckoutController = require("../controllers/CheckoutController");
const { requireLogin } = require("../middleware/authMiddleware");

const router = express.Router();

// Chống gửi đơn liên tục. Request lỗi (400) không bị tính vào hạn mức.
const placeOrderLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    skipFailedRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: "Bạn đặt hàng quá nhiều lần. Hãy thử lại sau."
});

router.use(requireLogin);

router.get("/", CheckoutController.show);
router.post("/", placeOrderLimiter, CheckoutController.place);

module.exports = router;
