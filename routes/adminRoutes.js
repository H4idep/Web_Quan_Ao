const express = require("express");
const { rateLimit } = require("express-rate-limit");

const adminCustomerRoutes = require("./adminCustomerRoutes");
const adminOrderRoutes = require("./adminOrderRoutes");
const AdminController = require("../controllers/AdminController");
const { requireAdmin } = require("../middleware/authMiddleware");
const { parseImage, saveImage } = require("../middleware/adminUpload");


const router = express.Router();

router.use(requireAdmin);

// Flash chỉ đọc trên các trang GET, không tiêu thụ bởi upload.
router.use((req, res, next) => {
    res.locals.flash = null;

    if (req.method === "GET") {
        res.locals.flash = req.session.adminFlash || null;
        delete req.session.adminFlash;
    }

    res.locals.money = value => {
        const number = Number(value);

        return Number.isFinite(number)
            ? number.toLocaleString("vi-VN", {
                maximumFractionDigits: 2
            }) + " đ"
            : "—";
    };

    res.locals.orderStatuses = {
        pending: "Chờ xử lý",
        processing: "Đang xử lý",
        shipped: "Đang giao",
        completed: "Hoàn thành",
        cancelled: "Đã hủy"
    };

    return next();
});

const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        error: "Bạn tải ảnh quá nhanh. Vui lòng thử lại sau."
    }
});

router.post(
    "/upload-image",
    uploadLimiter,
    parseImage,
    saveImage
);

router.get("/", AdminController.dashboard);

// kind do lập trình viên chỉ định, không lấy tên bảng từ người dùng.
for (const kind of ["categories", "products"]) {
    router.get(`/${kind}`, AdminController.list(kind));

    router.get(`/${kind}/create`, AdminController.createForm(kind));

    router.post(`/${kind}`, AdminController.save(kind));

    router.get(`/${kind}/:id/edit`, AdminController.editForm(kind));

    router.post(`/${kind}/:id/update`, AdminController.save(kind));

    router.post(`/${kind}/:id/delete`, AdminController.remove(kind));
}

router.use("/customers", adminCustomerRoutes);
router.use("/orders", adminOrderRoutes);

module.exports = router;