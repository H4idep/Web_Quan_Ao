const express = require("express");
const AdminOrderController = require("../controllers/AdminOrderController");
const { requireAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(requireAdmin);

router.param("id", (req, res, next, id) => {
    const valid = /^[1-9]\d{0,19}$/.test(id)
        && BigInt(id) <= 18446744073709551615n;

    if (!valid) {
        return res.status(400).send("Mã đơn hàng không hợp lệ.");
    }

    return next();
});

router.get("/", AdminOrderController.index);
router.get("/:id", AdminOrderController.detail);
router.post("/:id/status", AdminOrderController.changeStatus);

module.exports = router;