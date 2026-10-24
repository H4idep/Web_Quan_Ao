const express = require("express");

const CustomerController = require("../controllers/CustomerController");
const { requireAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(requireAdmin);

router.param("id", (req, res, next, id) => {
    if (
        !/^[1-9]\d{0,9}$/.test(id) ||
        BigInt(id) > 4294967295n
    ) {
        return res.status(400).send("Mã khách hàng không hợp lệ.");
    }

    return next();
});

router.get("/", CustomerController.index);
router.get("/:id", CustomerController.detail);
router.post("/:id/update", CustomerController.update);
router.post("/:id/status", CustomerController.changeStatus);

module.exports = router;