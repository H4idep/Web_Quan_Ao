const OrderModel = require("../models/OrderModel");
const {
    formatMoney,
    ORDER_STATUS_LABELS,
    PAYMENT_METHOD_LABELS,
    PAYMENT_STATUS_LABELS
} = require("../utils/format");
const { getPaymentConfig, buildQrUrl } = require("../config/payment");

// Khớp định dạng của OrderModel.generateOrderNumber.
const ORDER_NUMBER_PATTERN = /^DH\d{8}[A-Z2-9]{6}$/;

const PAGE_SIZE = 10;

// Trạng thái hợp lệ để lọc danh sách (khớp enum trong bảng orders).
const STATUS_FILTERS = [
    "pending",
    "processing",
    "shipped",
    "completed",
    "cancelled"
];

// Các bước của một đơn bình thường (đơn bị hủy không đi theo các bước này).
const ORDER_STEPS = ["pending", "processing", "shipped", "completed"];

const CANCEL_MESSAGES = {
    cancelled: { type: "success", message: "Đã hủy đơn hàng." },
    already_cancelled: {
        type: "warning",
        message: "Đơn hàng này đã được hủy trước đó."
    },
    not_pending: {
        type: "error",
        message:
            "Đơn hàng đã được cửa hàng tiếp nhận xử lý nên không thể tự hủy. Vui lòng liên hệ cửa hàng."
    },
    already_paid: {
        type: "error",
        message:
            "Đơn hàng đã thanh toán. Vui lòng liên hệ cửa hàng để hủy đơn và được hoàn tiền."
    }
};

// Đọc số trang từ query. Sai định dạng thì về trang 1.
function parsePage(value) {
    return typeof value === "string" && /^[1-9]\d{0,5}$/.test(value)
        ? Number(value)
        : 1;
}

// Chỉ nhận trạng thái nằm trong danh sách cho phép.
function parseStatus(value) {
    return typeof value === "string" && STATUS_FILTERS.includes(value)
        ? value
        : "";
}

function listUrl(status, page) {
    const params = new URLSearchParams();

    if (status) {
        params.set("status", status);
    }

    if (page > 1) {
        params.set("page", String(page));
    }

    const query = params.toString();

    return query ? `/orders?${query}` : "/orders";
}

const OrderController = {
    async index(req, res, next) {
        try {
            const status = parseStatus(req.query.status);
            const requestedPage = parsePage(req.query.page);

            const { orders, total } = await OrderModel.listForUser(
                res.locals.currentUser.id,
                { status, page: requestedPage, pageSize: PAGE_SIZE }
            );

            const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

            // Trang vượt quá số trang thật: đưa về trang cuối.
            if (requestedPage > totalPages) {
                return res.redirect(listUrl(status, totalPages));
            }

            return res.render("orders/index", {
                orders,
                total,
                status,
                page: requestedPage,
                totalPages,
                statusFilters: STATUS_FILTERS,
                statusLabels: ORDER_STATUS_LABELS,
                paymentStatusLabels: PAYMENT_STATUS_LABELS,
                formatMoney,
                listUrl
            });
        } catch (error) {
            return next(error);
        }
    },

    async show(req, res, next) {
        try {
            const { orderNumber } = req.params;

            // Sai định dạng hoặc không phải đơn của mình: cùng một thông báo.
            const order = ORDER_NUMBER_PATTERN.test(orderNumber)
                ? await OrderModel.findByNumberForUser(
                    res.locals.currentUser.id,
                    orderNumber
                )
                : null;

            if (!order) {
                return res.status(404).send("Không tìm thấy đơn hàng.");
            }

            const flash = req.session.orderFlash || null;
            delete req.session.orderFlash;

            const { bank, bankTransferEnabled } = getPaymentConfig();

            // Chỉ hướng dẫn chuyển khoản khi đơn chọn chuyển khoản, chưa trả và chưa hủy.
            const awaitingTransfer =
                order.payment_method === "bank_transfer" &&
                order.payment_status === "unpaid" &&
                order.status !== "cancelled";

            // COD chưa trả là bình thường: thu tiền khi giao hàng.
            const paymentStatusText =
                order.payment_method === "cod" && order.payment_status === "unpaid"
                    ? "Thu tiền khi giao hàng"
                    : PAYMENT_STATUS_LABELS[order.payment_status];

            return res.render("orders/detail", {
                order,
                flash,
                formatMoney,
                statusLabel: ORDER_STATUS_LABELS[order.status] || order.status,
                steps: ORDER_STEPS.map(step => ({
                    key: step,
                    label: ORDER_STATUS_LABELS[step]
                })),
                currentStep: ORDER_STEPS.indexOf(order.status),
                // Khớp điều kiện trong OrderModel.cancelByUser.
                canCancel:
                    order.status === "pending" &&
                    order.payment_status === "unpaid",
                paidAndPending:
                    order.status === "pending" &&
                    order.payment_status === "paid",
                paymentMethodLabel: PAYMENT_METHOD_LABELS[order.payment_method],
                paymentStatusText,
                awaitingTransfer,
                bank,
                bankTransferEnabled,
                qrUrl: awaitingTransfer
                    ? buildQrUrl(bank, order.total_amount, order.order_number)
                    : ""
            });
        } catch (error) {
            return next(error);
        }
    },

    async cancel(req, res, next) {
        try {
            const { orderNumber } = req.params;

            if (!ORDER_NUMBER_PATTERN.test(orderNumber)) {
                return res.status(404).send("Không tìm thấy đơn hàng.");
            }

            const { result } = await OrderModel.cancelByUser(
                res.locals.currentUser.id,
                orderNumber
            );

            if (result === "not_found") {
                return res.status(404).send("Không tìm thấy đơn hàng.");
            }

            req.session.orderFlash = CANCEL_MESSAGES[result];

            return res.redirect(`/orders/${orderNumber}`);
        } catch (error) {
            return next(error);
        }
    }
};

module.exports = OrderController;
