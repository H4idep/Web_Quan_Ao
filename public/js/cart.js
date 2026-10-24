// Chọn sản phẩm để đặt hàng trong giỏ.
// Chỉ cập nhật giao diện (tạm tính, nút Đặt hàng); server luôn kiểm tra lại
// sản phẩm được chọn, giá và tồn kho khi đặt hàng.
(function () {
    const selectAll = document.getElementById("select-all");
    const checkboxes = Array.from(document.querySelectorAll(".cart-select"));
    const countEl = document.getElementById("selected-count");
    const subtotalEl = document.getElementById("selected-subtotal");
    const button = document.getElementById("checkout-btn");

    if (!checkboxes.length || !countEl || !subtotalEl || !button) {
        return;
    }

    function formatMoney(value) {
        return Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 2 }) + " đ";
    }

    function selectable() {
        return checkboxes.filter(box => !box.disabled);
    }

    function refresh() {
        const checked = checkboxes.filter(box => box.checked && !box.disabled);
        const total = checked.reduce(
            (sum, box) => sum + Number(box.dataset.lineTotal || 0),
            0
        );

        countEl.textContent = checked.length;
        subtotalEl.textContent = formatMoney(total);
        button.disabled = checked.length === 0;

        if (selectAll) {
            const all = selectable();

            selectAll.disabled = all.length === 0;
            selectAll.checked = all.length > 0 && checked.length === all.length;
            selectAll.indeterminate = checked.length > 0 && checked.length < all.length;
        }
    }

    checkboxes.forEach(box => box.addEventListener("change", refresh));

    if (selectAll) {
        selectAll.addEventListener("change", () => {
            selectable().forEach(box => {
                box.checked = selectAll.checked;
            });

            refresh();
        });
    }

    // Trình duyệt có thể khôi phục trạng thái tick cũ khi bấm Back.
    window.addEventListener("pageshow", refresh);
    refresh();
})();
