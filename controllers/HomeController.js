const ProductModel = require("../models/ProductModel");

const HomeController = {
    async index(req, res, next) {
        try {
            const products = await ProductModel.findAll();

            return res.render("index", {
                products,
                formatMoney(value) {
                    return Number(value).toLocaleString("vi-VN", {
                        maximumFractionDigits: 2
                    }) + " đ";
                }
            });
        } catch (error) {
            return next(error);
        }
    }
};

module.exports = HomeController;