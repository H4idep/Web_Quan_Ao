function text(value) {
    return typeof value === "string"
        ? value.normalize("NFC").trim()
        : "";
}

function checkFields(body, allowedFields) {
    if (!body || typeof body !== "object") {
        return false;
    }

    return Object.entries(body).every(
        ([key, value]) =>
            allowedFields.includes(key) &&
            typeof value === "string"
    );
}

function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [year, month, day] = value.split("-").map(Number);

    if (year < 1000 || year > 9998) {
        return false;
    }

    const date = new Date(Date.UTC(year, month - 1, day));

    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
}

function validVersion(value) {
    if (!/^(0|[1-9]\d{0,9})$/.test(value)) {
        return false;
    }

    return Number(value) <= 4294967295;
}

function validateFilters(query) {
    const data = {
        q: text(query.q),
        status: text(query.status),
        from: text(query.from),
        to: text(query.to),
        page: 1
    };

    const errors = [];

    if (!checkFields(query, ["q", "status", "from", "to", "page"])) {
        errors.push("Bộ lọc không hợp lệ.");
    }

    if (
        data.q.length > 100 ||
        /[\u0000-\u001F\u007F]/u.test(data.q)
    ) {
        errors.push("Từ khóa tối đa 100 ký tự, không chứa ký tự điều khiển.");
    }

    if (!["", "active", "blocked"].includes(data.status)) {
        errors.push("Trạng thái không hợp lệ.");
    }

    if (data.from && !validDate(data.from)) {
        errors.push("Ngày bắt đầu không hợp lệ.");
    }

    if (data.to && !validDate(data.to)) {
        errors.push("Ngày kết thúc không hợp lệ.");
    }

    if (
        validDate(data.from) &&
        validDate(data.to) &&
        data.from > data.to
    ) {
        errors.push("Ngày bắt đầu không được sau ngày kết thúc.");
    }

    const page = text(query.page);

    if (page) {
        if (!/^[1-9]\d{0,5}$/.test(page)) {
            errors.push("Số trang không hợp lệ.");
        } else {
            data.page = Number(page);
        }
    }

    return { data, errors };
}

function validateProfile(body) {
    const allowed = [
        "last_name", "first_name", "phone",
        "province", "district", "ward", "address",
        "version", "_csrf"
    ];

    const data = {
        last_name: text(body?.last_name).replace(/\s+/gu, " "),
        first_name: text(body?.first_name).replace(/\s+/gu, " "),
        phone: text(body?.phone),
        province: text(body?.province),
        district: text(body?.district),
        ward: text(body?.ward),
        address: text(body?.address),
        version: text(body?.version)
    };

    const errors = {};

    if (!checkFields(body, allowed)) {
        errors.form = "Biểu mẫu có dữ liệu không hợp lệ.";
    }

    const namePattern =
        /^\p{L}[\p{L}\p{M}]*(?:[ '’-][\p{L}\p{M}]+)*$/u;

    for (const field of ["last_name", "first_name"]) {
        if (
            !data[field] ||
            data[field].length > 50 ||
            !namePattern.test(data[field])
        ) {
            errors[field] =
                "Nhập tên hợp lệ, tối đa 50 ký tự.";
        }
    }

    data.full_name = `${data.last_name} ${data.first_name}`.trim();

    if (data.full_name.length > 100) {
        errors.first_name = "Tổng họ tên không được quá 100 ký tự.";
    }

    if (!/^0[35789]\d{8}$/.test(data.phone)) {
        errors.phone =
            "Nhập số di động 10 chữ số bắt đầu bằng 03, 05, 07, 08 hoặc 09.";
    }

    for (const field of ["province", "district", "ward", "address"]) {
        const maxLength = field === "address" ? 255 : 100;
        const minLength = field === "address" ? 5 : 1;

        if (
            data[field].length < minLength ||
            data[field].length > maxLength ||
            /[\u0000-\u001F\u007F<>]/u.test(data[field])
        ) {
            errors[field] =
                `Nhập từ ${minLength} đến ${maxLength} ký tự hợp lệ.`;
        }
    }

    if (!validVersion(data.version)) {
        errors.form = "Biểu mẫu không hợp lệ. Hãy tải lại trang.";
    }

    return { data, errors };
}

function validateStatus(body) {
    const data = {
        status: text(body?.status),
        reason: text(body?.reason),
        version: text(body?.version)
    };

    const errors = {};

    if (!checkFields(body, ["status", "reason", "version", "_csrf"])) {
        errors.form = "Biểu mẫu có dữ liệu không hợp lệ.";
    }

    if (!["active", "blocked"].includes(data.status)) {
        errors.status = "Trạng thái không hợp lệ.";
    }

    if (
        data.reason.length > 500 ||
        /[\u0000-\u001F\u007F<>]/u.test(data.reason)
    ) {
        errors.reason = "Lý do tối đa 500 ký tự, không chứa ký tự không hợp lệ.";
    }

    if (data.status === "blocked" && data.reason.length < 5) {
        errors.reason = "Vui lòng nhập lý do khóa từ 5 đến 500 ký tự.";
    }

    if (!validVersion(data.version)) {
        errors.form = "Biểu mẫu không hợp lệ. Hãy tải lại trang.";
    }

    return { data, errors };
}

module.exports = {
    validateFilters,
    validateProfile,
    validateStatus
};