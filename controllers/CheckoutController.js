const CartModel = require("../models/CartModel");
const OrderModel = require("../models/OrderModel");
const UserModel = require("../models/UserModel");
const { validateCheckout } = require("../validators/orderValidator");
const { formatMoney, imagePath } = require("../utils/format");

function setCartFlash(req, type, message) {
    req.session.cartFlash = { type, message };
}

// Trả về lý do không cho đặt hàng, hoặc null nếu giỏ hợp lệ.
function cartProblem(items) {
    if (items.length === 0) {
        return "Giỏ hàng đang trống.";
    }

    if (items.some(item => Number(item.stock) < Number(item.quantity))) {
        return "Có sản phẩm đã hết hàng hoặc vượt tồn kho. Hãy điều chỉnh giỏ hàng trước khi đặt.";
    }

    return null;
}

function renderCheckout(res, items, form, errors = {}, status = 200) {
    const subtotal = items.reduce(
        (sum, item) => sum + Number(item.line_total),
        0
    );

    return res.status(status).render("checkout/index", {
        items,
        subtotal,
        form,
        errors,
        formatMoney,
        imagePath
    });
}

const CheckoutController = {
    async show(req, res, next) {
        try {
            const user = res.locals.currentUser;
            const items = await CartModel.getItems(user.id);
            const problem = cartProblem(items);

            if (problem) {
                setCartFlash(req, "error", problem);

                return res.redirect("/cart");
            }

            // Điền sẵn từ hồ sơ để khách đỡ phải gõ lại.
            const profile = await UserModel.findCheckoutProfile(user.id);

            const form = {
                customerName: profile.full_name,
                phone: profile.phone,
                shippingAddress: [
                    profile.address,
                    profile.ward,
                    profile.district,
                    profile.province
                ]
                    .filter(Boolean)
                    .join(", "),
                notes: ""
            };

            return renderCheckout(res, items, form);
        } catch (error) {
            return next(error);
        }
    },

    async place(req, res, next) {
        try {
            const user = res.locals.currentUser;
            const items = await CartModel.getItems(user.id);
            const problem = cartProblem(items);

            if (problem) {
                setCartFlash(req, "error", problem);

                return res.redirect("/cart");
            }

            const { data, errors } = validateCheckout(req.body);

            if (Object.keys(errors).length > 0) {
                return renderCheckout(res, items, data, errors, 400);
            }

            // Kiểm tra tồn kho thật sự nằm trong transaction của OrderModel.
            const result = await OrderModel.createFromCart(user, data);

            if (result.status === "empty") {
                setCartFlash(req, "error", "Giỏ hàng đang trống.");

                return res.redirect("/cart");
            }

            if (result.status === "stock") {
                const names = result.problems
                    .map(item =>
                        item.stock > 0
                            ? `${item.name} (còn ${item.stock})`
                            : `${item.name} (hết hàng)`
                    )
                    .join(", ");

                setCartFlash(
                    req,
                    "error",
                    `Không đủ hàng cho: ${names}. Hãy điều chỉnh số lượng rồi đặt lại.`
                );

                return res.redirect("/cart");
            }

            req.session.orderFlash = "placed";

            return res.redirect(`/orders/${result.orderNumber}`);
        } catch (error) {
            return next(error);
        }
    }
};

module.exports = CheckoutController;
