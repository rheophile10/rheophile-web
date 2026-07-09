/** @type {import('tailwindcss').Config} */
// Content scanned to build assets/tailwind.css. blog-ui.js is included because
// the project/blog cards and tag chips are assembled from class strings there.
module.exports = {
  content: [
    "./index.html",
    "./404.html",
    "./blog/**/*.html",
    "./assets/blog-ui.js",
  ],
  theme: { extend: {} },
  plugins: [],
};
