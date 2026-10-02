// Menu-SlideBar-Category
const itemsliderbar = document.querySelectorAll(".category-left-li");
itemsliderbar.forEach(function (menu, index) {
  menu.addEventListener("click", function () {
    menu.classList.toggle("block");
  });
});
