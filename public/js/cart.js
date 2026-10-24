// Giỏ hàng: chọn sản phẩm để đặt, cập nhật số lượng và tổng tiền đã chọn.
// Đây chỉ là tiện ích giao diện. Server luôn kiểm tra lại danh sách chọn.
(function () {
    var boxes = Array.prototype.slice.call(
        document.querySelectorAll('input[name="selected"]')
    );

    if (boxes.length === 0) {
        return;
    }

    var selectAll = document.getElementById("select-all");
    var count = document.getElementById("selected-count");
    var total = document.getElementById("selected-total");
    var button = document.getElementById("checkout-btn");

    function formatMoney(value) {
        return value.toLocaleString("vi-VN", { maximumFractionDigits: 2 }) + " đ";
    }

    function refresh() {
        var enabled = 0;
        var selected = 0;
        var sum = 0;

        boxes.forEach(function (box) {
            if (box.disabled) {
                return;
            }

            enabled += 1;

            if (box.checked) {
                selected += 1;
                sum += Number(box.getAttribute("data-line-total"));
            }
        });

        count.textContent = String(selected);
        total.textContent = formatMoney(sum);
        button.disabled = selected === 0;

        if (selectAll) {
            selectAll.checked = enabled > 0 && selected === enabled;
            selectAll.indeterminate = selected > 0 && selected < enabled;
        }
    }

    boxes.forEach(function (box) {
        box.addEventListener("change", refresh);
    });

    if (selectAll) {
        selectAll.addEventListener("change", function () {
            boxes.forEach(function (box) {
                if (!box.disabled) {
                    box.checked = selectAll.checked;
                }
            });

            refresh();
        });
    }

    // Trình duyệt có thể khôi phục trạng thái ô tích khi bấm Back.
    refresh();
})();
