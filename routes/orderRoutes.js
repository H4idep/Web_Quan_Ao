const express = require("express");

const OrderController = require("../controllers/OrderController");
const { requireLogin } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(requireLogin);

router.get("/:orderNumber", OrderController.show);

module.exports = router;
