const express = require("express");

const OrderController = require("../controllers/OrderController");
const { requireLogin } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(requireLogin);

router.get("/", OrderController.index);
router.get("/:orderNumber", OrderController.show);
router.post("/:orderNumber/cancel", OrderController.cancel);

module.exports = router;
