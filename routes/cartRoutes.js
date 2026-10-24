const express = require("express");

const CartController = require("../controllers/CartController");
const { requireLogin } = require("../middleware/authMiddleware");

const router = express.Router();

// Mọi chức năng giỏ hàng đều cần đăng nhập.
// Giỏ gắn với res.locals.currentUser.id (lấy từ session),
// không bao giờ nhận user id từ client.
router.use(requireLogin);

router.get("/", CartController.show);
router.post("/add", CartController.add);
router.post("/update", CartController.update);
router.post("/remove", CartController.remove);

module.exports = router;
