const { text, validId } = require("./adminValidator");

const COUPON_FIELDS = [
    "code",
    "description",
    "discount_type",
    "discount_value",
    "max_discount_amount",
    "min_order_value",
    "usage_limit",
    "start_date",
    "end_date",
    "is_active",
    "_csrf"
];

const STATUSES = ["", "running", "upcoming", "expired", "exhausted", "disabled"];

function fail(message) {
    const error = new Error(message);
    error.status = 400;
    return error;
}

function validateFilters(query) {
    if (!query || typeof query !== "object" || Array.isArray(query)) {
        throw fail("Bộ lọc không hợp lệ.");
    }

    for (const [key, value] of Object.entries(query)) {
        if (!["q", "status", "page"].includes(key) || typeof value !== "string") {
            throw fail("Tham số tìm kiếm không hợp lệ.");
        }
    }

    const q = text(query.q);
    const status = text(query.status);
    const pageText = text(query.page) || "1";
    if (q.length > 100 || /[\u0000-\u001f\u007f]/u.test(q)) {
        throw fail("Từ khóa tối đa 100 ký tự và không chứa ký tự điều khiển.");
    }
    if (!STATUSES.includes(status)) {
        throw fail("Trạng thái lọc không hợp lệ.");
    }
    if (!/^[1-9]\d{0,5}$/.test(pageText)) {
        throw fail("Số trang không hợp lệ.");
    }

    return { q, status, page: Number(pageText) };
}

function parseDecimal(value, maxIntegerDigits = 10) {
    const decimalPattern = new RegExp(
        `^(?:0|[1-9]\\d{0,${maxIntegerDigits - 1}})(?:\\.\\d{1,2})?$`
    );
    if (!decimalPattern.test(value)) {
        return null;
    }
    return Number(value);
}

function validDateTimeLocal(value) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
    const [date, time] = value.split("T");
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    if (year < 1000 || year > 9999 || month < 1 || month > 12 ||
        day < 1 || day > 31 || hour > 23 || minute > 59) {
        return false;
    }
    const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute));
    return parsed.getUTCFullYear() === year &&
        parsed.getUTCMonth() === month - 1 &&
        parsed.getUTCDate() === day &&
        parsed.getUTCHours() === hour &&
        parsed.getUTCMinutes() === minute;
}

function toMysqlDateTime(value) {
    return value ? `${value.replace("T", " ")}:00` : null;
}

function validateCoupon(body) {
    const errors = {};
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { data: {}, errors: { form: "Dữ liệu gửi lên không hợp lệ." } };
    }

    for (const [key, value] of Object.entries(body)) {
        if (!COUPON_FIELDS.includes(key) || typeof value !== "string") {
            errors.form = "Dữ liệu gửi lên không hợp lệ.";
            break;
        }
    }

    const code = typeof body.code === "string"
        ? body.code.normalize("NFC").toUpperCase().replace(/\s+/gu, "")
        : "";
    const description = text(body.description);
    const discountType = text(body.discount_type);
    const discountValue = text(body.discount_value);
    const maxDiscountText = text(body.max_discount_amount);
    const minOrderValue = text(body.min_order_value);
    const usageLimitText = text(body.usage_limit);
    const startDateText = text(body.start_date);
    const endDateText = text(body.end_date);
    const isActiveText = text(body.is_active);

    if (!code || code.length > 50 || !/^[\p{L}\p{N}_.-]+$/u.test(code)) {
        errors.code = "Mã giảm giá bắt buộc, tối đa 50 ký tự chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.";
    }
    if (description.length > 255 || /[\u0000-\u001f\u007f]/u.test(description)) {
        errors.description = "Mô tả tối đa 255 ký tự và không chứa ký tự điều khiển.";
    }
    if (!["percentage", "fixed"].includes(discountType)) {
        errors.discount_type = "Loại giảm giá không hợp lệ.";
    }

    const discountNumber = parseDecimal(discountValue);
    if (discountNumber === null || discountNumber <= 0) {
        errors.discount_value = "Giá trị giảm phải lớn hơn 0 và có tối đa 2 chữ số thập phân.";
    } else if (discountType === "percentage" && discountNumber > 100) {
        errors.discount_value = "Phần trăm giảm phải từ 1 đến 100.";
    }

    let maxDiscount = null;
    if (maxDiscountText) {
        const parsed = parseDecimal(maxDiscountText);
        if (discountType !== "percentage" || parsed === null || parsed <= 0) {
            errors.max_discount_amount = "Mức giảm tối đa chỉ áp dụng cho coupon phần trăm và phải lớn hơn 0.";
        } else {
            maxDiscount = maxDiscountText;
        }
    }

    const minOrderNumber = parseDecimal(minOrderValue);
    if (minOrderNumber === null || minOrderNumber < 0) {
        errors.min_order_value = "Đơn tối thiểu phải là số không âm, tối đa 2 chữ số thập phân.";
    }

    let usageLimit = null;
    if (usageLimitText) {
        if (!/^(?:0|[1-9]\d{0,9})$/.test(usageLimitText) ||
            Number(usageLimitText) > 4294967295) {
            errors.usage_limit = "Giới hạn lượt dùng phải là số nguyên không âm trong phạm vi cho phép.";
        } else {
            usageLimit = usageLimitText;
        }
    }

    if (startDateText && !validDateTimeLocal(startDateText)) {
        errors.start_date = "Ngày bắt đầu không hợp lệ.";
    }
    if (endDateText && !validDateTimeLocal(endDateText)) {
        errors.end_date = "Ngày kết thúc không hợp lệ.";
    }
    if (startDateText && endDateText &&
        validDateTimeLocal(startDateText) && validDateTimeLocal(endDateText) &&
        endDateText <= startDateText) {
        errors.end_date = "Ngày kết thúc phải sau ngày bắt đầu.";
    }
    if (!["0", "1"].includes(isActiveText)) {
        errors.is_active = "Trạng thái hoạt động không hợp lệ.";
    }

    return {
        data: {
            code,
            description,
            discount_type: discountType,
            discount_value: discountValue,
            max_discount_amount: maxDiscount,
            min_order_value: minOrderValue,
            usage_limit: usageLimit,
            start_date: toMysqlDateTime(startDateText),
            end_date: toMysqlDateTime(endDateText),
            is_active: Number(isActiveText)
        },
        errors
    };
}

module.exports = {
    STATUSES,
    validateFilters,
    validateCoupon,
    validId
};
