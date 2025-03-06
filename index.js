import express from "express";
import pg from "pg";
import dotenv from "dotenv";

// Load environment variables from the .env file
dotenv.config();

const app = express();
const port = 3000;

// Database connection
const db = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Serve static files on the specified port
app.use(express.static("public"));

// Middleware for parsing URL-encoded data
app.use(express.urlencoded({ extended: true }));

// Render index.ejs file
app.get("/", (req, res) => {
  res.render("index.ejs");
});

// Render find-page.ejs file
app.get("/find-page", (req, res) => {
  res.render("find-page.ejs");
});

// Handle search request from find-page.ejs file
app.post("/find-book", (req, res) => {
  const isbn = req.body.search;
  const imageUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;

  res.render("find-page.ejs", { imageUrl, isbn });
});

// Render add-page.ejs file with the image URL and ISBN
app.post("/add-page", (req, res) => {
  const imageUrl = req.body.imageUrl;
  const isbn = req.body.isbn;

  res.render("add-page.ejs", { imageUrl, isbn });
});

app.post("/add-book", async (req, res) => {
  const { isbn, rating, date, notes } = req.body;
  const client = await db.connect();

  try {
    await client.query(
      "INSERT INTO note (isbn, rating, date, notes) VALUES ($1, $2, $3, $4)",
      [isbn, rating, date, notes]
    );

    res.redirect("/");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error adding book to the database.");
  } finally {
    client.release();
  }
});

// Start the server on the specified port
app.listen(port, () => {
  console.log(`Backend server is running on port http://localhost:${port}`);
});

// Close the database connection when the server stops
process.on("SIGINT", async () => {
  try {
    console.log("Closing database connection...");
    await db.end();
    console.log("Database connection closed.");
  } catch (error) {
    console.error("Error closing database connection:", error);
  } finally {
    process.exit(0);
  }
});
