const ProductModel = require("../models/ProductModel");

function validId(value) {
    if (
        typeof value !== "string" ||
        !/^[1-9]\d{0,19}$/.test(value)
    ) {
        return false;
    }

    return BigInt(value) <= 18446744073709551615n;
}

function formatMoney(value) {
    return Number(value).toLocaleString("vi-VN", {
        maximumFractionDigits: 2
    }) + " đ";
}

const ProductController = {
    async index(req, res, next) {
        try {
            const products = await ProductModel.findAll();

            return res.render("products/index", {
                products,
                formatMoney
            });
        } catch (error) {
            return next(error);
        }
    },

    async detail(req, res, next) {
        try {
            const id = req.params.id;

            if (!validId(id)) {
                return res.status(400).send(
                    "Mã sản phẩm không hợp lệ."
                );
            }

            const product = await ProductModel.findById(id);

            if (!product) {
                return res.status(404).send(
                    "Sản phẩm không tồn tại hoặc đã bị xóa."
                );
            }

            return res.render("products/detail", {
                product,
                formatMoney
            });
        } catch (error) {
            return next(error);
        }
    }
};

module.exports = ProductController;