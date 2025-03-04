import express from "express";

const app = express();
const port = 3000;

// Serve static files on the specified port
app.use(express.static("public"));

// Middleware for parsing URL-encoded data
app.use(express.urlencoded({ extended: true }));

// Render index.ejs file
app.get("/", (req, res) => {
  res.render("index.ejs");
});

// Render add.ejs file
app.get("/find-page", (req, res) => {
  res.render("find-page.ejs");
});

app.post("/find-book", (req, res) => {
  const isbn = req.body.search;
  const imageUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;

  res.render("find-page.ejs", { imageUrl, isbn });
});

// Start the server on the specified port
app.listen(port, () => {
  console.log(`Backend server is running on port http://localhost:${port}`);
});
