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

function validateVariants(body) {
    const asArray = value => value === undefined
        ? []
        : Array.isArray(value)
            ? value
            : [value];
    const ids = asArray(body.variantId);
    const colors = asArray(body.variantColor);
    const sizes = asArray(body.variantSize);
    const skus = asArray(body.variantSku);
    const stocks = asArray(body.variantStock);
    const rowCount = Math.max(
        ids.length,
        colors.length,
        sizes.length,
        skus.length,
        stocks.length
    );
    const variants = [];
    const errors = [];
    const seen = new Set();
    const seenIds = new Set();
    let totalStock = 0;

    if (rowCount > 100) {
        errors.push("Sản phẩm chỉ được có tối đa 100 phân loại.");
    }

    for (let index = 0; index < Math.min(rowCount, 100); index += 1) {
        const rawId = text(ids[index]);
        const color = text(colors[index]).replace(/\s+/gu, " ");
        const size = text(sizes[index]).replace(/\s+/gu, " ");
        const sku = text(skus[index]).replace(/\s+/gu, " ");
        const stock = text(stocks[index]);

        if (!rawId && !color && !size && !sku && !stock) continue;

        let id = null;
        if (rawId) {
            if (!validId(rawId)) {
                errors.push(`Mã biến thể ở dòng ${index + 1} không hợp lệ.`);
            } else if (seenIds.has(rawId)) {
                errors.push(`Biến thể ở dòng ${index + 1} bị trùng mã.`);
            } else {
                id = rawId;
                seenIds.add(rawId);
            }
        }

        if (
            color.length < 1 ||
            color.length > 50 ||
            /[<>\u0000-\u001F\u007F]/u.test(color)
        ) {
            errors.push(`Màu sắc ở phân loại ${index + 1} không hợp lệ.`);
        }

        if (
            size.length < 1 ||
            size.length > 20 ||
            /[<>\u0000-\u001F\u007F]/u.test(size)
        ) {
            errors.push(`Kích cỡ ở phân loại ${index + 1} không hợp lệ.`);
        }

        if (
            sku.length > 50 ||
            /[<>\u0000-\u001F\u007F]/u.test(sku)
        ) {
            errors.push(`SKU ở phân loại ${index + 1} không hợp lệ.`);
        }

        if (
            !/^(?:0|[1-9]\d{0,9})$/.test(stock) ||
            Number(stock) > 4294967295
        ) {
            errors.push(`Tồn kho ở phân loại ${index + 1} không hợp lệ.`);
        }

        const normalize = value => value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/gu, "")
            .replace(/[đĐ]/gu, "d")
            .toLocaleLowerCase("vi");
        const key = `${normalize(color)}\u0000${normalize(size)}`;
        if (color && size && seen.has(key)) {
            errors.push(`Phân loại màu "${color}" và size "${size}" bị trùng.`);
        }
        seen.add(key);

        if (/^(?:0|[1-9]\d{0,9})$/.test(stock)) {
            totalStock += Number(stock);
        }

        variants.push({ id, color, size, sku: sku || null, stock });
    }

    if (variants.length > 0 && totalStock > 4294967295) {
        errors.push("Tổng tồn kho các phân loại không được vượt quá 4.294.967.295.");
    }

    return {
        variants,
        errors,
        totalStock
    };
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
    const variantValidation = validateVariants(body);
    const data = {
        name: text(body.name).replace(/\s+/gu, " "),
        category_id: text(body.category_id),
        description: text(body.description),
        price: text(body.price),
        stock: text(body.stock),
        image_url: text(body.image_url),
        variants: variantValidation.variants
    };

    const errors = {};
    if (variantValidation.errors.length) {
        errors.variants = variantValidation.errors.join(" ");
    }

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

    if (data.variants.length > 0) {
        data.stock = String(variantValidation.totalStock);
    } else if (
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
    validateProduct,
    validateVariants
};