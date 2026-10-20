const express = require("express");
const ProductController = require("../controllers/ProductController");

const router = express.Router();

router.get("/", ProductController.index);
router.get("/:id", ProductController.detail);

module.exports = router;