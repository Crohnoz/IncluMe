// visitorCounter.js
document.addEventListener("DOMContentLoaded", function () {
    const visitCountElement = document.getElementById("visitCount");

    if (visitCountElement) {
        let count = localStorage.getItem("page_view");
        count = count ? parseInt(count) + 1 : 1;
        localStorage.setItem("page_view", count);
        visitCountElement.textContent = count;
    } else {
        console.warn("Elemento visitCount no encontrado.");
    }
});
