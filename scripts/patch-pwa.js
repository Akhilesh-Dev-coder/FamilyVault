const fs = require("fs");
const path = require("path");

const indexPath = path.join(__dirname, "../dist/index.html");

try {
  if (!fs.existsSync(indexPath)) {
    console.error(
      "dist/index.html not found. Make sure to build the web project first."
    );
    process.exit(1);
  }

  let html = fs.readFileSync(indexPath, "utf8");

  if (!html.includes('rel="apple-touch-icon"')) {
    const linkTag =
      '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />';
    // Insert before </head>
    html = html.replace("</head>", `${linkTag}</head>`);
    fs.writeFileSync(indexPath, html);
    console.log(
      "Successfully injected apple-touch-icon link into dist/index.html"
    );
  } else {
    console.log("apple-touch-icon link already exists in dist/index.html");
  }
} catch (error) {
  console.error("Error patching index.html:", error);
  process.exit(1);
}
