document.addEventListener("DOMContentLoaded", async () => {
    const provinceSelect = document.getElementById("province");
    const districtSelect = document.getElementById("district");
    const wardSelect = document.getElementById("ward");

    if (!provinceSelect || !districtSelect || !wardSelect) return;

    const initialProvince = provinceSelect.dataset.selected || "";
    const initialDistrict = districtSelect.dataset.selected || "";
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

        // Đổ danh sách Tỉnh/Thành
        fillSelect(provinceSelect, Object.keys(catalog), "Chọn Tỉnh/Thành", initialProvince);

        // Khởi tạo Quận/Huyện nếu đã có Tỉnh
        if (initialProvince && catalog[initialProvince]) {
            const districts = Object.keys(catalog[initialProvince]);
            fillSelect(districtSelect, districts, "Chọn Quận/Huyện", initialDistrict);

            // Khởi tạo Phường/Xã nếu đã có Huyện
            if (initialDistrict && catalog[initialProvince][initialDistrict]) {
                const wards = catalog[initialProvince][initialDistrict];
                fillSelect(wardSelect, wards, "Chọn Phường/Xã", initialWard);
            }
        }

        // Sự kiện khi đổi Tỉnh
        provinceSelect.addEventListener("change", () => {
            const curProvince = provinceSelect.value;
            const districts = catalog[curProvince] ? Object.keys(catalog[curProvince]) : [];
            fillSelect(districtSelect, districts, "Chọn Quận/Huyện");
            fillSelect(wardSelect, [], "Chọn Phường/Xã");
        });

        // Sự kiện khi đổi Huyện
        districtSelect.addEventListener("change", () => {
            const curProvince = provinceSelect.value;
            const curDistrict = districtSelect.value;
            const wards = (catalog[curProvince] && catalog[curProvince][curDistrict])
                ? catalog[curProvince][curDistrict]
                : [];
            fillSelect(wardSelect, wards, "Chọn Phường/Xã");
        });
    } catch (err) {
        console.error("Không thể tải danh mục địa chỉ:", err);
    }
});
