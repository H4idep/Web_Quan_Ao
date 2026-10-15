const express = require("express");
const { rateLimit } = require("express-rate-limit");

const AuthController = require("../controllers/AuthController");
const addressCatalog = require("../config/addressCatalog");
const HomeController = require("../controllers/HomeController");

const {
    requireLogin,
    requireAdmin,
    guestOnly
} = require("../middleware/authMiddleware");

const router = express.Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: "Bạn đăng nhập sai quá nhiều lần. Hãy thử lại sau 15 phút."
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: "Bạn gửi đăng ký quá nhiều lần. Hãy thử lại sau."
});

const captchaLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: "Bạn đổi mã quá nhanh. Hãy thử lại sau."
});

router.get("/", HomeController.index);

router.get("/register", guestOnly, AuthController.showRegister);

router.post(
    "/register",
    guestOnly,
    registerLimiter,
    AuthController.register
);

router.get("/login", guestOnly, AuthController.showLogin);

router.post(
    "/login",
    guestOnly,
    loginLimiter,
    AuthController.login
);

router.get(
    "/captcha",
    guestOnly,
    captchaLimiter,
    AuthController.captcha
);

router.get("/address-options", (req, res) => {
    res.json(addressCatalog);
});

router.get("/account", requireLogin, (req, res) => {
    res.render("account");
});

// Tất cả route quản trị đặt sau middleware này trong router.
router.use("/admin", requireAdmin);

router.get("/admin", (req, res) => {
    res.render("admin/index");
});

router.post("/logout", requireLogin, AuthController.logout);

// Các đường dẫn cũ được chuyển về URL mới.
router.get("/singin.html", (req, res) => {
    res.redirect("/login");
});

router.get("/register.html", (req, res) => {
    res.redirect("/register");
});

router.get("/index.html", (req, res) => {
    res.redirect("/");
});

module.exports = router;