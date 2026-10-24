const fs = require("node:fs/promises");
const path = require("node:path");

const SOURCE = "https://provinces.open-api.vn/api/v2/?depth=2";

async function main() {
    if (typeof fetch !== "function") {
        throw new Error(
            "Node.js hiện tại chưa hỗ trợ fetch. Hãy dùng Node.js 22 trở lên."
        );
    }

    console.log("Đang tải danh mục địa chỉ Việt Nam...");

    const response = await fetch(SOURCE, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) {
        throw new Error(`Nguồn dữ liệu trả về HTTP ${response.status}.`);
    }

    const provinces = await response.json();

    if (!Array.isArray(provinces) || provinces.length !== 34) {
        throw new Error(
            "Số tỉnh/thành khác bộ dữ liệu 34 tỉnh dự kiến. " +
            "Cần kiểm tra nguồn trước khi cập nhật."
        );
    }

    const provinceCodes = new Set();
    const provinceNames = new Set();
    const wardCodes = new Set();
    let wardCount = 0;

    function validName(value) {
        return typeof value === "string"
            && value.trim().length > 0
            && value.length <= 100
            && !/[\u0000-\u001f\u007f<>]/.test(value);
    }

    for (const province of provinces) {
        if (
            !Number.isSafeInteger(province.code)
            || province.code <= 0
            || !validName(province.name)
            || provinceCodes.has(province.code)
            || provinceNames.has(province.name)
            || !Array.isArray(province.wards)
            || province.wards.length === 0
        ) {
            throw new Error("Dữ liệu tỉnh/thành thiếu hoặc không hợp lệ.");
        }

        provinceCodes.add(province.code);
        provinceNames.add(province.name);

        const wardNames = new Set();

        for (const ward of province.wards) {
            if (
                !Number.isSafeInteger(ward.code)
                || ward.code <= 0
                || !validName(ward.name)
                || wardCodes.has(ward.code)
                || wardNames.has(ward.name)
            ) {
                throw new Error(
                    `Dữ liệu phường/xã không hợp lệ tại ${province.name}.`
                );
            }

            wardCodes.add(ward.code);
            wardNames.add(ward.name);
            wardCount++;
        }
    }

    // Kiểm tra bộ dữ liệu đang sử dụng trong lần tích hợp này.
    if (wardCount !== 3321) {
        throw new Error(
            `Nhận được ${wardCount} đơn vị cấp xã, khác 3321 dự kiến. ` +
            "Cần đối chiếu thay đổi hành chính trước khi cập nhật."
        );
    }

    const snapshot = {
        source: SOURCE,
        downloadedAt: new Date().toISOString(),
        provinceCount: provinces.length,
        wardCount,
        provinces
    };

    const directory = path.join(__dirname, "..", "data");
    const target = path.join(directory, "vietnam-addresses.json");
    const temporary = target + ".tmp";

    await fs.mkdir(directory, { recursive: true });

    // Chỉ thay file chính sau khi tải và kiểm tra thành công.
    await fs.writeFile(
        temporary,
        JSON.stringify(snapshot, null, 2),
        "utf8"
    );

    await fs.rename(temporary, target);

    console.log(`Đã lưu ${provinces.length} tỉnh/thành.`);
    console.log(`Đã lưu ${wardCount} xã/phường/đặc khu.`);
    console.log("Dữ liệu: data/vietnam-addresses.json");
    console.log("Hãy khởi động lại server để sử dụng dữ liệu mới.");
}

main().catch(error => {
    console.error("Không cập nhật được địa chỉ:", error.message);
    process.exitCode = 1;
});