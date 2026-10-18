function openLightbox(imgEl) {
  var lb = document.getElementById('lightbox');
  var full = document.getElementById('lightbox-img');
  if (!lb || !full) return;
  full.src = imgEl.src;
  full.alt = imgEl.alt;
  lb.classList.add('open');
}
function closeLightbox() {
  var lb = document.getElementById('lightbox');
  if (lb) lb.classList.remove('open');
}
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeLightbox();
});
