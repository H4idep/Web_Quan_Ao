const { getText } = require("./authValidator");

// Cùng quy tắc số điện thoại với form đăng ký.
const PHONE_PATTERN = /^0[35789]\d{8}$/;

// Ký tự điều khiển (trừ xuống dòng trong ghi chú) không được phép.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function validateCheckout(body) {
    const data = {
        customerName: getText(body.customerName).replace(/\s+/gu, " "),
        phone: getText(body.phone),
        shippingAddress: getText(body.shippingAddress).replace(/\s+/gu, " "),
        notes: getText(body.notes)
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

    if (data.notes.length > 1000) {
        errors.notes = "Ghi chú tối đa 1000 ký tự.";
    } else if (CONTROL_CHARS.test(data.notes)) {
        errors.notes = "Ghi chú chứa ký tự không hợp lệ.";
    }

    return { data, errors };
}

module.exports = { validateCheckout };
