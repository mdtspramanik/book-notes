import express from "express";

const app = express();
const port = 3000;

// Serve static files on the specified port
app.use(express.static("public"));

// Render index.ejs file
app.get("/", (req, res) => {
  res.render("index.ejs");
});

// Render add.ejs file
app.get("/add", (req, res) => {
  res.render("add.ejs");
});

// Start the server on the specified port
app.listen(port, () => {
  console.log(`Backend server is running on port http://localhost:${port}`);
});
