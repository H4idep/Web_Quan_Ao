// Menu-SlideBar-Category
const itemsliderbar = document.querySelectorAll(".category-left-li");
itemsliderbar.forEach(function (menu, index) {
  menu.addEventListener("click", function () {
    menu.classList.toggle("block");
  });
});
//-------------------------------PRODUCT---------------------
// Đổi ảnh lớn khi click ảnh nhỏ
const bigImg = document.querySelector(".product-content-left-big-img img");

const smallImg = document.querySelectorAll(
  ".product-content-left-small-img img",
);

smallImg.forEach(function (imgItem) {
  imgItem.addEventListener("click", function () {
    bigImg.src = imgItem.src;
  });
});
// CHI TIẾT - BẢO QUẢN

const titleItems = document.querySelectorAll(
  ".product-content-right-bottom-content-title-item",
);

const contentChiTiet = document.querySelector(
  ".product-content-right-bottom-content-chitiet",
);

const contentBaoQuan = document.querySelector(
  ".product-content-right-bottom-content-baoquan",
);
// Click "Chi tiết"
if (titleItems[0]) {
  titleItems[0].addEventListener("click", function () {
    contentChiTiet.style.display = "block";
    contentBaoQuan.style.display = "none";
  });
}
// Click "Bảo quản"
if (titleItems[1]) {
  titleItems[1].addEventListener("click", function () {
    contentChiTiet.style.display = "none";
    contentBaoQuan.style.display = "block";
  });
}
// NÚT MŨI TÊN
const button = document.querySelector(".product-content-right-bottom-top");

if (button) {
  button.addEventListener("click", function () {
    document
      .querySelector(".product-content-right-bottom-content-big")
      .classList.toggle("activeB");
  });
}
