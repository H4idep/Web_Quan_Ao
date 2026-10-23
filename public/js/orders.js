// Hỏi xác nhận trước khi gửi các form có thuộc tính data-confirm (ví dụ: hủy đơn).
document.addEventListener("submit", function (event) {
    var message = event.target.getAttribute("data-confirm");

    if (message && !window.confirm(message)) {
        event.preventDefault();
    }
});
