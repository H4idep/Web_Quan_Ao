function text(value) {
    return typeof value === "string"
        ? value.normalize("NFC").trim()
        : "";
}

function validId(value) {
    if (typeof value !== "string" || !/^[1-9]\d{0,19}$/.test(value)) {
        return false;
    }

    return BigInt(value) <= 18446744073709551615n;
}

function validImageUrl(value) {
    if (!value) {
        return true;
    }

    if (value.length > 500) {
        return false;
    }

    // Ảnh nội bộ của dự án.
    if (
        /^\/(?:uploads\/products|images|img)\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i
            .test(value)
    ) {
        return true;
    }

    // Cho phép URL ảnh HTTPS, không có thông tin đăng nhập.
    try {
        const url = new URL(value);

        return (
            url.protocol === "https:" &&
            !url.username &&
            !url.password
        );
    } catch {
        return false;
    }
}

function validateCategory(body) {
    const data = {
        name: text(body.name).replace(/\s+/gu, " "),
        description: text(body.description)
    };

    const errors = {};

    if (
        data.name.length < 2 ||
        data.name.length > 120 ||
        /[<>\u0000-\u001F\u007F]/u.test(data.name)
    ) {
        errors.name =
            "Tên danh mục cần 2–120 ký tự, không chứa dấu < > hoặc ký tự điều khiển.";
    }

    if (
        typeof body.description !== "string" ||
        data.description.length > 500 ||
        /[\u0000\u007F]/u.test(data.description)
    ) {
        errors.description = "Mô tả không hợp lệ hoặc vượt quá 500 ký tự.";
    }

    return { data, errors };
}

function validateProduct(body) {
    const data = {
        name: text(body.name).replace(/\s+/gu, " "),
        category_id: text(body.category_id),
        description: text(body.description),
        price: text(body.price),
        stock: text(body.stock),
        image_url: text(body.image_url)
    };

    const errors = {};

    if (
        data.name.length < 2 ||
        data.name.length > 180 ||
        /[<>\u0000-\u001F\u007F]/u.test(data.name)
    ) {
        errors.name = "Tên sản phẩm cần 2–180 ký tự và không chứa dấu < >.";
    }

    if (!validId(data.category_id)) {
        errors.category_id = "Vui lòng chọn danh mục hợp lệ.";
    }

    if (
        !data.description ||
        data.description.length > 5000 ||
        /[\u0000\u007F]/u.test(data.description)
    ) {
        errors.description = "Mô tả cần 1–5.000 ký tự.";
    }

    // DECIMAL(12,2): tối đa 10 chữ số trước dấu thập phân.
    if (
        !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(data.price) ||
        Number(data.price) <= 0
    ) {
        errors.price =
            "Giá phải lớn hơn 0, tối đa 9.999.999.999,99; nhập dấu chấm cho phần thập phân.";
    }

    if (
        !/^(?:0|[1-9]\d{0,9})$/.test(data.stock) ||
        Number(data.stock) > 4294967295
    ) {
        errors.stock = "Tồn kho phải là số nguyên từ 0 đến 4.294.967.295.";
    }

    if (
        typeof body.image_url !== "string" ||
        !validImageUrl(data.image_url)
    ) {
        errors.image_url = "Ảnh phải là đường dẫn nội bộ hợp lệ hoặc URL HTTPS.";
    }

    return { data, errors };
}

module.exports = {
    text,
    validId,
    validateCategory,
    validateProduct
};