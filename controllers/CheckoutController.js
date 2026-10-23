const CartModel = require("../models/CartModel");
const OrderModel = require("../models/OrderModel");
const UserModel = require("../models/UserModel");
const {
    validateCheckout,
    parseSelectedIds
} = require("../validators/orderValidator");
const { formatMoney, imagePath } = require("../utils/format");
const { getPaymentConfig } = require("../config/payment");

// Các phương thức thanh toán đang bật (chuyển khoản chỉ bật khi đã cấu hình).
function getPaymentOptions() {
    const options = [
        {
            value: "cod",
            label: "Thanh toán khi nhận hàng (COD)",
            hint: "Trả tiền mặt cho người giao hàng."
        }
    ];

    if (getPaymentConfig().bankTransferEnabled) {
        options.push({
            value: "bank_transfer",
            label: "Chuyển khoản ngân hàng",
            hint: "Thông tin chuyển khoản và mã QR hiện ở trang đơn hàng sau khi đặt."
        });
    }

    return options;
}

function setCartFlash(req, type, message) {
    req.session.cartFlash = { type, message };
}

// Xác định các sản phẩm khách đã chọn và kiểm tra chúng.
// Danh sách chọn đến từ client nên được đối chiếu lại với giỏ THẬT
// của chính người dùng này trong database.
// Trả về { items } nếu hợp lệ, hoặc { error } nếu không.
async function resolveSelection(userId, rawSelected) {
    const ids = parseSelectedIds(rawSelected);

    if (!ids) {
        return { error: "Vui lòng chọn ít nhất một sản phẩm để đặt hàng." };
    }

    const cart = await CartModel.getItems(userId);
    const byId = new Map(cart.map(item => [String(item.product_id), item]));
    const items = [];

    for (const id of ids) {
        const item = byId.get(id);

        if (!item) {
            return {
                error: "Có sản phẩm đã chọn không còn trong giỏ hàng. Hãy chọn lại."
            };
        }

        items.push(item);
    }

    const lacking = items.filter(
        item => Number(item.stock) < Number(item.quantity)
    );

    if (lacking.length > 0) {
        return {
            error: `Không đủ hàng cho: ${lacking
                .map(item => item.name)
                .join(", ")}. Hãy giảm số lượng hoặc bỏ chọn sản phẩm này.`
        };
    }

    return { items };
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
        paymentOptions: getPaymentOptions(),
        formatMoney,
        imagePath
    });
}

const CheckoutController = {
    async show(req, res, next) {
        try {
            const user = res.locals.currentUser;
            const selection = await resolveSelection(
                user.id,
                req.query.selected
            );

            if (selection.error) {
                setCartFlash(req, "error", selection.error);

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
                notes: "",
                paymentMethod: "cod"
            };

            return renderCheckout(res, selection.items, form);
        } catch (error) {
            return next(error);
        }
    },

    async place(req, res, next) {
        try {
            const user = res.locals.currentUser;
            const selection = await resolveSelection(
                user.id,
                req.body.selected
            );

            if (selection.error) {
                setCartFlash(req, "error", selection.error);

                return res.redirect("/cart");
            }

            const { data, errors } = validateCheckout(
                req.body,
                getPaymentOptions().map(option => option.value)
            );

            if (Object.keys(errors).length > 0) {
                return renderCheckout(res, selection.items, data, errors, 400);
            }

            // Kiểm tra tồn kho thật sự nằm trong transaction của OrderModel.
            const result = await OrderModel.createFromCart(
                user,
                data,
                selection.items.map(item => String(item.product_id))
            );

            if (result.status === "changed") {
                setCartFlash(
                    req,
                    "error",
                    "Giỏ hàng đã thay đổi. Hãy chọn lại sản phẩm muốn đặt."
                );

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
