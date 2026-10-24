const { getText } = require("./authValidator");

// Cùng quy tắc số điện thoại với form đăng ký.
const PHONE_PATTERN = /^0[35789]\d{8}$/;

// Ký tự điều khiển (trừ xuống dòng trong ghi chú) không được phép.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

// Danh sách id sản phẩm khách chọn để đặt. Dữ liệu này đến từ client
// nên chỉ chấp nhận chuỗi số hợp lệ. Trả về mảng id (đã loại trùng),
// hoặc null nếu rỗng / sai định dạng / quá nhiều.
const ID_PATTERN = /^[1-9]\d{0,19}$/;
const MAX_UINT64 = 18446744073709551615n;
const MAX_SELECTED = 100;

function parseSelectedIds(raw) {
    const list = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];

    if (list.length === 0 || list.length > MAX_SELECTED) {
        return null;
    }

    const ids = [];

    for (const value of list) {
        if (
            typeof value !== "string" ||
            !ID_PATTERN.test(value) ||
            BigInt(value) > MAX_UINT64
        ) {
            return null;
        }

        if (!ids.includes(value)) {
            ids.push(value);
        }
    }

    return ids;
}

function validateCheckout(body, allowedPaymentMethods = ["cod"]) {
    const data = {
        customerName: getText(body.customerName).replace(/\s+/gu, " "),
        phone: getText(body.phone),
        shippingAddress: getText(body.shippingAddress).replace(/\s+/gu, " "),
        notes: getText(body.notes),
        paymentMethod: getText(body.paymentMethod)
    };

    const errors = {};

    if (data.customerName.length < 2 || data.customerName.length > 120) {
        errors.customerName = "Họ tên phải từ 2 đến 120 ký tự.";
    } else if (CONTROL_CHARS.test(data.customerName)) {
        errors.customerName = "Họ tên chứa ký tự không hợp lệ.";
    }

    if (!PHONE_PATTERN.test(data.phone)) {
        errors.phone = "Số điện thoại phải gồm 10 chữ số, ví dụ 0912345678.";
    }

    if (data.shippingAddress.length < 10 || data.shippingAddress.length > 500) {
        errors.shippingAddress =
            "Địa chỉ giao hàng phải từ 10 đến 500 ký tự (số nhà, phường/xã, quận/huyện, tỉnh/thành).";
    } else if (CONTROL_CHARS.test(data.shippingAddress)) {
        errors.shippingAddress = "Địa chỉ chứa ký tự không hợp lệ.";
    }

    // Chỉ chấp nhận phương thức nằm trong danh sách server cho phép.
    if (!allowedPaymentMethods.includes(data.paymentMethod)) {
        errors.paymentMethod = "Vui lòng chọn phương thức thanh toán hợp lệ.";
    }

    if (data.notes.length > 1000) {
        errors.notes = "Ghi chú tối đa 1000 ký tự.";
    } else if (CONTROL_CHARS.test(data.notes)) {
        errors.notes = "Ghi chú chứa ký tự không hợp lệ.";
    }

    return { data, errors };
}

module.exports = { validateCheckout, parseSelectedIds };
