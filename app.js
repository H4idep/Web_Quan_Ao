require("dotenv").config();

const express = require("express");
const session = require("express-session");
const crypto = require("node:crypto");
const path = require("node:path");
const adminRoutes = require("./routes/adminRoutes");
const productRoutes = require("./routes/productRoutes");
const loadMenuCategories = require("./middleware/menuMiddleware");

const MySQLStore = require("express-mysql-session")(session);

const pool = require("./config/database");
const authRoutes = require("./routes/authRoutes");
const { loadCurrentUser } = require("./middleware/authMiddleware");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";

if (
    !process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.length < 32
) {
    throw new Error("SESSION_SECRET phải dài ít nhất 32 ký tự.");
}

const sessionStore = new MySQLStore({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    createDatabaseTable: true,
    expiration: 24 * 60 * 60 * 1000,

    // Tên riêng để không xung đột bảng session cũ.
    schema: {
        tableName: "auth_sessions"
    }
});

app.disable("x-powered-by");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));

// Source có public/img và một số đường dẫn cũ dùng /images.
app.use(
    "/images",
    express.static(path.join(__dirname, "public", "img"))
);

// Dự phòng các ảnh vẫn còn ở thư mục images gốc.
app.use(
    "/images",
    express.static(path.join(__dirname, "images"))
);

app.use(express.urlencoded({
    extended: false,
    limit: "16kb",
    parameterLimit: 30
}));

app.use(session({
    name: "shop.sid",
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,

    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});

// Tạo token trước khi render form.
app.use((req, res, next) => {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    }

    res.locals.csrfToken = req.session.csrfToken;

    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
        const token = req.get("X-CSRF-Token") || req.body?._csrf;

        if (
            typeof token !== "string" ||
            token !== req.session.csrfToken
        ) {
            return res.status(403).send(
                "Biểu mẫu đã hết hạn hoặc không hợp lệ. Hãy tải lại trang."
            );
        }
    }

    return next();
});

app.use(loadMenuCategories);

app.use(loadCurrentUser);

app.use("/admin", adminRoutes);
app.use("/products", productRoutes);
app.use("/", authRoutes);

app.get("/about", (req, res) => {
    res.render("about");
});

app.use((req, res) => {
    res.status(404).send("Không tìm thấy trang.");
});

app.use((error, req, res, next) => {
    console.error("Mã lỗi:", error.code);
    console.error("Chi tiết:", error.sqlMessage || error.message);

    if (error.type === "entity.too.large") {
        return res.status(413).send("Dữ liệu gửi lên quá lớn.");
    }

    return res.status(500).send(
        "Hệ thống đang gặp lỗi. Vui lòng thử lại sau."
    );
});

async function startServer() {
    try {
        await pool.query(
            "SELECT id, role, status FROM users LIMIT 1"
        );

        await sessionStore.onReady();

        app.listen(PORT, () => {
            console.log(`Server đang chạy: http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error(
            "Không thể khởi động:",
            error.code || error.message
        );

        await Promise.allSettled([
            pool.end(),
            sessionStore.close()
        ]);

        process.exitCode = 1;
    }
}

startServer();