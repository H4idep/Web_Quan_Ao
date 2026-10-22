const STATUSES = Object.freeze({
    pending: "Chờ xử lý",
    processing: "Đang xử lý",
    shipped: "Đang giao",
    completed: "Hoàn thành",
    cancelled: "Đã hủy"
});

const TRANSITIONS = Object.freeze({
    pending: ["processing", "cancelled"],
    processing: ["shipped", "cancelled"],
    shipped: ["completed"],
    completed: [],
    cancelled: []
});

function fail(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function text(value) {
    return typeof value === "string"
        ? value.normalize("NFC").trim()
        : "";
}

function checkFields(input, allowed) {
    if (!input || typeof input !== "object") {
        throw fail("Dữ liệu gửi lên không hợp lệ.");
    }

    for (const [key, value] of Object.entries(input)) {
        if (!allowed.includes(key) || typeof value !== "string") {
            throw fail("Tham số gửi lên không hợp lệ.");
        }
    }
}

function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

    const year = Number(value.slice(0, 4));
    if (year < 1000 || year > 9998) return false;

    const date = new Date(`${value}T00:00:00.000Z`);

    return !Number.isNaN(date.getTime())
        && date.toISOString().slice(0, 10) === value;
}

function hasStatus(value) {
    return Object.hasOwn(STATUSES, value);
}

function validateFilters(query) {
    checkFields(query, ["q", "status", "from", "to", "page"]);

    const data = {
        q: text(query.q),
        status: text(query.status),
        from: text(query.from),
        to: text(query.to),
        page: text(query.page) || "1"
    };

    if (
        data.q.length > 100
        || /[\u0000-\u001f\u007f]/.test(data.q)
    ) {
        throw fail("Từ khóa tối đa 100 ký tự, không chứa ký tự điều khiển.");
    }

    if (data.status && !hasStatus(data.status)) {
        throw fail("Trạng thái lọc không hợp lệ.");
    }

    if (data.from && !validDate(data.from)) {
        throw fail("Ngày bắt đầu không hợp lệ.");
    }

    if (data.to && !validDate(data.to)) {
        throw fail("Ngày kết thúc không hợp lệ.");
    }

    if (data.from && data.to && data.from > data.to) {
        throw fail("Ngày bắt đầu không được sau ngày kết thúc.");
    }

    if (!/^[1-9]\d{0,5}$/.test(data.page)) {
        throw fail("Số trang không hợp lệ.");
    }

    data.page = Number(data.page);
    return data;
}

function validateChange(body) {
    checkFields(body, ["status", "expected_status", "reason", "_csrf"]);

    const data = {
        status: text(body.status),
        expectedStatus: text(body.expected_status),
        reason: text(body.reason)
    };

    if (!hasStatus(data.status) || !hasStatus(data.expectedStatus)) {
        throw fail("Trạng thái đơn hàng không hợp lệ.");
    }

    if (
        data.reason.length > 500
        || /[\u0000-\u001f\u007f<>]/.test(data.reason)
    ) {
        throw fail("Ghi chú tối đa 500 ký tự, không chứa ký tự điều khiển hoặc < >.");
    }

    if (data.status === "cancelled" && data.reason.length < 5) {
        throw fail("Vui lòng nhập lý do hủy từ 5 đến 500 ký tự.");
    }

    return data;
}

module.exports = {
    STATUSES,
    TRANSITIONS,
    fail,
    validateFilters,
    validateChange
};