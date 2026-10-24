document.addEventListener("DOMContentLoaded", async () => {
    const provinceSelect = document.getElementById("province");
    const wardSelect = document.getElementById("ward");

    if (!provinceSelect || !wardSelect) return;

    const initialProvince = provinceSelect.dataset.selected || "";
    const initialWard = wardSelect.dataset.selected || "";

    function fillSelect(element, items, placeholder, selectedValue = "") {
        element.replaceChildren(new Option(placeholder, ""));
        items.forEach(item => {
            const opt = new Option(item, item);
            if (item === selectedValue) opt.selected = true;
            element.add(opt);
        });
    }

    try {
        const response = await fetch("/address-options");
        if (!response.ok) throw new Error("Lỗi tải địa chỉ");
        const catalog = await response.json();

        // 1. Đổ danh sách Tỉnh/Thành
        fillSelect(provinceSelect, Object.keys(catalog), "Chọn Tỉnh/Thành", initialProvince);

        // 2. Điền sẵn danh sách Phường/Xã ban đầu nếu người dùng đã có tỉnh
        if (initialProvince && Array.isArray(catalog[initialProvince])) {
            fillSelect(wardSelect, catalog[initialProvince], "Chọn Phường/Xã", initialWard);
        }

        // 3. Khi đổi Tỉnh -> Đổ lại danh sách Phường/Xã tương ứng
        provinceSelect.addEventListener("change", () => {
            const curProvince = provinceSelect.value;
            const wards = Array.isArray(catalog[curProvince]) ? catalog[curProvince] : [];
            fillSelect(wardSelect, wards, "Chọn Phường/Xã");
        });
    } catch (err) {
        console.error("Không thể tải danh mục địa chỉ:", err);
    }
});
