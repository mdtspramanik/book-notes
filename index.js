import express from "express";
import pg from "pg";
import dotenv from "dotenv";
import { JSDOM } from "jsdom";
import DOMPurify from "dompurify";

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

// Set up DOMPurify with JSDOM
const window = new JSDOM("").window;
const createDOMPurify = DOMPurify(window);

// Function to format date_read as "Month Day, Year"
const formatDate = (date_read) => {
  return date_read
    ? new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date(date_read))
    : null;
};

// Function to get sorted book
const getSortedBooks = async (sortedBy, res) => {
  const client = await db.connect();

  try {
    let query = "";

    if (sortedBy === "best") {
      query = "SELECT * FROM book ORDER BY rating DESC";
    } else if (sortedBy === "newest") {
      query = "SELECT * FROM book ORDER BY date_read DESC";
    } else if (sortedBy === "oldest") {
      query = "SELECT * FROM book ORDER BY date_read ASC";
    }

    const result = await client.query(query);

    let books = result.rows;

    // Format the date_read as "Month Day, Year"
    books = books.map((book) => ({
      ...book,
      date_read: formatDate(book.date_read),
    }));
    return books;
  } catch (error) {
    res.status(500).send("Error fetching books from the database.");
  } finally {
    client.release();
  }
};

// Render index.ejs file with fetched data from the database
app.get("/", async (req, res) => {
  const client = await db.connect();

  try {
    const result = await client.query("SELECT * FROM book ORDER BY id DESC");

    let books = result.rows;

    // Format the date_read as "Month Day, Year"
    books = books.map((book) => ({
      ...book,
      date_read: formatDate(book.date_read),
    }));

    res.render("index.ejs", { books });
  } catch (error) {
    res.status(500).send("Error fetching books from the database.");
  } finally {
    client.release();
  }
});

// Render find-page.ejs file
app.get("/find-page", (req, res) => {
  res.render("find-page.ejs", { imageUrl: "", isbn: "", message: "" });
});

// Handle search request from find-page.ejs file
app.post("/find-book", (req, res) => {
  const { isbn } = req.body;

  const isbnString = isbn.trim();
  const isbnNumber = Number(isbnString);

  // Validate isbn
  if (isNaN(isbnNumber) || isbnString.length > 13) {
    res
      .status(400)
      .send(
        "Invalid ISBN! Must be a number without dashes and max 13 characters."
      );
    return;
  }

  const imageUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;

  res.render("find-page.ejs", { imageUrl, isbn, message: "" });
});

// Render modify-page.ejs file with the image URL and ISBN for adding the book to the database
app.post("/add-page", async (req, res) => {
  const { imageUrl, isbn } = req.body;

  const client = await db.connect();

  try {
    const result = await client.query("SELECT isbn FROM book WHERE isbn = $1", [
      isbn,
    ]);

    if (result.rows.length > 0 && result.rows[0].isbn === isbn) {
      res.render("find-page.ejs", {
        imageUrl,
        isbn,
        message:
          "This book already exists. Please try adding a different book.",
      });
    } else {
      res.render("modify-page.ejs", {
        imageUrl,
        id: "",
        isbn,
        rating: "",
        date_read: "",
        notes: "",
        buttonText: "Add",
      });
    }
  } catch (error) {
    res.status(500).send("Error finding book in the database.");
  } finally {
    client.release();
  }
});

// Handle adding a book to the database
app.post("/add-book", async (req, res) => {
  const { isbn } = req.body;
  const rating = parseFloat(req.body.rating);
  let date_read = new Date(req.body.date_read);
  const today = new Date();

  // Validate rating
  if (isNaN(rating) || rating < 0 || rating > 10) {
    res
      .status(400)
      .send("Invalid rating. Please enter a number between 0 and 10.");
    return;
  }

  // Validate date_read
  if (isNaN(date_read.getTime()) || date_read > today) {
    res
      .status(400)
      .send("Invalid date read. The date read cannot be in the future.");
    return;
  }

  const dateObj = new Date(date_read);

  // Extract date
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");

  date_read = `${yyyy}-${mm}-${dd}`;

  const notes = createDOMPurify.sanitize(req.body.notes); // Sanitize notes to prevent XSS attacks

  const client = await db.connect();

  try {
    await client.query(
      "INSERT INTO book (isbn, rating, date_read, notes) VALUES ($1, $2, $3, $4)",
      [isbn, rating, date_read, notes]
    );

    res.redirect("/");
  } catch (error) {
    res.status(500).send("Error adding book to the database.");
  } finally {
    client.release();
  }
});

// Render modify-page.ejs file with the image URL and ISBN for editing the book in the database
app.post("/edit-page", (req, res) => {
  const { id, isbn, rating, notes } = req.body;
  let { date_read } = req.body;

  const dateObj = new Date(date_read);

  // Extract date
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");

  date_read = `${yyyy}-${mm}-${dd}`;

  const imageUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;

  res.render("modify-page.ejs", {
    imageUrl,
    id,
    isbn,
    rating,
    date_read,
    notes,
    buttonText: "Update",
  });
});

// Handle updating a book in the database
app.post("/edit-book", async (req, res) => {
  const { id, isbn } = req.body;
  const rating = parseFloat(req.body.rating);
  let date_read = new Date(req.body.date_read);
  const today = new Date();

  // Validate rating
  if (isNaN(rating) || rating < 0 || rating > 10) {
    res
      .status(400)
      .send("Invalid rating. Please enter a number between 0 and 10.");
    return;
  }

  // Validate date_read
  if (isNaN(date_read.getTime()) || date_read > today) {
    res
      .status(400)
      .send("Invalid date read. The date read cannot be in the future.");
    return;
  }

  const dateObj = new Date(date_read);

  // Extract date
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");

  date_read = `${yyyy}-${mm}-${dd}`;

  const notes = createDOMPurify.sanitize(req.body.notes); // Sanitize notes to prevent XSS attacks

  const client = await db.connect();

  try {
    await client.query(
      "UPDATE book SET isbn = $1, rating = $2, date_read = $3, notes = $4 WHERE id = $5",
      [isbn, rating, date_read, notes, id]
    );
    res.redirect("/");
  } catch (error) {
    res.status(500).send("Error updating book in the database.");
  } finally {
    client.release();
  }
});

// Handle deleting a book from the database
app.post("/delete-book", async (req, res) => {
  const { id } = req.body;

  const client = await db.connect();

  try {
    await client.query("DELETE FROM book WHERE id = $1", [id]);
    res.redirect("/");
  } catch (error) {
    res.status(500).send("Error deleting book from the database.");
  } finally {
    client.release();
  }
});

// Handle searching for a book by ISBN in the database
app.post("/search-book", async (req, res) => {
  const { isbn } = req.body;

  const isbnString = isbn.trim();
  const isbnNumber = Number(isbnString);

  // Validate isbn
  if (isNaN(isbnNumber) || isbnString.length > 13) {
    res
      .status(400)
      .send(
        "Invalid ISBN! Must be a number without dashes and max 13 characters"
      );
    return;
  }

  const client = await db.connect();

  try {
    const result = await client.query("SELECT * FROM book WHERE isbn = $1", [
      isbn,
    ]);

    let books = result.rows;

    // Format the date_read as "Month Day, Year"
    books = books.map((book) => ({
      ...book,
      date_read: formatDate(book.date_read),
    }));

    res.render("index.ejs", { books });
  } catch (error) {
    res.status(500).send("Error fetching books from the database.");
  } finally {
    client.release();
  }
});

// Handle sorting books by rating in descending order
app.get("/best", async (req, res) => {
  const sortedBy = "best";

  const books = await getSortedBooks(sortedBy, res);

  res.render("index.ejs", { books });
});

// Handle sorting books by date in descending order
app.get("/newest", async (req, res) => {
  const sortedBy = "newest";

  const books = await getSortedBooks(sortedBy, res);

  res.render("index.ejs", { books });
});

// Handle sorting books by date in ascending order
app.get("/oldest", async (req, res) => {
  const sortedBy = "oldest";

  const books = await getSortedBooks(sortedBy, res);

  res.render("index.ejs", { books });
});

// Render read-page.ejs file with fetched data from the database
app.post("/read-page", async (req, res) => {
  const { id } = req.body;

  const client = await db.connect();

  try {
    const result = await client.query("SELECT * FROM book WHERE id = $1", [id]);

    let book = result.rows;

    // Format the date as "Month Day, Year"
    book = book.map((book) => ({
      ...book,
      date_read: formatDate(book.date_read),
    }));

    res.render("read-page.ejs", { book });
  } catch (error) {
    res.status(500).send("Error fetching books from the database.");
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
