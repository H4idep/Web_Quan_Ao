const CartModel = require("../models/CartModel");
const { formatMoney, imagePath } = require("../utils/format");

function validId(value) {
    if (typeof value !== "string" || !/^[1-9]\d{0,19}$/.test(value)) {
        return false;
    }

    return BigInt(value) <= 18446744073709551615n;
}

// Số lượng: chuỗi 1-3 chữ số, trả về số nguyên hoặc null.
function parseQuantity(value, { allowZero = false } = {}) {
    if (typeof value !== "string" || !/^\d{1,3}$/.test(value.trim())) {
        return null;
    }

    const number = Number(value);

    if (number === 0 && !allowZero) {
        return null;
    }

    return number > CartModel.MAX_PER_ITEM ? null : number;
}

function setFlash(req, type, message) {
    req.session.cartFlash = { type, message };
}

const CartController = {
    async show(req, res, next) {
        try {
            const items = await CartModel.getItems(res.locals.currentUser.id);

            const subtotal = items.reduce(
                (sum, item) => sum + Number(item.line_total),
                0
            );

            const flash = req.session.cartFlash || null;
            delete req.session.cartFlash;

            return res.render("cart/index", {
                items,
                subtotal,
                flash,
                formatMoney,
                imagePath,
                maxPerItem: CartModel.MAX_PER_ITEM,
                // Có sản phẩm hết hàng hoặc vượt tồn kho thì Bước 2 sẽ chặn đặt hàng.
                hasProblem: items.some(
                    item => Number(item.stock) < Number(item.quantity)
                )
            });
        } catch (error) {
            return next(error);
        }
    },

    async add(req, res, next) {
        try {
            const { productId } = req.body;
            const quantity = parseQuantity(req.body.quantity ?? "1");

            if (!validId(productId) || quantity === null) {
                setFlash(
                    req,
                    "error",
                    `Dữ liệu không hợp lệ. Số lượng phải từ 1 đến ${CartModel.MAX_PER_ITEM}.`
                );

                return res.redirect("/cart");
            }

            const result = await CartModel.addItem(
                res.locals.currentUser.id,
                productId,
                quantity
            );

            if (result.status === "not_found") {
                setFlash(req, "error", "Sản phẩm không tồn tại hoặc đã bị xóa.");
            } else if (result.status === "out_of_stock") {
                setFlash(req, "error", "Sản phẩm này đã hết hàng.");
            } else if (result.capped) {
                setFlash(
                    req,
                    "warning",
                    `Đã thêm vào giỏ. Số lượng được giới hạn ở ${result.quantity} theo tồn kho.`
                );
            } else {
                setFlash(req, "success", "Đã thêm sản phẩm vào giỏ hàng.");
            }

            return res.redirect("/cart");
        } catch (error) {
            return next(error);
        }
    },

    async update(req, res, next) {
        try {
            const { productId } = req.body;
            const quantity = parseQuantity(req.body.quantity, {
                allowZero: true
            });

            if (!validId(productId) || quantity === null) {
                setFlash(
                    req,
                    "error",
                    `Số lượng phải từ 0 đến ${CartModel.MAX_PER_ITEM}.`
                );

                return res.redirect("/cart");
            }

            const userId = res.locals.currentUser.id;

            // Nhập 0 nghĩa là xóa khỏi giỏ.
            if (quantity === 0) {
                await CartModel.removeItem(userId, productId);
                setFlash(req, "success", "Đã xóa sản phẩm khỏi giỏ hàng.");

                return res.redirect("/cart");
            }

            const result = await CartModel.setQuantity(
                userId,
                productId,
                quantity
            );

            if (!result.found) {
                setFlash(req, "error", "Sản phẩm không có trong giỏ hàng.");
            } else if (result.capped) {
                setFlash(
                    req,
                    "warning",
                    `Số lượng được giới hạn ở ${result.quantity} theo tồn kho.`
                );
            } else {
                setFlash(req, "success", "Đã cập nhật giỏ hàng.");
            }

            return res.redirect("/cart");
        } catch (error) {
            return next(error);
        }
    },

    async remove(req, res, next) {
        try {
            const { productId } = req.body;

            if (!validId(productId)) {
                setFlash(req, "error", "Mã sản phẩm không hợp lệ.");

                return res.redirect("/cart");
            }

            const removed = await CartModel.removeItem(
                res.locals.currentUser.id,
                productId
            );

            setFlash(
                req,
                removed ? "success" : "error",
                removed
                    ? "Đã xóa sản phẩm khỏi giỏ hàng."
                    : "Sản phẩm không có trong giỏ hàng."
            );

            return res.redirect("/cart");
        } catch (error) {
            return next(error);
        }
    }
};

module.exports = CartController;
