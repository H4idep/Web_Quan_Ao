const bcrypt = require("bcrypt");
const validator = require("validator");
const svgCaptcha = require("svg-captcha");

const UserModel = require("../models/UserModel");
const addressCatalog = require("../config/addressCatalog");

const {
    getText,
    validateRegister
} = require("../validators/authValidator");

const {
    getHomeUrl
} = require("../middleware/authMiddleware");

// Dùng hash giả để vẫn thực hiện bcrypt khi email không tồn tại.
const dummyHashPromise = bcrypt.hash(
    "Dummy-password-not-for-login!123",
    12
);

function renderRegister(req, res, data = {}, errors = {}, status = 200) {
    return res.status(status).render("auth/register", {
        form: data,
        errors,
        addressCatalog
    });
}

function renderLogin(res, email = "", error = "", status = 200) {
    return res.status(status).render("auth/login", {
        email,
        error,
        success: ""
    });
}

const AuthController = {
    showRegister(req, res) {
        return renderRegister(req, res);
    },

    captcha(req, res, next) {
        const captcha = svgCaptcha.create({
            size: 5,
            noise: 3,
            color: true,
            background: "#f5f5f5",
            ignoreChars: "0oO1iIlL"
        });

        req.session.captcha = {
            answer: captcha.text.toLowerCase(),
            expiresAt: Date.now() + 5 * 60 * 1000
        };

        // Lưu đáp án trước khi gửi ảnh về trình duyệt.
        req.session.save(error => {
            if (error) {
                return next(error);
            }

            res.set("Cache-Control", "no-store");
            res.type("svg");

            return res.send(captcha.data);
        });
    },

    async register(req, res, next) {
        const { data, errors, password } = validateRegister(req.body);

        const captcha = req.session.captcha;

        // Mỗi lần gửi form chỉ được sử dụng CAPTCHA một lần.
        delete req.session.captcha;

        const answer = getText(req.body.captchaInput).toLowerCase();

        if (
            !captcha ||
            captcha.expiresAt < Date.now() ||
            answer !== captcha.answer
        ) {
            errors.captchaInput =
                "Mã xác nhận sai hoặc hết hạn. Nhập mã mới đang hiển thị.";
        }

        if (Object.keys(errors).length > 0) {
            return renderRegister(req, res, data, errors, 400);
        }

        try {
            const existingUser = await UserModel.findByEmail(data.email);

            if (existingUser) {
                return renderRegister(req, res, data, {
                    email: "Email này đã được đăng ký."
                }, 409);
            }

            const passwordHash = await bcrypt.hash(password, 12);

            await UserModel.create(data, passwordHash);

            return res.redirect("/login?registered=1");
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                return renderRegister(req, res, data, {
                    email: "Email này đã được đăng ký."
                }, 409);
            }

            return next(error);
        }
    },

    showLogin(req, res) {
        return res.render("auth/login", {
            error: "",
            email: "",
            success: req.query.registered === "1"
                ? "Đăng ký thành công. Bạn hãy đăng nhập."
                : ""
        });
    },

    async login(req, res, next) {
        const email = getText(req.body.email).toLowerCase();

        const password = typeof req.body.password === "string"
            ? req.body.password
            : "";

        if (
            !email ||
            email.length > 254 ||
            !validator.isEmail(email, {
                allow_utf8_local_part: false,
                require_tld: true
            }) ||
            !password ||
            Buffer.byteLength(password, "utf8") > 72
        ) {
            return renderLogin(
                res,
                email,
                "Vui lòng nhập email hợp lệ và mật khẩu.",
                400
            );
        }

        try {
            const user = await UserModel.findByEmail(email);

            const hash = user
                ? user.password_hash
                : await dummyHashPromise;

            const passwordCorrect = await bcrypt.compare(password, hash);

            if (
                !user ||
                !passwordCorrect ||
                user.status !== "active"
            ) {
                return renderLogin(
                    res,
                    email,
                    "Thông tin đăng nhập không đúng hoặc tài khoản không khả dụng.",
                    401
                );
            }

            req.session.regenerate(error => {
                if (error) {
                    return next(error);
                }

                req.session.userId = user.id;

                req.session.save(error => {
                    if (error) {
                        return next(error);
                    }

                    return res.redirect(getHomeUrl(user));
                });
            });
        } catch (error) {
            return next(error);
        }
    },

    logout(req, res, next) {
        req.session.destroy(error => {
            if (error) {
                return next(error);
            }

            res.clearCookie("shop.sid", { path: "/" });

            return res.redirect("/login");
        });
    }
};

module.exports = AuthController;